/** Contexte de l'application : données, compte, rôle ; et chargements partagés. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MissingRpc, NotInstalled, messageOf, type Api, type AuthUser } from './api';
import { createDemoApi, type DemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';
import { withScoring, withSettings, type Account, type AccountStatus, type Championship, type Entry, type JoinRequest, type Knockout, type Member, type Payment, type Tournament } from './types';

export const isDemo = new URLSearchParams(location.search).has('demo');
export const api: Api = isDemo ? createDemoApi() : createSupabaseApi();
export const demo = isDemo ? (api as DemoApi) : null;

interface Club {
  ready: boolean;
  installed: boolean;
  user: AuthUser | null;
  me: Member | null;
  request: JoinRequest | null;
  /** Validation du compte ; nul si inconnue (script 002 absent, hors ligne). */
  account: AccountStatus | null;
  /** Comptes à valider, pour l'équipe du club. */
  pending: number;
  isStaff: boolean;
  isAdmin: boolean;
  recovering: boolean;
  doneRecovering: () => void;
  refresh: () => Promise<void>;
}
const Ctx = createContext<Club>(null!);
export const useClub = () => useContext(Ctx);

type Who = Pick<Club, 'user' | 'me' | 'request' | 'account' | 'pending'>;
const NOBODY: Who = { user: null, me: null, request: null, account: null, pending: 0 };
const optional = <T,>(p: Promise<T>, otherwise: T) => p.catch(() => otherwise);

