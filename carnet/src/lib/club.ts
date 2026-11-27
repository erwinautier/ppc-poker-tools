/**
 * Ce qui passe par la base du club : compte, horloge des tournois en cours, et
 * mains soumises au vote (script club-manager/supabase/005_carnet.sql).
 * « ?demo » dans l'adresse : un club fictif dans le navigateur, rien n'est envoyé.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ClubTournament } from './levels';
import { sanitize, type HandData } from './hand';
import { readOptions, type Results, type VoteOption } from './vote';
import { demoClub } from './demoClub';

export interface User { id: string; email: string }

export interface Post {
  id: string;
  author_name: string | null;
  mine: boolean;
  hand: HandData;
  options: VoteOption[];
  hidden: boolean;
  created_at: string;
  votes: number;
  my_vote: number | null;
  my_reasons: number[];
  /** Totaux : après son vote, pour l'auteur et pour l'équipe ; sinon null. */
  results: Results | null;
}

export interface Feed {
  member: boolean;
  staff: boolean;
  /** Compte connecté mais pas encore validé par le club. */
  pending: boolean;
  posts: Post[];
}

export interface ClubApi {
  kind: 'cloud' | 'demo';
  user(): Promise<User | null>;
  onAuth(cb: (u: User | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  running(): Promise<ClubTournament[]>;
  feed(id?: string): Promise<Feed>;
  publish(hand: HandData, options: VoteOption[], showName: boolean): Promise<string>;
  vote(id: string, choice: number, reasons: number[]): Promise<void>;
  remove(id: string): Promise<void>;
  hide(id: string, hidden: boolean): Promise<void>;
}

/** Le script 005 n'est pas encore exécuté. */
export class NotInstalled extends Error {}

export function messageOf(e: unknown): string {
  if (e instanceof NotInstalled) return 'La base du club n\'est pas encore à jour : un administrateur doit exécuter le script 005_carnet.sql.';
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return 'Pas de connexion pour l\'instant. Réessaie dans un moment.';
  if (/invalid login credentials/i.test(raw)) return 'Adresse ou mot de passe incorrect.';
  if (/email not confirmed/i.test(raw)) return 'Adresse non confirmée : ouvre le lien reçu par e-mail.';
  if (/for security purposes|rate limit/i.test(raw)) return 'Trop de demandes : patiente une minute avant de réessayer.';
  return raw;
}

// ── La vraie base ────────────────────────────────────────────────────────────

// Même projet et même session que le reste de la suite.
const SUPABASE_URL = 'https://kbkxzvsgusakjgmnbbmx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3h6dnNndXNha2pnbW5iYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzI2ODgsImV4cCI6MjA5Njc0ODY4OH0.Wwp7pgRNQVi1bQ94Fogk_GwYbfNratRpus4pUjzkzAo';

const COLUMNS = 'id,name,status,levels,seats_per_table,starting_stack,clock_level,clock_elapsed_ms,clock_anchor';

function readPost(x: Record<string, unknown>): Post | null {
  const hand = sanitize(x.hand);
  const options = readOptions(x.options);
  if (!hand || options.length < 2 || typeof x.id !== 'string') return null;
  const r = x.results as Results | null;
  return {
    id: x.id,
    author_name: typeof x.author_name === 'string' ? x.author_name : null,
    mine: x.mine === true,
    hand, options,
    hidden: x.hidden === true,
    created_at: String(x.created_at ?? ''),
    votes: Number(x.votes) || 0,
    my_vote: typeof x.my_vote === 'number' ? x.my_vote : null,
    my_reasons: Array.isArray(x.my_reasons) ? x.my_reasons.filter((n): n is number => typeof n === 'number') : [],
    results: r && Array.isArray(r.counts) ? { total: Number(r.total) || 0, counts: r.counts.map(Number), reasons: Array.isArray(r.reasons) ? r.reasons.map(l => (Array.isArray(l) ? l.map(Number) : [])) : [] } : null,
  };
}
export const readPosts = (list: unknown): Post[] =>
  Array.isArray(list) ? list.flatMap(x => { const p = x && typeof x === 'object' ? readPost(x as Record<string, unknown>) : null; return p ? [p] : []; }) : [];

function cloudClub(): ClubApi {
  let client: SupabaseClient | null = null;
  const sb = () => (client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, storageKey: 'ppc-auth' } }));
  const asUser = (u: { id: string; email?: string } | null | undefined): User | null => (u ? { id: u.id, email: u.email ?? '' } : null);
  function check(error: { code?: string; message: string } | null) {
    if (!error) return;
    if (error.code === 'PGRST202' || error.code === '42883' || error.code === 'PGRST205' || error.code === '42P01') throw new NotInstalled(error.message);
    throw new Error(error.message);
  }
  async function rpc<T>(fn: string, args?: object): Promise<T> {
    const { data, error } = await sb().rpc(fn, args);
    check(error);
    return data as T;
  }
  return {
    kind: 'cloud',
    async user() {
      const { data } = await sb().auth.getSession();
      return asUser(data.session?.user);
    },
    onAuth(cb) {
      const { data } = sb().auth.onAuthStateChange((_e, session) => cb(asUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email, password });
      check(error);
    },
    async signOut() {
      // Cet appareil seulement, comme dans Le Club.
      const { error } = await sb().auth.signOut({ scope: 'local' });
      check(error);
    },
    async running() {
      const { data, error } = await sb().from('club_tournaments').select(COLUMNS).eq('status', 'running').order('starts_at');
      if (error) return [];
      return (data ?? []) as unknown as ClubTournament[];
    },
    async feed(id) {
      const f = await rpc<{ member: boolean; staff: boolean; hands: unknown }>('carnet_feed', { p_id: id ?? null });
      let pending = false;
      if (!f.member) {
        const status = await rpc<string>('club_account_status').catch(() => null);
        pending = status === 'pending';
      }
      return { member: f.member, staff: f.staff, pending, posts: readPosts(f.hands) };
    },
    async publish(hand, options, showName) {
      return rpc<string>('carnet_publish', { p_hand: hand, p_options: options, p_show_name: showName });
    },
    async vote(id, choice, reasons) {
      await rpc('carnet_vote', { p_hand: id, p_choice: choice, p_reasons: reasons });
    },
    async remove(id) {
      await rpc('carnet_delete', { p_hand: id });
    },
    async hide(id, hidden) {
      await rpc('carnet_hide', { p_hand: id, p_hidden: hidden });
    },
  };
}

export const isDemo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
export const club: ClubApi = isDemo ? demoClub() : cloudClub();
