/**
 * Le vrai client (supabaseApi) contre le vrai schéma : un relais imite l'API
 * REST de Supabase au-dessus de PGlite. Aucun appel ne sort de la machine.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { MissingRpc, NotInstalled, messageOf, type Api } from '../src/lib/api';
import { DEFAULT_SCORING, DEFAULT_SETTINGS, type Account, type Championship, type Entry, type HuMatch, type JoinRequest, type Knockout, type Member, type Payment, type Structure, type Tournament } from '../src/lib/types';
import { generateLevels, PRESETS, DEFAULT_CHIPS } from '../src/lib/structure';

const SQL = readFileSync(new URL('../supabase/001_club.sql', import.meta.url), 'utf8');
const SQL2 = readFileSync(new URL('../supabase/002_club_accounts.sql', import.meta.url), 'utf8');
const SQL3 = readFileSync(new URL('../supabase/003_club_bar.sql', import.meta.url), 'utf8');
const SQL4 = readFileSync(new URL('../supabase/004_club_hu.sql', import.meta.url), 'utf8');
const USERS: Record<string, string> = {
  admin: '00000000-0000-0000-0000-0000000000b1',
  alice: '00000000-0000-0000-0000-0000000000b2',
  zoe: '00000000-0000-0000-0000-0000000000b3',
  tom: '00000000-0000-0000-0000-0000000000b4',
  lea: '00000000-0000-0000-0000-0000000000b5',
};
let db: PGlite;
let api: Api;
const logouts: (string | null)[] = [];

const id = (s: string) => `"${s.replace(/"/g, '')}"`;
const json = (body: unknown, status = 200) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let offline = false;
async function relay(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (offline) throw new TypeError('fetch failed');
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (!url.hostname.endsWith('.supabase.co')) throw new Error(`appel inattendu : ${url.hostname}`);
  const text = await req.text();
  const body = text ? JSON.parse(text) : undefined;
  if (url.pathname.startsWith('/auth/v1/token')) {
    const who = String(body.email).split('@')[0];
    if (!USERS[who]) return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
    return json({ access_token: who, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: USERS[who], email: body.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } });
  }
  if (url.pathname === '/auth/v1/logout') logouts.push(url.searchParams.get('scope'));
  if (url.pathname.startsWith('/auth/v1/')) return json({});

  const who = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const uid = USERS[who];
  const path = url.pathname.replace('/rest/v1/', '');
  const where: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(k)) continue;
    if (v.startsWith('eq.')) { params.push(v.slice(3)); where.push(`${id(k)}::text = $${params.length}`); }
    else if (v.startsWith('in.(')) { params.push(v.slice(4, -1).split(',').map(x => x.replace(/^"|"$/g, ''))); where.push(`${id(k)}::text = any ($${params.length}::text[])`); }
    else throw new Error(`filtre non prévu : ${k}=${v}`);
  }
  const cond = where.length ? ` where ${where.join(' and ')}` : '';
  try {
    return await db.transaction(async tx => {
      await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
      if (path.startsWith('rpc/')) {
        const fn = path.slice(4);
        const args = Object.entries(body ?? {});
        const { rows } = await tx.query<{ r: unknown }>(
          `select ${id(fn)}(${args.map(([k], i) => `${id(k)} => $${i + 1}`).join(', ')}) as r`,
          args.map(([, v]) => typeof v === 'object' && v !== null ? JSON.stringify(v) : v));
        return json(rows[0]?.r ?? null);
      }
      if (req.method === 'GET') {
        const order = (url.searchParams.get('order') ?? '').split(',').filter(Boolean).map(o => { const [c, d] = o.split('.'); return `${id(c)} ${d === 'desc' ? 'desc' : 'asc'}`; });
        const { rows } = await tx.query(`select * from ${id(path)}${cond}${order.length ? ` order by ${order.join(', ')}` : ''} limit ${Number(url.searchParams.get('limit') ?? 1000)} offset ${Number(url.searchParams.get('offset') ?? 0)}`, params);
        return json(rows);
      }
      if (req.method === 'POST') {
        const list = Array.isArray(body) ? body : [body];
        const cols = [...new Set(list.flatMap(r => Object.keys(r)))].map(id).join(', ');
        const { rows } = await tx.query(`insert into ${id(path)} (${cols}) select ${cols} from json_populate_recordset(null::${id(path)}, $1) returning *`, [JSON.stringify(list)]);
        return json(rows, 201);
      }
      if (req.method === 'PATCH') {
        const cols = Object.keys(body).map(id);
        params.push(JSON.stringify(body));
        const { rows } = await tx.query(`update ${id(path)} t set ${cols.map(c => `${c} = x.${c}`).join(', ')} from json_populate_record(null::${id(path)}, $${params.length}) x${cond.replace(/"(\w+)"::text/g, 't."$1"::text')} returning t.id`, params);
        return json(rows);
      }
      await tx.query(`delete from ${id(path)}${cond}`, params);
      return new Response(null, { status: 204 });
    });
  } catch (e) {
    const x = e as { code?: string; message: string };
    return json({ code: x.code === '42P01' ? 'PGRST205' : x.code, message: x.message, details: null, hint: null }, 400);
  }
}

async function login(who: string) { await api.signOut(); await api.signIn(`${who}@exemple.test`, 'mot-de-passe'); }

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth, public to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), created_at timestamptz default now());
    create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, username text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const [k, v] of Object.entries(USERS).filter(([k]) => k !== 'lea')) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [v, `${k}@exemple.test`]);
    await db.query('insert into profiles values ($1, $2)', [v, `pseudo-${k}`]);
  }
  vi.stubGlobal('fetch', relay);
  vi.stubGlobal('location', { origin: 'http://localhost' });
  const { createSupabaseApi } = await import('../src/lib/supabaseApi');
  api = createSupabaseApi();
});
afterAll(() => vi.unstubAllGlobals());

it('base absente : reconnue comme telle', async () => {
  await expect(api.select('club_championships')).rejects.toBeInstanceOf(NotInstalled);
  await db.exec(SQL);
  expect(await api.select('club_championships')).toEqual([]);
  await db.query(`select club_bootstrap_admin('admin@exemple.test', 'Admin')`);
});

it('mauvais mot de passe : message clair', async () => {
  await api.signIn('inconnu@exemple.test', 'x').then(() => { throw new Error('accepté'); }, e => expect(messageOf(e)).toBe('Adresse ou mot de passe incorrect.'));
});

it('une saison complète, avec les données exactes que l\'application envoie', async () => {
  await login('admin');
  expect((await api.user())?.id).toBe(USERS.admin);
  const [me] = await api.select<Member>('club_members', { eq: { user_id: USERS.admin } });
  expect(me.role).toBe('admin');
  expect(Math.abs(api.now() - Date.now())).toBeLessThan(2000);

  // Préparation
  const [alice] = await api.insert<Member>('club_members', [{ name: 'Alice' }, { name: 'Bob' }]);
  const structures = await api.insert<Structure>('club_structures', PRESETS.map(p => ({ name: p.name, description: p.description, starting_stack: p.stack, levels: generateLevels(p.input), chips: DEFAULT_CHIPS })));
  expect(structures.length).toBe(3);
  const [c] = await api.insert<Championship>('club_championships', { name: 'Saison', season: '2026-2027', description: '', status: 'active', visibility: 'members', scoring: DEFAULT_SCORING });
  expect(c.scoring.brackets[0].points[0]).toBe(100);
  const [t] = await api.insert<Tournament>('club_tournaments', {
    championship_id: c.id, name: 'Manche 1', description: '', venue: '', starts_at: new Date().toISOString(), visibility: 'members', max_players: 3, seats_per_table: 8,
    starting_stack: 20000, structure_name: structures[1].name, levels: structures[1].levels, chips: structures[1].chips,
    settings: { ...DEFAULT_SETTINGS, bounty: { mode: 'fixed', unit: 'pts', amount: 3 } }, status: 'open',
  });
  expect(t).toMatchObject({ status: 'open', clock_level: 0, clock_anchor: null });

  // Une adhérente demande son rattachement, est validée, puis s'inscrit.
  await login('alice');
  expect(await api.select('club_tournaments')).toEqual([]);
  await api.rpc('club_request_join', { p_name: 'Alice' });
  expect((await api.select<JoinRequest>('club_join_requests', { eq: { user_id: USERS.alice } })).length).toBe(1);
  await login('admin');
  await api.rpc('club_approve_request', { p_user: USERS.alice, p_member: alice.id });
  await login('alice');
  expect(await api.rpc('club_register', { p_tournament: t.id })).toBe('registered');
  await expect(api.update('club_tournaments', t.id, { name: 'Piraté' })).rejects.toThrow(/gestionnaires/);
  await expect(api.insert('club_entries', { tournament_id: t.id, name: 'x', member_id: null, status: 'registered' }).catch(e => { throw new Error(messageOf(e)); })).rejects.toThrow(/gestionnaires/);

  // Refus d'une demande
  await login('zoe');
  await api.rpc('club_request_join', { p_name: 'Zoé' });
  await login('admin');
  await api.remove('club_join_requests', USERS.zoe);
  expect(await api.select('club_join_requests')).toEqual([]);

  // Le soir
  const bob = (await api.select<Member>('club_members', { order: ['name', 'asc'] })).find(m => m.name === 'Bob')!;
  const added = await api.insert<Entry>('club_entries', [{ tournament_id: t.id, member_id: bob.id, name: bob.name, status: 'registered' }, { tournament_id: t.id, member_id: null, name: 'Paol', status: 'registered' }]);
  expect(added.length).toBe(2);
  const entries = await api.select<Entry>('club_entries', { eq: { tournament_id: t.id }, order: ['registered_at', 'asc'] });
  expect(entries.map(e => e.name).sort()).toEqual(['Alice', 'Bob', 'Paol']);
  const by = (n: string) => entries.find(e => e.name === n)!;
  for (const e of entries) await api.update('club_entries', e.id, { status: 'registered', checked_in: true });
  await api.update('club_entries', by('Bob').id, { bounty_start: 10, points_adjust: -2.5 });
  await api.insert('club_payments', { entry_id: by('Bob').id, tournament_id: t.id });
  expect((await api.select<Payment>('club_payments', { eq: { tournament_id: t.id } })).map(p => p.entry_id)).toEqual([by('Bob').id]);
  await api.remove('club_payments', by('Bob').id);
  expect(await api.select('club_payments', { eq: { tournament_id: t.id } })).toEqual([]);
  await api.rpc('club_save_seats', { p_tournament: t.id, p_seats: entries.map((e, i) => ({ entry_id: e.id, table_no: 1, seat_no: i + 1 })) });
  await api.rpc('club_set_clock', { p_tournament: t.id, p_level: 0, p_elapsed_ms: 0, p_running: true });
  const running = (await api.select<Tournament>('club_tournaments', { eq: { id: t.id } }))[0];
  expect(running.status).toBe('running');
  expect(Math.abs(Date.parse(String(running.clock_anchor)) - Date.now())).toBeLessThan(5000);
  expect(Number(running.rev)).toBeGreaterThan(0);

  const [k1] = await api.insert<Knockout>('club_knockouts', { tournament_id: t.id, victim_id: by('Bob').id, killer_ids: [by('Alice').id, by('Paol').id], rebuy: false, level: 1 });
  expect(Number(k1.seq)).toBeGreaterThan(0);
  expect(k1.killer_ids).toEqual([by('Alice').id, by('Paol').id]);
  await api.insert('club_knockouts', { tournament_id: t.id, victim_id: by('Bob').id, killer_ids: [], rebuy: false, level: 1 })
    .then(() => { throw new Error('accepté'); }, e => expect(messageOf(e)).toBe('Ce joueur est déjà éliminé.'));
  await api.insert('club_entries', { tournament_id: t.id, member_id: bob.id, name: 'Bob', status: 'registered' })
    .then(() => { throw new Error('accepté'); }, e => expect(messageOf(e)).toBe('Cet adhérent est déjà inscrit.'));
  await api.remove('club_knockouts', k1.id);
  const [k2] = await api.insert<Knockout>('club_knockouts', { tournament_id: t.id, victim_id: by('Bob').id, killer_ids: [by('Paol').id], rebuy: false, level: 1 });
  // Changer le tombeur : la ligne se modifie, et toucher le tournoi prévient les écrans connectés.
  const revOf = async () => Number((await api.select<Tournament>('club_tournaments', { eq: { id: t.id } }))[0].rev);
  const rev0 = await revOf();
  await api.update('club_knockouts', k2.id, { killer_ids: [by('Alice').id] });
  await api.update('club_tournaments', t.id, { rev: rev0 + 1 });
  expect(await revOf()).toBeGreaterThan(rev0);
  const [k2b] = await api.select<Knockout>('club_knockouts', { eq: { tournament_id: t.id } });
  expect([k2b.seq, k2b.killer_ids]).toEqual([k2.seq, [by('Alice').id]]);
  await api.rpc('club_finish', { p_tournament: t.id, p_results: [{ entry_id: by('Alice').id, position: 1, kos: 1, bounty: 10 }, { entry_id: by('Paol').id, position: 2, kos: 0, bounty: 0 }, { entry_id: by('Bob').id, position: 3, kos: 0, bounty: 0 }] });

  // Consultation par une adhérente, plusieurs tournois d'un coup
  await login('alice');
  const seen = await api.select<Entry>('club_entries', { in: ['tournament_id', [t.id, c.id]] });
  expect(seen.map(e => [e.name, e.final_position]).sort()).toEqual([['Alice', 1], ['Bob', 3], ['Paol', 2]]);
  expect((await api.select('club_knockouts', { in: ['tournament_id', [t.id]] })).length).toBe(1);
  await expect(api.update('club_knockouts', k2.id, { killer_ids: [] })).rejects.toThrow(/gestionnaires/);

  // Un visiteur ne voit rien d'un tournoi réservé.
  await api.signOut();
  expect(await api.user()).toBeNull();
  expect(await api.select('club_tournaments')).toEqual([]);
  expect(await api.select('club_entries')).toEqual([]);

  await login('admin');
  await api.rpc('club_reopen', { p_tournament: t.id });
  await api.update('club_tournaments', t.id, { status: 'cancelled' });
  await api.remove('club_championships', c.id);
  expect((await api.select<Tournament>('club_tournaments'))[0].championship_id).toBeNull();
  await api.remove('club_tournaments', t.id);
  expect(await api.select('club_entries')).toEqual([]);
});

it('nommer un gestionnaire : en validant sa demande, puis depuis sa fiche', async () => {
  const said = (p: Promise<unknown>) => p.then(() => 'accepté', e => messageOf(e));
  await login('zoe');
  await api.rpc('club_request_join', { p_name: 'Zoé' });
  await login('admin');
  const zoe = await api.rpc<string>('club_approve_request', { p_user: USERS.zoe, p_member: null });
  await api.update('club_members', zoe, { role: 'director' });
  const [me] = await api.select<Member>('club_members', { eq: { user_id: USERS.admin } });
  const [alice] = await api.select<Member>('club_members', { eq: { user_id: USERS.alice } });

  await login('zoe');
  expect((await api.select<Member>('club_members', { eq: { user_id: USERS.zoe } }))[0].role).toBe('director');
  const [t] = await api.insert<Tournament>('club_tournaments', { name: 'Soirée de Zoé', starts_at: new Date().toISOString() });
  await api.update('club_members', alice.id, { name: 'Alice B.' });
  expect(await said(api.update('club_members', alice.id, { role: 'director' }))).toBe('Seul un administrateur peut modifier un gestionnaire.');
  expect(await said(api.update('club_members', zoe, { role: 'admin' }))).toBe('Seul un administrateur peut modifier un gestionnaire.');
  expect(await said(api.remove('club_members', me.id))).toMatch(/Seul un administrateur/);

  await login('admin');
  expect(await said(api.update('club_members', me.id, { role: 'member' }))).toBe('Le club doit garder au moins un administrateur.');
  await api.update('club_members', zoe, { role: 'admin' });
  await api.update('club_members', me.id, { role: 'director' });
  await login('zoe');
  await api.update('club_members', me.id, { role: 'admin' });
  await api.update('club_members', zoe, { role: 'member' });
  expect(await said(api.update('club_tournaments', t.id, { name: 'x' }))).toBe('Action réservée aux gestionnaires.');
  expect(await said(api.rpc('club_set_clock', { p_tournament: t.id, p_level: 0, p_elapsed_ms: 0, p_running: true }))).toBe('Action réservée aux gestionnaires.');
  await login('admin');
  await api.remove('club_tournaments', t.id);
});

it('validation des comptes, avant puis après le second script', async () => {
  await login('admin');
  await expect(api.rpc('club_accounts')).rejects.toBeInstanceOf(MissingRpc);
  await expect(api.rpc('club_account_status')).rejects.toBeInstanceOf(MissingRpc);
  await db.exec(SQL2);
  expect((await api.rpc<Account[]>('club_accounts')).every(a => a.member_id)).toBe(true);
  expect(await api.rpc('club_pending_count')).toBe(0);

  // Un compte créé après la mise en place
  await db.query('insert into auth.users (id, email) values ($1, $2)', [USERS.lea, 'lea@exemple.test']);
  await db.query('insert into profiles values ($1, $2)', [USERS.lea, 'lea22']);
  await login('lea');
  expect(await api.rpc('club_account_status')).toBe('pending');
  await api.rpc('club_request_join', { p_name: 'Léa Riou' });
  await login('admin');
  expect(await api.rpc('club_pending_count')).toBe(1);
  expect((await api.rpc<Account[]>('club_accounts')).find(a => !a.member_id)).toMatchObject({ user_id: USERS.lea, username: 'lea22', asked: 'Léa Riou', email: 'lea@exemple.test', confirmed: true, refused: false });
  await api.rpc('club_refuse_account', { p_user: USERS.lea, p_refuse: true });
  await login('lea');
  expect(await api.rpc('club_account_status')).toBe('refused');
  await login('admin');
  await api.rpc('club_refuse_account', { p_user: USERS.lea, p_refuse: false });
  const id = await api.rpc<string>('club_validate_account', { p_user: USERS.lea, p_member: null, p_name: 'Léa Riou', p_role: 'director' });
  expect((await api.select<Member>('club_members', { eq: { user_id: USERS.lea } }))[0]).toMatchObject({ id, name: 'Léa Riou', role: 'director', active: true });
  await login('lea');
  expect(await api.rpc('club_account_status')).toBe('ok');
  expect((await api.rpc<Account[]>('club_accounts')).every(a => a.email === null)).toBe(true);
});

it('se déconnecter ne ferme la session que sur cet appareil', async () => {
  await login('alice');
  logouts.length = 0;
  await api.signOut();
  expect(logouts).toEqual(['local']);
  expect(await api.user()).toBeNull();
});

it('au-delà de 1 000 lignes, rien ne manque', async () => {
  await login('admin');
  const [t] = await api.insert<Tournament>('club_tournaments', { name: 'Géant', starts_at: new Date().toISOString(), status: 'closed' });
  await db.query(`insert into club_entries (tournament_id, name) select $1, 'J' || i from generate_series(1, 2345) i`, [t.id]);
  const list = await api.select<Entry>('club_entries', { eq: { tournament_id: t.id }, order: ['registered_at', 'asc'] });
  expect(new Set(list.map(e => e.id)).size).toBe(2345);
});

it('la buvette : consos, paiements, coupure de réseau et tablette', async () => {
  const listeners: Record<string, () => void> = {};
  const lost: string[] = [];
  const store = new Map<string, string>();
  vi.stubGlobal('window', { addEventListener: (k: string, f: () => void) => { listeners[k] = f; }, dispatchEvent: (e: CustomEvent<string>) => { lost.push(e.detail); } });
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });
  vi.stubGlobal('CustomEvent', class { detail: unknown; constructor(_: string, o: { detail: unknown }) { this.detail = o.detail; } });
  const { createCloudBar } = await import('../src/lib/cloudBar');
  const { setKiosk, leaveKiosk } = await import('../src/lib/kiosk');
  const bar = createCloudBar(api);
  const said = (x: Promise<unknown>) => x.then(() => 'accepté', e => messageOf(e));
  const settle = () => new Promise(f => setTimeout(f, 120));

  // Avant le script : absente, sans erreur.
  await login('admin');
  expect(await bar.load()).toBeNull();
  await db.exec(SQL3);

  // Tarifs, trésorerie
  await bar.saveItem({ name: 'Café', emoji: '☕', price: 50, active: true });
  await bar.saveItem({ name: 'Bière', emoji: '🍺', price: 200, active: true });
  const d0 = (await bar.load())!;
  expect(d0.items.map(i => [i.name, i.price])).toEqual([['Café', 50], ['Bière', 200]]);
  const [cafe, biere] = d0.items;
  const [alice] = await api.select<Member>('club_members', { eq: { user_id: USERS.alice } });
  await api.update('club_members', alice.id, { treasurer: true });
  expect((await api.select<Member>('club_members', { eq: { user_id: USERS.alice } }))[0].treasurer).toBe(true);
  await api.update('club_members', alice.id, { treasurer: false });

  // Une adhérente consomme, se trompe, paie.
  await login('alice');
  const { id } = await bar.take(alice.id, cafe);
  expect((await bar.take(alice.id, biere, true)).queued).toBe(false);
  await bar.undo(id);
  let a = (await bar.load())!;
  expect([a.manage, a.team, a.slate.due, a.slate.open, a.lines.map(l => [l.label, l.guest, !!l.cancelled_at])]).toEqual([false, null, 200, 200, [['Bière', true, false], ['Café', false, true]]]);
  const [me] = (await api.select<Member>('club_members', { eq: { user_id: USERS.admin } }));
  expect(await said(bar.take(me.id, cafe))).toBe('Tu ne peux noter que tes propres consommations.');
  expect(await said(bar.report(0))).toMatch(/gestionnaires/);
  await bar.declare(200, 'cash');
  a = (await bar.load())!;
  expect([a.slate.due, a.slate.open, a.payments[0].status]).toEqual([200, 0, 'pending']);

  // Réseau coupé : rien ne se perd, l'ardoise affichée en tient compte.
  offline = true;
  expect((await bar.take(alice.id, cafe)).queued).toBe(true);
  const oops = await bar.take(alice.id, biere);
  a = (await bar.load())!;
  expect([a.queued, a.slate.due, a.lines.filter(l => l.queued).map(l => l.label).sort()]).toEqual([2, 450, ['Bière', 'Café']]);
  await bar.undo(oops.id);
  a = (await bar.load())!;
  expect([a.queued, a.slate.due]).toEqual([1, 250]);
  expect(await said(bar.declare(100, 'cash'))).not.toBe('accepté');
  expect([...store.keys()]).toContain(`ppc-bar-queue-${USERS.alice}`);
  offline = false;
  listeners.online();
  await settle();
  a = (await bar.load())!;
  expect([a.queued, a.slate.due, a.lines.filter(l => l.label === 'Café' && !l.cancelled_at).length]).toEqual([0, 250, 1]);

  // Les consos d'une personne ne partent jamais sous le nom d'une autre.
  offline = true;
  await bar.take(alice.id, cafe);
  offline = false;
  await login('admin');
  listeners.online();
  await settle();
  expect((await bar.load())!.queued).toBe(0);
  await login('alice');
  expect((await bar.load())!.queued).toBe(1);
  listeners.online();
  await settle();
  expect((await bar.load())!.slate.due).toBe(300);

  // Un produit retiré pendant la coupure : la conso est refusée, et on le dit.
  offline = true;
  await bar.take(alice.id, biere);
  offline = false;
  await login('admin');
  await bar.saveItem({ ...biere, active: false });
  await login('alice');
  listeners.online();
  await settle();
  expect([(await bar.load())!.queued, lost]).toEqual([0, ['Bière : Ce produit n\'est plus proposé.']]);

  // L'équipe valide, encaisse, corrige, relance, compte.
  await login('admin');
  const team = (await bar.load())!.team!;
  expect([team.slates.map(s => [s.name, s.due]), team.pending.map(x => x.amount)]).toEqual([[['Alice B.', 300]], [200]]);
  await bar.decide(team.pending[0].id, true);
  await bar.receive(alice.id, 50, 'transfer');
  await bar.adjust(alice.id, 125, 'Reprise du tableau papier');
  expect(await bar.remind([alice.id])).toBe(1);
  expect((await bar.detail(alice.id)).payments.map(x => [x.amount, x.method, x.decided_by])).toEqual([[50, 'transfer', 'Admin'], [200, 'cash', 'Admin']]);
  expect(await bar.report(0)).toEqual([{ label: 'Bière', count: 1, amount: 200, guests: 1 }, { label: 'Café', count: 2, amount: 100, guests: 0 }]);
  await bar.saveSettings({ alert: 100, days: 10, payInfo: 'Caisse' });
  await login('alice');
  a = (await bar.load())!;
  expect([a.slate.due, a.slate.reminder?.seen_at, a.settings.alert]).toEqual([175, null, 100]);
  await bar.seen();
  expect((await bar.load())!.slate.reminder?.seen_at).toBeTruthy();

  // La tablette : sans compte, avec sa clé, même après une coupure.
  await login('admin');
  const k = await bar.createKiosk('Bar');
  expect((await bar.kiosks()).map(x => x.name)).toEqual(['Bar']);
  await api.signOut();
  expect(await bar.load()).toBeNull();
  setKiosk(k);
  const tally = async () => (await bar.counter()).tally.filter(t => t.member_id === me.id).map(t => t.n);
  expect(await tally()).toEqual([]);
  const first = await bar.take(me.id, cafe);
  await bar.take(me.id, cafe);
  expect(await tally()).toEqual([2]);
  await bar.undo(first.id);
  expect(await tally()).toEqual([1]);
  offline = true;
  expect((await bar.take(me.id, cafe)).queued).toBe(true);
  expect([await tally(), (await bar.counter()).queued]).toEqual([[2], 1]);
  offline = false;
  listeners.online();
  await settle();
  expect([await tally(), (await bar.counter()).queued]).toEqual([[2], 0]);
  await login('admin');
  await bar.revokeKiosk((await (leaveKiosk(), bar.kiosks()))[0].id);
  setKiosk(k);
  expect(await said(bar.counter())).toBe('Cet accès au comptoir n\'est plus valable.');
  leaveKiosk();
  expect((await bar.load())!.slate.due).toBe(100);
});

it('heads-up : avant puis après le script 004', async () => {
  const said = (p: Promise<unknown>) => p.then(() => 'accepté', e => messageOf(e));
  await login('admin');
  const [t] = await api.insert<Tournament>('club_tournaments', {
    name: 'HU', description: '', venue: '', starts_at: new Date().toISOString(), visibility: 'members', max_players: null, seats_per_table: 8,
    starting_stack: 20000, structure_name: '', levels: [], chips: [], status: 'open',
    settings: { ...DEFAULT_SETTINGS, format: 'hu', hu: { system: 'elimination', rounds: 0 } },
  });
  const es = await api.insert<Entry>('club_entries', ['A', 'B', 'C'].map(name => ({ tournament_id: t.id, member_id: null, name, status: 'registered', checked_in: true })));
  await expect(api.select('club_hu_matches', { eq: { tournament_id: t.id } })).rejects.toBeInstanceOf(NotInstalled);
  await db.exec(SQL4);

  const round = (n: number, pairs: { a: string; b: string | null }[] | null, replace = false) =>
    api.rpc('club_hu_round', { p_tournament: t.id, p_round: n, p_pairs: pairs, p_replace: replace, p_playoff: false });
  const matches = () => api.select<HuMatch>('club_hu_matches', { eq: { tournament_id: t.id }, order: ['round', 'asc'] });
  // Deux joueurs s'affrontent, le troisième est exempté ; le tournoi passe en direct.
  await round(1, [{ a: es[0].id, b: es[1].id }, { a: es[2].id, b: null }]);
  expect((await matches()).map(m => [m.round, m.b === null]).sort()).toEqual([[1, false], [1, true]]);
  expect((await api.select<Tournament>('club_tournaments', { eq: { id: t.id } }))[0].status).toBe('running');
  const duel = (await matches()).find(m => m.b)!;
  await api.update('club_hu_matches', duel.id, { winner: duel.a });
  expect(await said(round(1, [{ a: es[0].id, b: es[2].id }]))).toMatch(/déjà été tiré/);
  await round(2, [{ a: duel.a, b: es[2].id }]);
  expect(await said(api.update('club_hu_matches', duel.id, { winner: duel.b }))).toMatch(/tour suivant/);
  await round(2, null);
  expect((await matches()).every(m => m.round === 1)).toBe(true);

  // Une adhérente voit le tableau, sans pouvoir le modifier.
  await login('alice');
  expect(await matches()).toHaveLength(2);
  expect(await said(api.update('club_hu_matches', duel.id, { winner: null }))).toBe('Action réservée aux gestionnaires.');
  expect(await said(round(2, [{ a: duel.a, b: es[2].id }]))).toBe('Action réservée aux gestionnaires.');
  await login('admin');
  await api.remove('club_tournaments', t.id);
});