async function whoIs(user: AuthUser): Promise<Who> {
  const [m] = await api.select<Member>('club_members', { eq: { user_id: user.id } });
  if (!m) {
    const [[request], account] = await Promise.all([
      api.select<JoinRequest>('club_join_requests', { eq: { user_id: user.id } }),
      optional(api.rpc<AccountStatus | null>('club_account_status'), null),
    ]);
    // Le script 002 sait qu'une fiche existe même si on ne la voit pas : ancien adhérent.
    return { user, me: null, request: request ?? null, account, pending: 0 };
  }
  const me = m.active ? m : null;
  const pending = me && me.role !== 'member' ? await optional(api.rpc<number>('club_pending_count'), 0) : 0;
  return { user, me, request: null, account: 'ok', pending };
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Who & { ready: boolean; installed: boolean }>({ ...NOBODY, ready: false, installed: true });
  const [recovering, setRecovering] = useState(false);

  const refresh = useCallback(async () => {
    const user = await api.user();
    try {
      // Sans compte, une lecture suffit à savoir si la base est installée.
      if (!user) await api.select('club_championships', { eq: { status: 'active' } });
      setState({ ready: true, installed: true, ...(user ? await whoIs(user) : NOBODY) });
    } catch (e) {
      setState(s => ({ ...s, ready: true, installed: !(e instanceof NotInstalled), user }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    let last: string | null | undefined;
    return api.onAuth((u, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // Le rafraîchissement du jeton ne change pas l'utilisateur : inutile de tout recharger.
      if (event === 'TOKEN_REFRESHED' || (api.kind === 'cloud' && u?.id === last)) return;
      last = u?.id ?? null;
      // Hors du rappel de supabase-js : y lancer une requête bloquerait la session.
      setTimeout(() => void refresh(), 0);
    });
  }, [refresh]);

  // Rôle changé ou compte validé entre-temps : visible au retour sur l'onglet, sans recharger la page.
  useEffect(() => {
    let last = Date.now();
    const back = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 10_000) return;
      last = Date.now();
      try {
        const user = await api.user();
        if (!user) return; // Une déconnexion passe par onAuth.
        const who = await whoIs(user);
        const same = (s: Who) => JSON.stringify([s.me, s.request, s.account, s.pending]);
        setState(s => s.user?.id !== user.id || same(s) === same(who) ? s : { ...s, ...who });
      } catch { /* hors ligne : on garde ce que l'on sait */ }
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, []);

  const role = state.me?.role;
  const value = useMemo<Club>(() => ({
    ...state,
    isStaff: role === 'director' || role === 'admin',
    isAdmin: role === 'admin',
    recovering,
    doneRecovering: () => setRecovering(false),
    refresh,
  }), [state, role, recovering, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── Chargements ──────────────────────────────────────────────────────────────

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; reload: () => Promise<void> }

/** Charge, garde l'ancienne valeur pendant un rechargement, et se met à jour en direct si demandé. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], live?: { tournamentId?: string }): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useRef(0);

  const reload = useCallback(async () => {
    const n = ++run.current;
    try {
      const d = await fnRef.current();
      if (n === run.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === run.current) setError(messageOf(e));
    } finally {
      if (n === run.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); setData(null); void reload(); }, deps);

  const isLive = !!live;
  const only = live?.tournamentId;
  useEffect(() => {
    if (!isLive) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => void reload(), 120); };
    const stop = api.watch(id => { if (!only || !id || id === only) soon(); });
    // Filet de sécurité si le temps réel est coupé, et au retour sur l'onglet.
    const poll = setInterval(() => { if (document.visibilityState === 'visible') soon(); }, 20_000);
    const back = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('online', back);
    return () => {
      stop(); clearInterval(poll); clearTimeout(timer);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('online', back);
    };
  }, [isLive, only, reload]);

  return { data, error, loading, reload };
}

export const fixTournament = (t: Tournament): Tournament => ({
  ...t, settings: withSettings(t.settings), clock_elapsed_ms: Number(t.clock_elapsed_ms), levels: t.levels ?? [], chips: t.chips ?? [],
});
const numOrNull = (x: unknown) => x === null || x === undefined ? null : Number(x);
/** Les colonnes « numeric » peuvent revenir en texte. */
export const fixEntry = (e: Entry): Entry => ({
  ...e, bounty_start: numOrNull(e.bounty_start), points_adjust: Number(e.points_adjust),
  final_kos: numOrNull(e.final_kos), final_bounty: numOrNull(e.final_bounty),
});
export const fixChampionship = (c: Championship): Championship => ({ ...c, scoring: withScoring(c.scoring) });
export const fixKnockout = (k: Knockout): Knockout => ({ ...k, seq: Number(k.seq) });

export async function listTournaments(): Promise<Tournament[]> {
  return (await api.select<Tournament>('club_tournaments', { order: ['starts_at', 'desc'] })).map(fixTournament);
}
export async function listChampionships(): Promise<Championship[]> {
  return (await api.select<Championship>('club_championships', { order: ['created_at', 'desc'] })).map(fixChampionship);
}
export async function listMembers(): Promise<Member[]> {
  return (await api.select<Member>('club_members')).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
/** Comptes de la suite ; null tant que 002_club_accounts.sql n'est pas exécuté. */
export async function listAccounts(): Promise<Account[] | null> {
  try {
    return await api.rpc<Account[]>('club_accounts');
  } catch (e) {
    if (e instanceof MissingRpc) return null;
    throw e;
  }
}
/** Découpage : une adresse trop longue serait refusée. */
async function selectIn<T>(table: 'club_entries' | 'club_knockouts', ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 60) out.push(...await api.select<T>(table, { in: ['tournament_id', ids.slice(i, i + 60)] }));
  return out;
}
export async function entriesOf(ids: string[]): Promise<Entry[]> {
  return (await selectIn<Entry>('club_entries', ids)).map(fixEntry);
}
export async function knockoutsOf(ids: string[]): Promise<Knockout[]> {
  return (await selectIn<Knockout>('club_knockouts', ids)).map(fixKnockout);
}

export interface TournamentBundle {
  t: Tournament;
  entries: Entry[];
  knockouts: Knockout[];
  paid: Set<string>;
  championship: Championship | null;
}

export function useTournament(id: string, isStaff: boolean): Loaded<TournamentBundle | 'missing'> {
  return useLoad(async () => {
    const [t] = await api.select<Tournament>('club_tournaments', { eq: { id } });
    if (!t) return 'missing' as const;
    const [entries, knockouts, payments, champs] = await Promise.all([
      api.select<Entry>('club_entries', { eq: { tournament_id: id }, order: ['registered_at', 'asc'] }),
      api.select<Knockout>('club_knockouts', { eq: { tournament_id: id }, order: ['seq', 'asc'] }),
      isStaff ? api.select<Payment>('club_payments', { eq: { tournament_id: id } }) : Promise.resolve([]),
      t.championship_id ? api.select<Championship>('club_championships', { eq: { id: t.championship_id } }) : Promise.resolve([]),
    ]);
    return {
      t: fixTournament(t),
      entries: entries.map(fixEntry),
      knockouts: knockouts.map(fixKnockout),
      paid: new Set(payments.map(p => p.entry_id)),
      championship: champs[0] ? fixChampionship(champs[0]) : null,
    };
  }, [id, isStaff], { tournamentId: id });
}

/** Heure du serveur, rafraîchie régulièrement. */
export function useNow(every = 250): number {
  const [now, setNow] = useState(() => api.now());
  useEffect(() => {
    const i = setInterval(() => setNow(api.now()), every);
    return () => clearInterval(i);
  }, [every]);
  return now;
}

/** Garde l'écran allumé pendant le tournoi (si l'appareil le permet). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const ask = () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(l => { lock = l; }).catch(() => {}); };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => { document.removeEventListener('visibilitychange', ask); void lock?.release(); };
  }, [active]);
}
