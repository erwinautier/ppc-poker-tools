/** Buvette de la démo : les règles de 003_club_bar.sql, dans le navigateur. */
import { canUndo, bySize, totals, UNDO_MINUTES, type BarApi, type BarItem, type BarLine, type BarPayment, type BarSettings, type Kiosk, type PayMethod, type PayStatus, type RawSlate } from './bar';
import type { Member } from './types';

export interface LineRow {
  id: string; member_id: string; item_id: string | null; label: string; price: number; guest: boolean;
  by_member: string | null; by_kiosk: string | null; created_at: string; cancelled_at: string | null;
}
export interface PaymentRow {
  id: string; member_id: string; amount: number; method: PayMethod; status: PayStatus;
  declared_by: string | null; decided_by: string | null; created_at: string; decided_at: string | null;
}
export interface ReminderRow { id: string; member_id: string; amount: number; by_member: string | null; created_at: string; seen_at: string | null }
export interface BarDb { items: BarItem[]; lines: LineRow[]; payments: PaymentRow[]; reminders: ReminderRow[]; settings: BarSettings; kiosks: Kiosk[] }

const alive = (l: LineRow) => l.cancelled_at === null;

export function slateOf(d: BarDb, member: Member): RawSlate {
  const lines = d.lines.filter(l => l.member_id === member.id && alive(l)).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const sum = (s: PayStatus) => d.payments.filter(p => p.member_id === member.id && p.status === s).reduce((n, p) => n + p.amount, 0);
  const taken = lines.reduce((n, l) => n + l.price, 0);
  const paid = sum('validated'), pending = sum('pending');
  // Les paiements éteignent les consos les plus anciennes d'abord.
  let rest = paid + pending + lines.filter(l => l.price < 0).reduce((n, l) => n - l.price, 0);
  let since: string | null = null;
  for (const l of lines.filter(x => x.price > 0)) {
    rest -= l.price;
    if (rest < 0) { since = l.created_at; break; }
  }
  const asked = d.reminders.filter(r => r.member_id === member.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    member_id: member.id, name: member.name, active: member.active, account: !!member.user_id, taken, paid, pending,
    since: taken - paid - pending > 0 ? since : null,
    last: lines.filter(l => l.item_id).at(-1)?.created_at ?? null,
    reminder: taken > paid && asked ? { created_at: asked.created_at, seen_at: asked.seen_at } : null,
  };
}

/** Les ardoises qui ont vécu. */
export function slates(d: BarDb, members: Member[]): RawSlate[] {
  const seen = new Set([...d.lines.filter(alive).map(l => l.member_id), ...d.payments.map(p => p.member_id)]);
  return members.filter(m => seen.has(m.id)).map(m => slateOf(d, m));
}

