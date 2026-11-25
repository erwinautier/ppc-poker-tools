import { createClient } from '@supabase/supabase-js';
import { DbError, MissingRpc, NotInstalled, keyOf, type Api, type AuthUser, type Query, type TableName } from './api';

// Même projet et même session que le Range Editor et le Trainer.
const SUPABASE_URL = 'https://kbkxzvsgusakjgmnbbmx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3h6dnNndXNha2pnbW5iYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzI2ODgsImV4cCI6MjA5Njc0ODY4OH0.Wwp7pgRNQVi1bQ94Fogk_GwYbfNratRpus4pUjzkzAo';

const PAGE = 1000;

export function createSupabaseApi(): Api {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, storageKey: 'ppc-auth' },
  });

  function check(error: { code?: string; message: string } | null) {
    if (!error) return;
    if (error.code === 'PGRST205' || error.code === '42P01') throw new NotInstalled(error.message);
    if (error.code === 'PGRST202' || error.code === '42883') throw new MissingRpc(error.message, error.code);
    throw new DbError(error.message, error.code);
  }
  const asUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null =>
    u ? { id: u.id, email: u.email ?? '' } : null;

  // Décalage entre l'appareil et le serveur (meilleure mesure = aller-retour le plus court).
  let offset = 0;
  let bestTrip = Infinity;
  async function sync() {
    const t0 = Date.now();
    const { data, error } = await sb.rpc('club_now');
    const t1 = Date.now();
    if (error || typeof data !== 'number') return;
    if (t1 - t0 <= bestTrip + 50) {
      bestTrip = Math.min(bestTrip, t1 - t0);
      offset = data - (t0 + t1) / 2;
    }
  }
  void sync().then(sync).catch(() => {});
  setInterval(() => { bestTrip += 100; void sync().catch(() => {}); }, 5 * 60_000);

  const watchers = new Set<(id: string | null) => void>();
  let channel: ReturnType<typeof sb.channel> | null = null;
  function listen() {
    if (channel) return;
    channel = sb.channel('club-tournois')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_tournaments' }, p => {
        const row = (p.new && 'id' in p.new ? p.new : p.old) as { id?: string };
        watchers.forEach(w => w(row?.id ?? null));
      })
      // Après une coupure, on ne sait pas ce qui a changé : on recharge.
      .subscribe(s => { if (s === 'SUBSCRIBED') watchers.forEach(w => w(null)); });
  }

  const barWatchers = new Set<() => void>();
  let barChannel: ReturnType<typeof sb.channel> | null = null;
  function listenBar() {
    if (barChannel) return;
    barChannel = sb.channel('club-buvette')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'club_bar_settings' }, () => barWatchers.forEach(w => w()))
      .subscribe(s => { if (s === 'SUBSCRIBED') barWatchers.forEach(w => w()); });
  }

  return {
    kind: 'cloud',
    now: () => Date.now() + offset,

    async user() {
      const { data } = await sb.auth.getSession();
      return asUser(data.session?.user);
    },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => cb(asUser(session?.user), event));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      check(error);
    },
    async signUp(email, password, username) {
      const { error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
      check(error);
    },
    async signOut() {
      // Cet appareil seulement : l'écran géant, connecté au même compte, doit rester ouvert.
      const { error } = await sb.auth.signOut({ scope: 'local' });
      check(error);
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}${import.meta.env.BASE_URL}`,
      });
      check(error);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      check(error);
    },

    async select<T>(table: TableName, q: Query = {}) {
      const out: T[] = [];
      for (let from = 0; ; from += PAGE) {
        let req = sb.from(table).select('*');
        for (const [k, v] of Object.entries(q.eq ?? {})) req = req.eq(k, v);
        if (q.in) req = req.in(q.in[0], q.in[1]);
        if (q.order) req = req.order(q.order[0], { ascending: q.order[1] === 'asc' });
        // Ordre total : indispensable pour que la pagination ne saute ni ne répète aucune ligne.
        req = req.order(table === 'club_payments' ? 'entry_id' : table === 'club_join_requests' ? 'user_id' : 'id');
        const { data, error } = await req.range(from, from + PAGE - 1);
        check(error);
        out.push(...((data ?? []) as T[]));
        if (!data || data.length < PAGE) return out;
      }
    },
    async insert<T>(table: TableName, rows: object | object[]) {
      const { data, error } = await sb.from(table).insert(rows).select();
      check(error);
      return (data ?? []) as T[];
    },
    async update(table, id, patch) {
      const { data, error } = await sb.from(table).update(patch).eq('id', id).select('id');
      check(error);
      if (!data || data.length === 0) throw new Error('Action réservée aux gestionnaires.');
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq(keyOf(table), id);
      check(error);
    },
    async rpc<T>(fn: string, args: object = {}) {
      const { data, error } = await sb.rpc(fn, args);
      check(error);
      return data as T;
    },

    watch(cb) {
      watchers.add(cb);
      listen();
      return () => { watchers.delete(cb); };
    },
    watchBar(cb) {
      barWatchers.add(cb);
      listenBar();
      return () => { barWatchers.delete(cb); };
    },
  };
}
