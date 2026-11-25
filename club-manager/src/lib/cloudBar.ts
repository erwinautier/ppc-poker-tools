/** Buvette sur la vraie base : les fonctions de 003_club_bar.sql, et les consos gardées sans réseau. */
import { DbError, MissingRpc, type Api } from './api';
import { bySize, totals, type BarApi, type BarData, type BarLine, type BarPayment, type Counter, type ItemStat, type Kiosk, type RawSlate } from './bar';
import { createQueue, type Op, type Queue } from './barQueue';
import { kioskKey } from './kiosk';

type Raw = Omit<BarData, 'slate' | 'team' | 'queued'> & { slate: RawSlate; team: { slates: RawSlate[]; pending: BarPayment[] } | null };
type RawCounter = Omit<Counter, 'queued'>;

const COUNTER = 'ppc-bar-counter';
const WAIT_MS = 2500;
const get = <T>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null; } catch { return null; } };
const set = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* en mémoire seulement */ } };

/** Identifiant valable même hors https (essai sur le réseau local). */
export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Le serveur a répondu non (règle, donnée invalide). Tout le reste se retente. */
export const refused = (e: unknown) => e instanceof DbError && /^(P0001|22|23|42)/.test(e.code ?? '') && !(e instanceof MissingRpc);

export function createCloudBar(api: Api): BarApi {
  const watchers = new Set<() => void>();
  const ring = () => watchers.forEach(w => w());
  const queues = new Map<string, Queue>();
  const p_key = () => kioskKey();

  const owner = async () => p_key() ? 'kiosk' : (await api.user())?.id ?? null;
  function queueOf(who: string): Queue {
    let q = queues.get(who);
    if (!q) {
      const store = `ppc-bar-queue-${who}`;
      q = createQueue({
        load: () => get<Op[]>(store) ?? [],
        save: ops => set(store, ops),
        send: async op => {
          // La session a changé entre-temps : on attend le retour de la bonne personne.
          if (await owner() !== who) throw new Error('Autre compte.');
          await api.rpc('club_bar_take', { p_id: op.id, p_member: op.member_id, p_item: op.item_id, p_guest: op.guest, p_at: op.at, p_key: p_key() });
        },
        retry: e => !refused(e),
        onChange: ring,
        onLost: (op, e) => window.dispatchEvent(new CustomEvent('bar-lost', { detail: `${op.label} : ${e instanceof Error ? e.message : 'refusée'}` })),
      });
      queues.set(who, q);
    }
    return q;
  }
  const flush = async () => { const who = await owner(); if (who) await queueOf(who).flush(); };
  setInterval(() => void flush().catch(() => {}), 15_000);
  window.addEventListener('online', () => void flush().catch(() => {}));

  // Sans réseau, on garde le dernier état connu, complété par les consos en attente.
  let last: { who: string; raw: Raw } | null = null;
  let lastCounter: RawCounter | null = null;
  const pendingOps = async () => { const who = await owner(); return who ? queueOf(who).list() : []; };

  return {
    watch(cb) {
      watchers.add(cb);
      const stop = p_key() ? () => {} : api.watchBar(cb);
      return () => { watchers.delete(cb); stop(); };
    },
    async load() {
      const who = await owner();
      if (!who) return null;
      let raw: Raw;
      try {
        raw = await api.rpc<Raw>('club_bar_load');
        last = { who, raw };
      } catch (e) {
        if (e instanceof MissingRpc) return null;
        if (refused(e) || last?.who !== who) throw e;
        raw = last.raw;
      }
      const ops = (await pendingOps()).filter(o => !raw.lines.some(l => l.id === o.id));
      const mine = ops.filter(o => o.member_id === raw.slate.member_id);
      const waiting: BarLine[] = mine.map(o => ({ id: o.id, item_id: o.item_id, label: o.label, price: o.price, guest: o.guest, by: null, created_at: o.at, cancelled_at: null, queued: true }));
      const add = mine.reduce((n, o) => n + o.price, 0);
      return {
        ...raw, queued: ops.length,
        lines: [...waiting, ...raw.lines].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
        slate: totals({ ...raw.slate, taken: raw.slate.taken + add, since: raw.slate.since ?? (raw.slate.taken + add > raw.slate.paid + raw.slate.pending ? mine[0]?.at ?? null : null) }),
        team: raw.team && { slates: raw.team.slates.map(totals).sort(bySize), pending: raw.team.pending },
      };
    },
    detail: p_member => api.rpc('club_bar_detail', { p_member }),
    report: from => api.rpc<ItemStat[]>('club_bar_report', { p_from: new Date(from).toISOString() }),
    async counter() {
      let raw: RawCounter;
      try {
        raw = await api.rpc<RawCounter>('club_bar_counter', { p_key: p_key() });
        lastCounter = raw;
        if (p_key()) set(COUNTER, raw);
      } catch (e) {
        lastCounter ??= p_key() ? get<RawCounter>(COUNTER) : null;
        if (refused(e) || !lastCounter) throw e;
        raw = lastCounter;
      }
      const ops = await pendingOps();
      const tally = raw.tally.map(t => ({ ...t }));
      for (const o of ops) {
        const t = tally.find(x => x.member_id === o.member_id && x.item_id === o.item_id);
        if (t) t.n++; else tally.push({ member_id: o.member_id, item_id: o.item_id, n: 1 });
      }
      return { items: raw.items, people: [...raw.people].sort((a, b) => a.name.localeCompare(b.name, 'fr')), tally, queued: ops.length };
    },
    async take(memberId, item, guest = false) {
      const who = await owner();
      if (!who) throw new Error('Réservé aux adhérents connectés.');
      const op: Op = { id: uuid(), member_id: memberId, item_id: item.id, label: item.name, price: item.price, guest, at: new Date(api.now()).toISOString() };
      const queued = await Promise.race([queueOf(who).add(op), new Promise<boolean>(r => setTimeout(() => r(true), WAIT_MS))]);
      return { id: op.id, queued };
    },
    async undo(lineId) {
      const who = await owner();
      if (who && await queueOf(who).drop(lineId)) return;
      await api.rpc('club_bar_undo', { p_line: lineId, p_key: p_key() });
    },
    declare: (p_amount, p_method) => api.rpc('club_bar_declare', { p_amount, p_method }),
    withdraw: p_payment => api.rpc('club_bar_withdraw', { p_payment }),
    decide: (p_payment, p_ok) => api.rpc('club_bar_decide', { p_payment, p_ok }),
    receive: (p_member, p_amount, p_method) => api.rpc('club_bar_receive', { p_member, p_amount, p_method }),
    adjust: (p_member, p_amount, p_label) => api.rpc('club_bar_adjust', { p_member, p_amount, p_label }),
    remind: p_members => api.rpc<number>('club_bar_remind', { p_members }),
    seen: () => api.rpc('club_bar_seen'),
    saveItem: i => api.rpc('club_bar_save_item', { p_id: i.id ?? null, p_name: i.name, p_emoji: i.emoji, p_price: i.price, p_active: i.active }),
    moveItem: (p_id, p_by) => api.rpc('club_bar_move_item', { p_id, p_by }),
    saveSettings: s => api.rpc('club_bar_save_settings', { p_alert: s.alert, p_days: s.days, p_pay_info: s.payInfo }),
    kiosks: () => api.rpc<Kiosk[]>('club_bar_kiosks'),
    createKiosk: p_name => api.rpc<string>('club_bar_create_kiosk', { p_name }),
    revokeKiosk: p_id => api.rpc('club_bar_revoke_kiosk', { p_id }),
  };
}