/** La « soirée » en cours : le comptoir repart de zéro chaque jour à midi. */
export function eveningStart(now: number): number {
  const d = new Date(now);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export interface BarActor { me: Member | null; kiosk: boolean }
interface Deps { db(): BarDb; members(): Member[]; actor(): BarActor; now(): number; uid(): string; saved(): void; watch(cb: () => void): () => void }

export function createDemoBar({ db, members, actor, now, uid, saved, watch }: Deps): BarApi {
  const iso = () => new Date(now()).toISOString();
  const manager = (m: Member | null) => !!m && (m.role !== 'member' || !!m.treasurer);
  const validator = (m: Member | null) => !!m && (m.role === 'admin' || !!m.treasurer);
  const needMe = () => { const { me } = actor(); if (!me) throw new Error('Réservé aux adhérents connectés.'); return me; };
  const needManager = () => { const m = needMe(); if (!manager(m)) throw new Error('Action réservée aux gestionnaires et à la trésorerie.'); return m; };
  const needValidator = () => { const m = needMe(); if (!validator(m)) throw new Error('Seuls la trésorerie et les administrateurs valident les paiements.'); return m; };
  const needStaff = () => { const m = needMe(); if (m.role === 'member') throw new Error('Action réservée aux gestionnaires.'); return m; };
  const find = <T extends { id: string }>(list: T[], id: string): T => { const x = list.find(y => y.id === id); if (!x) throw new Error('Introuvable : recharge la page.'); return x; };
  const person = (id: string) => { const m = members().find(x => x.id === id); if (!m) throw new Error('Cet adhérent n\'existe plus.'); return m; };
  const name = (id: string | null) => members().find(m => m.id === id)?.name ?? null;
  const amountOk = (n: number) => { if (!Number.isInteger(n) || n <= 0 || n > 100_000) throw new Error('Montant invalide.'); };
  const notMine = (memberId: string, me: Member) => {
    if (memberId === me.id && members().some(m => m.active && m.id !== me.id && m.user_id && validator(m))) {
      throw new Error('Quelqu\'un d\'autre doit valider ton propre paiement.');
    }
  };
  const line = ({ member_id, by_member, by_kiosk, ...l }: LineRow): BarLine => ({ ...l, by: by_kiosk ? 'le comptoir' : by_member === member_id ? null : name(by_member) ?? 'le comptoir' });
  const payment = ({ declared_by: _, ...p }: PaymentRow): BarPayment => ({ ...p, name: name(p.member_id) ?? '', decided_by: name(p.decided_by) });
  const recent = <T extends { created_at: string }>(list: T[], n: number) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n);
  const linesOf = (id: string) => recent(db().lines.filter(l => l.member_id === id), 60).map(line);
  const paymentsOf = (id: string) => recent(db().payments.filter(p => p.member_id === id), 30).map(payment);
  const items = () => structuredClone(db().items).sort((a, b) => a.sort - b.sort);

  return {
    watch,
    async load() {
      const me = needMe(), manage = manager(me);
      return structuredClone({
        items: items(), settings: db().settings, manage, validate: validator(me), queued: 0,
        slate: totals(slateOf(db(), me)), lines: linesOf(me.id), payments: paymentsOf(me.id),
        team: manage ? { slates: slates(db(), members()).map(totals).sort(bySize), pending: recent(db().payments.filter(p => p.status === 'pending'), 200).map(payment) } : null,
      });
    },
    async detail(id) { needManager(); return structuredClone({ lines: linesOf(id), payments: paymentsOf(id) }); },
    async report(from) {
      needManager();
      return db().items.map(i => {
        const l = db().lines.filter(x => alive(x) && x.item_id === i.id && Date.parse(x.created_at) >= from);
        return { label: i.name, count: l.length, amount: l.reduce((n, x) => n + x.price, 0), guests: l.filter(x => x.guest).length };
      }).filter(s => s.count > 0).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, 'fr'));
    },
    async counter() {
      if (!actor().kiosk) needManager();
      const from = eveningStart(now()), t = new Map<string, number>();
      for (const l of db().lines) if (alive(l) && l.item_id && Date.parse(l.created_at) >= from) t.set(`${l.member_id}/${l.item_id}`, (t.get(`${l.member_id}/${l.item_id}`) ?? 0) + 1);
      return {
        items: items(), queued: 0,
        people: members().filter(m => m.active).map(({ id, name: n }) => ({ id, name: n })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
        tally: [...t].map(([k, n]) => ({ member_id: k.split('/')[0], item_id: k.split('/')[1], n })),
      };
    },
    async take(memberId, item, guest = false) {
      const { me, kiosk } = actor();
      if (!kiosk && needMe().id !== memberId && !manager(me)) throw new Error('Tu ne peux noter que tes propres consommations.');
      const m = person(memberId), i = find(db().items, item.id);
      if (!m.active) throw new Error('Cet adhérent n\'existe plus.');
      if (!i.active) throw new Error('Ce produit n\'est plus proposé.');
      const id = uid();
      db().lines.push({ id, member_id: m.id, item_id: i.id, label: i.name, price: i.price, guest, by_member: kiosk ? null : me!.id, by_kiosk: kiosk ? 'demo-kiosk' : null, created_at: iso(), cancelled_at: null });
      saved();
      return { id, queued: false };
    },
    async undo(lineId) {
      const { me, kiosk } = actor();
      const l = db().lines.find(x => x.id === lineId), own = l?.member_id === me?.id;
      if (!kiosk) needMe();
      if (!l || (kiosk && !l.by_kiosk)) throw new Error('Introuvable : recharge la page.');
      if (!kiosk && !own && !manager(me)) throw new Error('Tu ne peux annuler que tes propres consommations.');
      if (l.item_id === null) notMine(l.member_id, needValidator());
      // Sur sa propre ardoise et au comptoir, dix minutes, y compris pour l'équipe.
      else if ((kiosk || own) && !canUndo(line(l), now())) throw new Error(`Passé ${UNDO_MINUTES} minutes, demande à quelqu'un d'autre de l'équipe.`);
      l.cancelled_at ??= iso();
      saved();
    },
    async declare(amount, method) {
      const me = needMe();
      amountOk(amount);
      db().payments.push({ id: uid(), member_id: me.id, amount, method, status: 'pending', declared_by: me.id, decided_by: null, created_at: iso(), decided_at: null });
      saved();
    },
    async withdraw(paymentId) {
      const me = needMe(), p = db().payments.find(x => x.id === paymentId);
      if (!p || p.member_id !== me.id || p.status !== 'pending') throw new Error('Ce paiement ne peut plus être retiré.');
      db().payments = db().payments.filter(x => x !== p);
      saved();
    },
    async decide(paymentId, ok) {
      const me = needValidator(), p = find(db().payments, paymentId);
      if (p.status !== 'pending') throw new Error('Ce paiement est déjà traité.');
      if (ok) notMine(p.member_id, me);
      Object.assign(p, { status: ok ? 'validated' : 'refused', decided_by: me.id, decided_at: iso() });
      saved();
    },
    async receive(memberId, amount, method) {
      const me = needValidator();
      amountOk(amount);
      notMine(memberId, me);
      db().payments.push({ id: uid(), member_id: person(memberId).id, amount, method, status: 'validated', declared_by: me.id, decided_by: me.id, created_at: iso(), decided_at: iso() });
      saved();
    },
    async adjust(memberId, amount, label) {
      const me = needValidator();
      if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000) throw new Error('Montant invalide.');
      if (!label.trim()) throw new Error('Indique le motif.');
      if (amount < 0) notMine(memberId, me);
      db().lines.push({ id: uid(), member_id: person(memberId).id, item_id: null, label: label.trim().slice(0, 60), price: amount, guest: false, by_member: me.id, by_kiosk: null, created_at: iso(), cancelled_at: null });
      saved();
    },
    async remind(memberIds) {
      const me = needManager();
      let sent = 0;
      for (const id of new Set(memberIds)) {
        const m = members().find(x => x.id === id);
        const s = m && totals(slateOf(db(), m));
        if (!s || !s.active || !s.account || s.open <= 0 || s.reminder?.seen_at === null) continue;
        db().reminders.push({ id: uid(), member_id: id, amount: s.open, by_member: me.id, created_at: iso(), seen_at: null });
        sent++;
      }
      saved();
      return sent;
    },
    async seen() {
      const me = needMe();
      const mine = db().reminders.filter(r => r.member_id === me.id && r.seen_at === null);
      if (mine.length === 0) return;
      for (const r of mine) r.seen_at = iso();
      saved();
    },
    async saveItem({ id, name: n, emoji, price, active }) {
      needManager();
      const clean = { name: n.trim().slice(0, 30), emoji: emoji.trim().slice(0, 8), price, active };
      if (!clean.name) throw new Error('Indique le nom du produit.');
      if (!Number.isInteger(price) || price < 0 || price > 10_000) throw new Error('Prix invalide.');
      if (id) Object.assign(find(db().items, id), clean);
      else db().items.push({ ...clean, id: uid(), sort: Math.max(0, ...db().items.map(i => i.sort)) + 1 });
      saved();
    },
    async moveItem(id, by) {
      needManager();
      const list = [...db().items].sort((a, b) => a.sort - b.sort);
      const i = list.findIndex(x => x.id === id), j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, n) => { x.sort = n + 1; });
      saved();
    },
    async saveSettings(s) {
      needManager();
      if (!Number.isInteger(s.alert) || s.alert < 0 || !Number.isInteger(s.days) || s.days < 1) throw new Error('Réglage invalide.');
      db().settings = { ...s, payInfo: s.payInfo.trim().slice(0, 200) };
      saved();
    },
    async kiosks() { needStaff(); return structuredClone(db().kiosks); },
    async createKiosk(n) {
      needStaff();
      if (!n.trim()) throw new Error('Donne un nom à cette tablette.');
      db().kiosks.push({ id: uid(), name: n.trim().slice(0, 40), created_at: iso(), used_at: null });
      saved();
      return 'demo';
    },
    async revokeKiosk(id) { needStaff(); db().kiosks = db().kiosks.filter(k => k.id !== id); saved(); },
  };
}
