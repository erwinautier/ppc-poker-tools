/**
 * Mode démo : les mêmes opérations que la base, dans le navigateur. Deux onglets
 * ouverts (organisateur et écran géant, par exemple) restent synchronisés.
 */
import { keyOf as pk, type Api, type AuthUser, type Query, type TableName } from './api';
import type { BarApi } from './bar';
import { createDemoBar } from './demoBar';
import { DEMO_USERS, seedDemo, type DemoDb } from './demoData';
import { isLastAdmin, type Entry, type HuMatch, type Knockout, type Member, type Tournament } from './types';

const KEY = 'ppc-club-demo-v5';
const ROLE_KEY = 'ppc-club-demo-role';
export type DemoRole = 'admin' | 'director' | 'treasurer' | 'member' | 'pending' | 'kiosk' | 'anon';

export interface DemoApi extends Api {
  role(): DemoRole;
  setRole(r: DemoRole): void;
  reset(): void;
  bar: BarApi;
}

// randomUUID n'existe pas en http sur le réseau local : la démo doit s'ouvrir sur un téléphone.
const uid = () => crypto.randomUUID?.() ?? `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T>(x: T): T => structuredClone(x);

export function createDemoApi(): DemoApi {
  let memory: DemoDb | null = null;
  const watchers = new Set<(id: string | null) => void>();
  const authWatchers = new Set<(u: AuthUser | null, e: string) => void>();

  function load(): DemoDb {
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) memory = JSON.parse(raw) as DemoDb;
    } catch { /* stockage indisponible : démo en mémoire */ }
    memory ??= seedDemo(Date.now());
    memory.club_hu_matches ??= [];
    save();
    return memory;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* idem */ }
  }
  function changed(id: string | null) {
    save();
    setTimeout(() => watchers.forEach(w => w(id)), 0);
  }
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    memory = null;
    watchers.forEach(w => w(null));
  });

  function role(): DemoRole {
    try { return (sessionStorage.getItem(ROLE_KEY) as DemoRole) ?? 'admin'; } catch { return 'admin'; }
  }
  const user = (): AuthUser | null => {
    const r = role();
    return r === 'anon' || r === 'kiosk' ? null : { id: DEMO_USERS[r], email: `${r}@exemple.test` };
  };
  const me = (): Member | undefined => load().club_members.find(m => m.user_id === user()?.id && m.active);
  const staff = () => { const r = me()?.role; return r === 'admin' || r === 'director'; };
  const needStaff = () => { if (!staff()) throw new Error('Action réservée aux gestionnaires.'); };
  /** Mêmes règles que club_members_guard ; after nul = suppression. */
  function guardMember(before: Member | null, after: Member | null) {
    if (me()?.role !== 'admin' && (before?.treasurer || after?.treasurer)) {
      throw new Error(before?.treasurer ? 'Seul un administrateur peut modifier la fiche de la trésorerie.' : 'Seul un administrateur confie la trésorerie.');
    }
    if (me()?.role !== 'admin' && [before, after].some(x => x && x.role !== 'member')) {
      throw new Error(before ? 'Seul un administrateur peut modifier un gestionnaire.' : 'Seul un administrateur peut attribuer ce rôle.');
    }
    if (before && isLastAdmin(load().club_members, before) && !(after && after.role === 'admin' && after.active && after.user_id)) {
      throw new Error('Le club doit garder au moins un administrateur.');
    }
  }

  /** Mêmes règles que club_hu_matches_guard : le vainqueur seul, dans le dernier tour. */
  function guardMatch(m: HuMatch, patch: object) {
    if (Object.keys(patch).some(k => k !== 'winner')) throw new Error('Seul le vainqueur d\'un match se modifie.');
    const w = (patch as { winner?: string | null }).winner ?? null;
    if (w !== null && (m.b === null || (w !== m.a && w !== m.b))) throw new Error('Ce joueur ne joue pas ce match.');
    const t = load().club_tournaments.find(x => x.id === m.tournament_id);
    if (t && (t.status === 'finished' || t.status === 'cancelled')) throw new Error('Tournoi terminé : rouvre-le pour corriger un match.');
    if (load().club_hu_matches.some(x => x.tournament_id === m.tournament_id && x.round > m.round)) throw new Error('Le tour suivant est déjà tiré : annule-le pour corriger ce match.');
  }

  /** Mêmes règles de lecture que la base. */
  function visible(table: TableName, row: object): boolean {
    if (staff()) return true;
    const db = load();
    const seesT = (t?: Tournament) => !!t && t.status !== 'draft' && (t.visibility === 'public' || !!me());
    switch (table) {
      case 'club_tournaments': return seesT(row as Tournament);
      case 'club_entries': case 'club_knockouts': case 'club_hu_matches':
        return seesT(db.club_tournaments.find(t => t.id === (row as Entry).tournament_id));
      case 'club_championships': return (row as { visibility: string }).visibility === 'public' || !!me();
      case 'club_payments': return false;
      case 'club_join_requests': return (row as { user_id: string }).user_id === user()?.id;
      // Le comptoir a besoin des noms, et de rien d'autre.
      default: return !!me() || (role() === 'kiosk' && table === 'club_members');
    }
  }

  const rows = (table: TableName) => load()[table] as unknown as Record<string, unknown>[];
  const setRows = (table: TableName, list: Record<string, unknown>[]) => {
    (load() as unknown as Record<string, unknown>)[table] = list;
  };
  const tid = (table: TableName, row: Record<string, unknown>): string | null =>
    table === 'club_tournaments' ? String(row.id) : (row.tournament_id as string) ?? null;

  function promote(tournamentId: string) {
    const db = load();
    const t = db.club_tournaments.find(x => x.id === tournamentId);
    if (!t || !['draft', 'open', 'closed'].includes(t.status)) return;
    const list = db.club_entries.filter(e => e.tournament_id === tournamentId);
    let free = t.max_players === null ? Infinity : t.max_players - list.filter(e => e.status === 'registered').length;
    for (const e of list.filter(x => x.status === 'waitlist').sort((a, b) => a.registered_at.localeCompare(b.registered_at))) {
      if (free-- <= 0) break;
      e.status = 'registered';
    }
  }

  const DEFAULTS: Partial<Record<TableName, () => object>> = {
    club_members: () => ({ user_id: null, role: 'member', active: true }),
    club_structures: () => ({ description: '', levels: [], chips: [] }),
    club_championships: () => ({ season: '', description: '', status: 'active', visibility: 'members', scoring: {} }),
    club_tournaments: () => ({ description: '', venue: '', status: 'draft', visibility: 'members', max_players: null, championship_id: null, clock_level: 0, clock_elapsed_ms: 0, clock_anchor: null, finished_at: null, rev: 0 }),
    club_entries: () => ({ member_id: null, status: 'registered', registered_at: new Date().toISOString(), checked_in: false, rebuys: 0, addons: 0, table_no: null, seat_no: null, bounty_start: null, points_adjust: 0, final_position: null, final_kos: null, final_bounty: null }),
    club_knockouts: () => ({ killer_ids: [], rebuy: false, level: null }),
  };

  const bar = createDemoBar({
    db: () => load().bar,
    members: () => load().club_members,
    actor: () => ({ me: me() ?? null, kiosk: role() === 'kiosk' }),
    now: () => Date.now(), uid, saved: () => changed(null),
    watch: cb => { const w = () => cb(); watchers.add(w); return () => { watchers.delete(w); }; },
  });

  const api: DemoApi = {
    kind: 'demo',
    bar,
    now: () => Date.now(),
    role,
    setRole(r) {
      try { sessionStorage.setItem(ROLE_KEY, r); } catch { /* sans effet */ }
      authWatchers.forEach(w => w(user(), 'SIGNED_IN'));
    },
    reset() {
      memory = seedDemo(Date.now());
      changed(null);
      authWatchers.forEach(w => w(user(), 'SIGNED_IN'));
    },
    async user() { return user(); },
    onAuth(cb) { authWatchers.add(cb); return () => { authWatchers.delete(cb); }; },
    async signIn() { api.setRole('member'); },
    async signUp() { throw new Error('La création de compte n\'existe pas en mode démo.'); },
    async signOut() { api.setRole('anon'); },
    async resetPassword() { throw new Error('Indisponible en mode démo.'); },
    async updatePassword() { throw new Error('Indisponible en mode démo.'); },

    async select<T>(table: TableName, q: Query = {}) {
      let list = rows(table).filter(r => visible(table, r));
      for (const [k, v] of Object.entries(q.eq ?? {})) list = list.filter(r => r[k] === v);
      if (q.in) { const [c, vs] = q.in; list = list.filter(r => vs.includes(String(r[c]))); }
      if (q.order) {
        const [c, d] = q.order;
        list = [...list].sort((a, b) => {
          const x = a[c], y = b[c];
          const s = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
          return d === 'asc' ? s : -s;
        });
      }
      return clone(list) as T[];
    },
    async insert<T>(table: TableName, input: object | object[]) {
      needStaff();
      if (table === 'club_hu_matches') throw new Error('Les tours se tirent depuis l\'onglet Direct.');
      const db = load();
      const list = (Array.isArray(input) ? input : [input]).map(r => {
        const row: Record<string, unknown> = { ...DEFAULTS[table]?.(), created_at: new Date().toISOString(), ...r };
        if (pk(table) === 'id') row.id ??= uid();
        if (table === 'club_knockouts') row.seq = ++db.seq;
        return row;
      });
      for (const row of list) {
        if (table === 'club_members') guardMember(null, row as unknown as Member);
        if (table === 'club_entries' && row.member_id && rows(table).some(e => e.tournament_id === row.tournament_id && e.member_id === row.member_id)) {
          throw new Error('Cet adhérent est déjà inscrit.');
        }
        if (table === 'club_knockouts') {
          const k = row as unknown as Knockout;
          if (!k.rebuy && db.club_knockouts.some(x => x.victim_id === k.victim_id && !x.rebuy)) throw new Error('Ce joueur est déjà éliminé.');
          const e = db.club_entries.find(x => x.id === k.victim_id);
          if (k.rebuy && e) e.rebuys++;
        }
        rows(table).push(row);
        changed(tid(table, row));
      }
      return clone(list) as T[];
    },
    async update(table, id, patch) {
      needStaff();
      const row = rows(table).find(r => r[pk(table)] === id);
      if (!row) throw new Error('Introuvable.');
      if (table === 'club_members') guardMember(row as unknown as Member, { ...row, ...patch } as unknown as Member);
      if (table === 'club_hu_matches') guardMatch(row as unknown as HuMatch, patch);
      Object.assign(row, clone(patch));
      if (table === 'club_members' && 'name' in patch) {
        for (const e of load().club_entries) if (e.member_id === id) e.name = String(row.name);
      }
      if (table === 'club_entries') promote(String(row.tournament_id));
      if (table === 'club_tournaments') promote(id);
      changed(tid(table, row));
    },
    async remove(table, id) {
      const row = rows(table).find(r => r[pk(table)] === id);
      if (!row) return;
      if (table !== 'club_join_requests') needStaff();
      if (table === 'club_hu_matches') throw new Error('Annule le tour depuis l\'onglet Direct.');
      if (table === 'club_members') guardMember(row as unknown as Member, null);
      const db = load();
      setRows(table, rows(table).filter(r => r !== row));
      if (table === 'club_tournaments') {
        db.club_entries = db.club_entries.filter(e => e.tournament_id !== id);
        db.club_knockouts = db.club_knockouts.filter(k => k.tournament_id !== id);
        db.club_payments = db.club_payments.filter(p => p.tournament_id !== id);
        db.club_hu_matches = db.club_hu_matches.filter(m => m.tournament_id !== id);
      }
      if (table === 'club_entries') {
        db.club_knockouts = db.club_knockouts.filter(k => k.victim_id !== id);
        db.club_hu_matches = db.club_hu_matches.filter(m => m.a !== id && m.b !== id);
        db.club_payments = db.club_payments.filter(p => p.entry_id !== id);
        promote(String(row.tournament_id));
      }
      if (table === 'club_knockouts' && row.rebuy) {
        const e = db.club_entries.find(x => x.id === row.victim_id);
        if (e) e.rebuys = Math.max(0, e.rebuys - 1);
      }
      if (table === 'club_championships') for (const t of db.club_tournaments) if (t.championship_id === id) t.championship_id = null;
      if (table === 'club_members') for (const e of db.club_entries) if (e.member_id === id) e.member_id = null;
      changed(tid(table, row));
    },

    async rpc<T>(fn: string, args: object = {}) {
      const a = args as Record<string, never>;
      const db = load();
      const t = db.club_tournaments.find(x => x.id === a.p_tournament);
      const done = (v?: unknown) => { changed((a.p_tournament as string) ?? null); return v as T; };
      switch (fn) {
        case 'club_request_join': {
          const u = user()!;
          const others = db.club_join_requests.filter(x => x.user_id !== u.id);
          db.club_join_requests = [...others, { user_id: u.id, name: String(a.p_name).trim(), email: u.email, created_at: new Date().toISOString() }];
          return done();
        }
        case 'club_account_status': {
          const u = user();
          return (!u ? 'none' : db.club_members.some(m => m.user_id === u.id) ? 'ok' : db.refused.includes(u.id) ? 'refused' : 'pending') as T;
        }
        case 'club_pending_count':
          return (staff() ? db.accounts.filter(x => x.confirmed && !db.refused.includes(x.user_id) && !db.club_members.some(m => m.user_id === x.user_id)).length : 0) as T;
        case 'club_refuse_account': {
          needStaff();
          db.refused = db.refused.filter(x => x !== a.p_user);
          if (a.p_refuse) {
            db.refused.push(a.p_user);
            db.club_join_requests = db.club_join_requests.filter(x => x.user_id !== a.p_user);
          }
          return done();
        }
        case 'club_approve_request': {
          needStaff();
          const req = db.club_join_requests.find(r => r.user_id === a.p_user);
          if (!req) throw new Error('Cette demande n\'existe plus.');
          let id: string;
          if (a.p_member) {
            const m = db.club_members.find(x => x.id === a.p_member);
            if (!m || m.user_id) throw new Error('Cette fiche est déjà rattachée à un compte.');
            guardMember(m, { ...m, user_id: req.user_id, active: true });
            Object.assign(m, { user_id: req.user_id, active: true });
            id = m.id;
          } else {
            id = uid();
            db.club_members.push({ id, user_id: req.user_id, name: req.name, role: 'member', active: true, created_at: new Date().toISOString() });
          }
          db.club_join_requests = db.club_join_requests.filter(r => r !== req);
          return done(id);
        }
        case 'club_accounts': {
          needStaff();
          const admin = me()?.role === 'admin';
          return clone(db.accounts).sort((x, y) => y.created_at.localeCompare(x.created_at)).map(x => {
            const m = db.club_members.find(z => z.user_id === x.user_id);
            return { ...x, email: admin || !m ? x.email : null, member_id: m?.id ?? null, refused: db.refused.includes(x.user_id), asked: db.club_join_requests.find(z => z.user_id === x.user_id)?.name ?? null };
          }) as T;
        }
        case 'club_validate_account': {
          needStaff();
          const account = db.accounts.find(x => x.user_id === a.p_user);
          if (!account) throw new Error('Ce compte n\'existe plus.');
          if (!account.confirmed) throw new Error('L\'adresse de ce compte n\'est pas encore confirmée.');
          if (db.club_members.some(m => m.user_id === a.p_user)) throw new Error('Ce compte est déjà rattaché à un adhérent.');
          const m = db.club_members.find(x => x.id === a.p_member);
          if (a.p_member && (!m || m.user_id)) throw new Error('Cette fiche est déjà rattachée à un compte.');
          const next: Member = { id: uid(), name: String(a.p_name ?? account.username), created_at: new Date().toISOString(), ...m, user_id: a.p_user, active: true, role: m && m.role !== 'member' ? m.role : a.p_role };
          guardMember(m ?? null, next);
          if (m) Object.assign(m, next); else db.club_members.push(next);
          db.club_join_requests = db.club_join_requests.filter(x => x.user_id !== a.p_user);
          db.refused = db.refused.filter(x => x !== a.p_user);
          return done(next.id);
        }
        case 'club_register': {
          const m = me();
          if (!m) throw new Error('Ton compte n\'est pas encore rattaché à un adhérent.');
          if (t?.status !== 'open') throw new Error('Les inscriptions ne sont pas ouvertes.');
          let e = db.club_entries.find(x => x.tournament_id === t.id && x.member_id === m.id);
          if (e && e.status !== 'cancelled') return done(e.status);
          const taken = db.club_entries.filter(x => x.tournament_id === t.id && x.status === 'registered').length;
          const status = t.max_players === null || taken < t.max_players ? 'registered' : 'waitlist';
          if (e) Object.assign(e, { status, registered_at: new Date().toISOString(), checked_in: false, table_no: null, seat_no: null });
          else {
            e = { ...(DEFAULTS.club_entries!() as Entry), id: uid(), tournament_id: t.id, member_id: m.id, name: m.name, status };
            db.club_entries.push(e);
          }
          return done(status);
        }
        case 'club_unregister': {
          const m = me();
          if (!t || !['open', 'closed'].includes(t.status)) throw new Error('Le tournoi a commencé : préviens l\'organisateur.');
          const e = db.club_entries.find(x => x.tournament_id === t.id && x.member_id === m?.id);
          if (e) Object.assign(e, { status: 'cancelled', checked_in: false, table_no: null, seat_no: null });
          promote(t.id);
          return done();
        }
        case 'club_set_clock': {
          needStaff();
          if (!t || t.status === 'finished' || t.status === 'cancelled') return done();
          t.clock_level = Math.max(0, a.p_level);
          t.clock_elapsed_ms = a.p_elapsed_ms;
          t.clock_anchor = a.p_running ? new Date().toISOString() : null;
          if (a.p_running && ['draft', 'open', 'closed'].includes(t.status)) t.status = 'running';
          return done();
        }
        case 'club_hu_round': {
          // Mêmes règles que club_hu_round (004_club_hu.sql).
          needStaff();
          if (!t) throw new Error('Tournoi introuvable.');
          if (t.status === 'finished' || t.status === 'cancelled') throw new Error('Tournoi terminé : rouvre-le pour changer les tours.');
          const mine = db.club_hu_matches.filter(m => m.tournament_id === t.id);
          const last = Math.max(0, ...mine.map(m => m.round));
          const round = a.p_round as number;
          const drop = () => { db.club_hu_matches = db.club_hu_matches.filter(m => !(m.tournament_id === t.id && m.round === round)); };
          if (a.p_pairs === null) {
            if (round !== last) throw new Error('Le tableau a changé : recharge la page.');
            drop();
            return done();
          }
          const pairs = a.p_pairs as { a: string; b: string | null }[];
          if (!pairs.length) throw new Error('Aucun match à tirer.');
          if (a.p_replace) {
            if (round !== last) throw new Error('Le tableau a changé : recharge la page.');
            if (mine.some(m => m.round === round && m.winner)) throw new Error('Des résultats sont saisis : ce tour ne se retire plus au sort.');
          } else if (round !== last + 1) throw new Error('Ce tour a déjà été tiré : recharge la page.');
          else if (mine.some(m => m.round === last && m.b && !m.winner)) throw new Error('Le tour en cours n\'est pas fini.');
          const ids = pairs.flatMap(p => p.b ? [p.a, p.b] : [p.a]);
          if (new Set(ids).size !== ids.length) throw new Error('Un joueur figure deux fois dans ce tour.');
          if (ids.some(x => !db.club_entries.some(e => e.id === x && e.tournament_id === t.id))) throw new Error('Joueur inconnu.');
          if (a.p_replace) drop();
          const at = Date.now();
          pairs.forEach((p, i) => db.club_hu_matches.push({
            id: uid(), tournament_id: t.id, round, playoff: !!a.p_playoff, a: p.a, b: p.b, winner: null, created_at: new Date(at + i).toISOString(),
          }));
          if (['draft', 'open', 'closed'].includes(t.status)) t.status = 'running';
          return done();
        }
        case 'club_save_seats': {
          needStaff();
          for (const s of a.p_seats as { entry_id: string; table_no: number | null; seat_no: number | null }[]) {
            const e = db.club_entries.find(x => x.id === s.entry_id && x.tournament_id === a.p_tournament);
            if (e) { e.table_no = s.table_no; e.seat_no = s.seat_no; }
          }
          return done();
        }
        case 'club_finish': {
          needStaff();
          const results = a.p_results as { entry_id: string; position: number; kos: number; bounty: number }[];
          for (const e of db.club_entries.filter(x => x.tournament_id === a.p_tournament)) {
            const r = results.find(x => x.entry_id === e.id);
            e.final_position = r?.position ?? null;
            e.final_kos = r?.kos ?? null;
            e.final_bounty = r?.bounty ?? null;
          }
          if (t) {
            if (t.clock_anchor) t.clock_elapsed_ms += Date.now() - Date.parse(t.clock_anchor);
            Object.assign(t, { status: 'finished', finished_at: t.finished_at ?? new Date().toISOString(), clock_anchor: null });
          }
          return done();
        }
        case 'club_reopen': {
          needStaff();
          for (const e of db.club_entries.filter(x => x.tournament_id === a.p_tournament)) Object.assign(e, { final_position: null, final_kos: null, final_bounty: null });
          if (t?.status === 'finished') Object.assign(t, { status: 'running', finished_at: null });
          return done();
        }
        default: throw new Error(`Fonction inconnue : ${fn}`);
      }
    },

    watch(cb) { watchers.add(cb); return () => { watchers.delete(cb); }; },
    watchBar: cb => bar.watch(cb),
  };
  return api;
}
