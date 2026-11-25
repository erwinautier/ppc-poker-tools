/** Le script SQL et les droits, exécutés dans un vrai PostgreSQL (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const SQL = ['001_club.sql', '002_club_accounts.sql'].map(f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8'));
let db: PGlite;

const U = {
  admin: '00000000-0000-0000-0000-0000000000a1',
  director: '00000000-0000-0000-0000-0000000000a2',
  alice: '00000000-0000-0000-0000-0000000000a3',
  bob: '00000000-0000-0000-0000-0000000000a4',
  stranger: '00000000-0000-0000-0000-0000000000a5',
};

async function as<T = Record<string, unknown>>(who: keyof typeof U | 'anon', sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${who === 'anon' ? 'anon' : 'authenticated'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who === 'anon' ? '' : U[who]]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const root = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;

let ids: Record<string, string>;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth, public to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create publication supabase_realtime;
    -- Droits par défaut de Supabase : tout est accordé, la RLS seule protège.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);
  // La table de la suite : chacun n'y lit que son profil.
  await db.exec(`
    create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, username text, created_at timestamptz default now());
    alter table public.profiles enable row level security;
    create policy own on public.profiles for select to authenticated using (id = auth.uid());
    -- Les deux tables privées des outils, comme en production : chacun ses lignes.
    create table public.range_collections (user_id uuid primary key references auth.users (id) on delete cascade, data jsonb);
    create table public.trainer_stats (user_id uuid primary key references auth.users (id) on delete cascade, data jsonb);
    alter table public.range_collections enable row level security;
    alter table public.trainer_stats enable row level security;
    create policy own on public.range_collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy own on public.trainer_stats for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  `);
  for (const [k, v] of Object.entries(U)) {
    await root('insert into auth.users (id, email) values ($1, $2)', [v, `${k}@exemple.test`]);
    await root('insert into profiles (id, username) values ($1, $2)', [v, `pseudo-${k}`]);
  }
  for (const s of [...SQL, ...SQL]) await db.exec(s); // relançables
});

beforeEach(async () => {
  await db.exec('delete from club_tournaments; delete from club_championships; delete from club_join_requests; delete from club_members; delete from club_structures;');
  await root('select club_bootstrap_admin($1, $2)', ['ADMIN@exemple.test', 'Ad']);
  const one = async (sql: string, p: unknown[] = []) => (await root<{ id: string }>(sql, p))[0].id;
  ids = {
    admin: await one(`select id from club_members where role = 'admin'`),
    director: await one(`insert into club_members (user_id, name, role) values ($1, 'Dir', 'director') returning id`, [U.director]),
    alice: await one(`insert into club_members (user_id, name) values ($1, 'Alice') returning id`, [U.alice]),
    bob: await one(`insert into club_members (user_id, name) values ($1, 'Bob') returning id`, [U.bob]),
    paper: await one(`insert into club_members (name) values ('Papier') returning id`),
  };
  ids.t = await one(`insert into club_tournaments (name, starts_at, status, max_players) values ('T', now(), 'open', 2) returning id`);
  ids.pub = await one(`insert into club_tournaments (name, starts_at, status, visibility) values ('P', now(), 'open', 'public') returning id`);
  ids.draft = await one(`insert into club_tournaments (name, starts_at, status, visibility) values ('D', now(), 'draft', 'public') returning id`);
});

describe('visibilité', () => {
  const names = async (who: keyof typeof U | 'anon') =>
    (await as<{ name: string }>(who, 'select name from club_tournaments order by name')).map(r => r.name);
  it('public, adhérents, organisateurs', async () => {
    expect(await names('anon')).toEqual(['P']);
    expect(await names('stranger')).toEqual(['P']);
    expect(await names('alice')).toEqual(['P', 'T']);
    expect(await names('director')).toEqual(['D', 'P', 'T']);
  });
  it('les inscriptions suivent la visibilité du tournoi', async () => {
    await root(`insert into club_entries (tournament_id, name) values ($1, 'x'), ($2, 'y'), ($3, 'z')`, [ids.t, ids.pub, ids.draft]);
    const n = async (w: keyof typeof U | 'anon') => (await as(w, 'select name from club_entries')).length;
    expect(await n('anon')).toBe(1);
    expect(await n('stranger')).toBe(1);
    expect(await n('alice')).toBe(2);
    expect(await n('director')).toBe(3);
  });
  it('la liste des adhérents reste entre adhérents', async () => {
    expect(await as('anon', 'select * from club_members')).toEqual([]);
    expect(await as('stranger', 'select * from club_members')).toEqual([]);
    expect((await as('alice', 'select * from club_members')).length).toBe(5);
  });
  it('les règlements sont réservés aux organisateurs', async () => {
    const [e] = await root<{ id: string }>(`insert into club_entries (tournament_id, name) values ($1, 'x') returning id`, [ids.pub]);
    await as('director', 'insert into club_payments (entry_id, tournament_id) values ($1, $2)', [e.id, ids.pub]);
    expect(await as('alice', 'select * from club_payments')).toEqual([]);
    await expect(as('anon', 'select * from club_payments')).rejects.toThrow(/permission denied/);
  });
});

describe('droits d\'écriture', () => {
  it('un adhérent ne modifie rien directement', async () => {
    await expect(as('alice', `insert into club_tournaments (name, starts_at) values ('x', now())`)).rejects.toThrow(/row-level security/);
    await expect(as('alice', `insert into club_entries (tournament_id, member_id, name) values ($1, $2, 'A')`, [ids.t, ids.alice])).rejects.toThrow(/row-level security/);
    expect(await as('alice', `update club_members set role = 'admin' where id = $1 returning id`, [ids.alice])).toEqual([]);
    expect(await as('alice', 'delete from club_tournaments returning id')).toEqual([]);
    await expect(as('anon', 'delete from club_tournaments')).rejects.toThrow(/permission denied/);
  });
  it('un organisateur ne peut pas s\'élever ni toucher aux autres organisateurs', async () => {
    await expect(as('director', `update club_members set role = 'admin' where id = $1`, [ids.director])).rejects.toThrow(/administrateur/);
    await expect(as('director', `update club_members set role = 'director' where id = $1`, [ids.alice])).rejects.toThrow(/administrateur/);
    await expect(as('director', `update club_members set active = false where id = $1`, [ids.admin])).rejects.toThrow(/administrateur/);
    await expect(as('director', 'delete from club_members where id = $1', [ids.admin])).rejects.toThrow(/administrateur/);
    await expect(as('director', `insert into club_members (name, role) values ('x', 'admin')`)).rejects.toThrow(/administrateur/);
    await as('director', `insert into club_members (name) values ('Nouveau')`);
    await as('director', `update club_members set name = 'Alicia' where id = $1`, [ids.alice]);
  });
  it('un admin gère les rôles, mais le club garde un admin', async () => {
    await as('admin', `update club_members set role = 'director' where id = $1`, [ids.alice]);
    await expect(as('admin', `update club_members set role = 'member' where id = $1`, [ids.admin])).rejects.toThrow(/au moins un administrateur/);
    await expect(as('admin', 'delete from club_members where id = $1', [ids.admin])).rejects.toThrow(/au moins un administrateur/);
  });
  it('un gestionnaire nommé gère tout le club, et perd tout si on le retire', async () => {
    const work = async (who: 'alice') => {
      const [s] = await as<{ id: string }>(who, `insert into club_structures (name, starting_stack) values ('S', 20000) returning id`);
      const [c] = await as<{ id: string }>(who, `insert into club_championships (name) values ('C') returning id`);
      const [t] = await as<{ id: string }>(who, `insert into club_tournaments (name, starts_at, championship_id) values ('Soirée', now(), $1) returning id`, [c.id]);
      const [e] = await as<{ id: string }>(who, `insert into club_entries (tournament_id, member_id, name) values ($1, $2, 'Bob') returning id`, [t.id, ids.bob]);
      await as(who, 'insert into club_payments (entry_id, tournament_id) values ($1, $2)', [e.id, t.id]);
      await as(who, 'select club_set_clock($1, 0, 0, true)', [t.id]);
      await as(who, `insert into club_members (name) values ('Recrue')`);
      await as(who, `update club_members set active = false where name = 'Recrue'`);
      for (const [table, row] of [['club_tournaments', t], ['club_championships', c], ['club_structures', s]] as const) {
        expect(await as(who, `delete from ${table} where id = $1 returning id`, [row.id])).toHaveLength(1);
      }
      expect(await as(who, `delete from club_members where name = 'Recrue' returning id`)).toHaveLength(1);
    };
    await expect(work('alice')).rejects.toThrow(/row-level security/);
    await as('admin', `update club_members set role = 'director' where id = $1`, [ids.alice]);
    await work('alice');
    await as('admin', `update club_members set role = 'member' where id = $1`, [ids.alice]);
    await expect(work('alice')).rejects.toThrow(/row-level security/);
  });
  it('un second administrateur a les mêmes droits que le premier', async () => {
    await as('admin', `update club_members set role = 'admin' where id = $1`, [ids.alice]);
    await as('alice', `update club_members set role = 'director' where id = $1`, [ids.bob]);
    await as('alice', `update club_members set role = 'member' where id = $1`, [ids.admin]);
    await expect(as('admin', `update club_members set role = 'admin' where id = $1`, [ids.admin])).resolves.toEqual([]);
    expect(await root('select role from club_members where id = $1', [ids.admin])).toEqual([{ role: 'member' }]);
    await expect(as('alice', `update club_members set role = 'member' where id = $1`, [ids.alice])).rejects.toThrow(/au moins un administrateur/);
  });
  it('un rôle donné d\'avance ne vaut qu\'une fois le compte relié, par un administrateur', async () => {
    await as('admin', `update club_members set role = 'director' where id = $1`, [ids.paper]);
    await as('stranger', `select club_request_join('Papier')`);
    expect(await as('stranger', 'select name from club_tournaments')).toEqual([{ name: 'P' }]);
    await expect(as('director', 'select club_approve_request($1, $2)', [U.stranger, ids.paper])).rejects.toThrow(/administrateur/);
    await as('admin', 'select club_approve_request($1, $2)', [U.stranger, ids.paper]);
    expect(await as('stranger', 'select club_role() as r')).toEqual([{ r: 'director' }]);
    expect((await as('stranger', 'select name from club_tournaments')).length).toBe(3);
  });
  it('les fonctions sensibles sont fermées', async () => {
    for (const q of [
      `select club_bootstrap_admin('alice@exemple.test', 'A')`,
      `select club_promote('${ids.t}')`,
    ]) for (const who of ['anon', 'alice', 'director'] as const) await expect(as(who, q)).rejects.toThrow(/permission denied/);
    for (const q of [
      `select club_set_clock('${ids.t}', 0, 0, true)`, `select club_finish('${ids.t}', '[]')`, `select club_reopen('${ids.t}')`,
      `select club_save_seats('${ids.t}', '[]')`, `select club_approve_request('${U.stranger}')`,
    ]) {
      await expect(as('alice', q)).rejects.toThrow(/organisateurs/);
      await expect(as('anon', q)).rejects.toThrow(/permission denied/);
    }
  });
  it('un adhérent désactivé perd l\'accès', async () => {
    await as('admin', 'update club_members set active = false where id = $1', [ids.alice]);
    expect((await as('alice', 'select name from club_tournaments')).length).toBe(1);
    await expect(as('alice', 'select club_register($1)', [ids.t])).rejects.toThrow(/rattaché/);
  });
});

describe('inscriptions', () => {
  const status = async (m: string) =>
    (await root<{ status: string }>('select status from club_entries where tournament_id = $1 and member_id = $2', [ids.t, m]))[0]?.status;
  it('places limitées, liste d\'attente, promotion automatique', async () => {
    expect(await as('alice', 'select club_register($1) as s', [ids.t])).toEqual([{ s: 'registered' }]);
    await as('director', `insert into club_entries (tournament_id, name) values ($1, 'Invité')`, [ids.t]);
    expect(await as('bob', 'select club_register($1) as s', [ids.t])).toEqual([{ s: 'waitlist' }]);
    expect(await as('bob', 'select club_register($1) as s', [ids.t])).toEqual([{ s: 'waitlist' }]);
    await as('alice', 'select club_unregister($1)', [ids.t]);
    expect(await status(ids.alice)).toBe('cancelled');
    expect(await status(ids.bob)).toBe('registered');
    // Alice revient : elle passe derrière.
    expect(await as('alice', 'select club_register($1) as s', [ids.t])).toEqual([{ s: 'waitlist' }]);
    await as('director', 'update club_tournaments set max_players = 3 where id = $1', [ids.t]);
    expect(await status(ids.alice)).toBe('registered');
  });
  it('promotion dans l\'ordre d\'arrivée quand l\'organisateur retire un joueur', async () => {
    await root(`insert into club_entries (tournament_id, name, status, registered_at) values
      ($1, 'r1', 'registered', now() - interval '5 min'), ($1, 'r2', 'registered', now() - interval '4 min'),
      ($1, 'w1', 'waitlist', now() - interval '3 min'), ($1, 'w2', 'waitlist', now() - interval '2 min')`, [ids.t]);
    await as('director', `delete from club_entries where name = 'r1'`);
    const rows = await root<{ name: string; status: string }>(`select name, status from club_entries where tournament_id = $1 order by name`, [ids.t]);
    expect(rows).toEqual([{ name: 'r2', status: 'registered' }, { name: 'w1', status: 'registered' }, { name: 'w2', status: 'waitlist' }]);
  });
  it('fermées, en cours, ou sans fiche : refus', async () => {
    await expect(as('stranger', 'select club_register($1)', [ids.pub])).rejects.toThrow(/rattaché/);
    await expect(as('anon', 'select club_register($1)', [ids.pub])).rejects.toThrow(/permission denied/);
    await as('director', `update club_tournaments set status = 'closed' where id = $1`, [ids.t]);
    await expect(as('alice', 'select club_register($1)', [ids.t])).rejects.toThrow(/pas ouvertes/);
    await as('director', `update club_tournaments set status = 'running' where id = $1`, [ids.t]);
    await expect(as('alice', 'select club_unregister($1)', [ids.t])).rejects.toThrow(/commencé/);
  });
  it('le nom suit la fiche adhérent', async () => {
    await as('alice', 'select club_register($1)', [ids.t]);
    await as('director', `update club_members set name = 'Alice B.' where id = $1`, [ids.alice]);
    expect(await root('select name from club_entries where member_id = $1', [ids.alice])).toEqual([{ name: 'Alice B.' }]);
  });
  it('supprimer une fiche conserve ses résultats', async () => {
    await as('alice', 'select club_register($1)', [ids.t]);
    await as('director', 'delete from club_members where id = $1', [ids.alice]);
    expect(await root('select name, member_id from club_entries where tournament_id = $1', [ids.t])).toEqual([{ name: 'Alice', member_id: null }]);
  });
});

describe('rattachement des comptes', () => {
  it('demande, puis création ou rattachement par un organisateur', async () => {
    await as('stranger', `select club_request_join('  Zoé  ')`);
    expect(await as('alice', 'select * from club_join_requests')).toEqual([]);
    expect(await as('director', 'select name, email from club_join_requests')).toEqual([{ name: 'Zoé', email: 'stranger@exemple.test' }]);
    await as('director', 'select club_approve_request($1, $2)', [U.stranger, ids.paper]);
    expect(await root('select user_id from club_members where id = $1', [ids.paper])).toEqual([{ user_id: U.stranger }]);
    expect(await root('select * from club_join_requests')).toEqual([]);
    expect((await as('stranger', 'select * from club_tournaments')).length).toBe(2);
    await expect(as('stranger', `select club_request_join('Zoé')`)).rejects.toThrow(/déjà/);
  });
  it('un organisateur ne peut pas donner une fiche d\'admin libre à un compte', async () => {
    await root(`insert into club_members (name, role) values ('Admin libre', 'admin')`);
    const [m] = await root<{ id: string }>(`select id from club_members where name = 'Admin libre'`);
    await as('stranger', `select club_request_join('Moi')`);
    await expect(as('director', 'select club_approve_request($1, $2)', [U.stranger, m.id])).rejects.toThrow(/administrateur/);
  });
  it('une fiche déjà prise ne peut pas l\'être deux fois', async () => {
    await as('stranger', `select club_request_join('Moi')`);
    await expect(as('director', 'select club_approve_request($1, $2)', [U.stranger, ids.alice])).rejects.toThrow(/déjà rattachée/);
  });
  it('on ne dépose pas de demande au nom d\'un autre', async () => {
    await expect(as('stranger', `insert into club_join_requests (user_id, name) values ($1, 'x')`, [U.bob])).rejects.toThrow();
  });
});

describe('validation des comptes', () => {
  type A = { user_id: string; username: string | null; asked: string | null; email: string | null; confirmed: boolean; member_id: string | null; refused: boolean };
  const accounts = async (who: keyof typeof U) => (await as<{ r: A[] }>(who, 'select club_accounts() as r'))[0].r;
  const find = async (who: keyof typeof U, id: string) => (await accounts(who)).find(a => a.user_id === id)!;
  const status = async (who: keyof typeof U) => (await as<{ r: string }>(who, 'select club_account_status() as r'))[0].r;
  const count = async (who: keyof typeof U) => (await as<{ r: number }>(who, 'select club_pending_count() as r'))[0].r;
  const validate = async (who: keyof typeof U, user: string, member: string | null = null, name: string | null = null, role = 'member') =>
    (await as<{ r: string }>(who, 'select club_validate_account($1, $2, $3, $4) as r', [user, member, name, role]))[0].r;
  const refuse = (who: keyof typeof U, user: string, yes = true) => as(who, 'select club_refuse_account($1, $2)', [user, yes]);
  const temp = async (n: number, username: string, over = '') => {
    const u = `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;
    await root('insert into auth.users (id, email) values ($1, $2)', [u, `temp${n}@exemple.test`]);
    await root('insert into profiles (id, username) values ($1, $2)', [u, username]);
    if (over) await root(`update auth.users set ${over} where id = $1`, [u]);
    return u;
  };
  beforeEach(async () => {
    await db.exec(`delete from club_refused_accounts; delete from range_collections; delete from trainer_stats; delete from auth.users where email like 'temp%'`);
  });

  it('un nouveau compte attend ; validé par un gestionnaire, il devient adhérent', async () => {
    expect(await status('stranger')).toBe('pending');
    expect(await as('stranger', 'select name from club_tournaments')).toEqual([{ name: 'P' }]);
    await expect(as('stranger', 'select club_register($1)', [ids.pub])).rejects.toThrow(/rattaché/);
    expect(await count('director')).toBe(1);
    const m = await validate('director', U.stranger);
    expect(await root('select user_id, name, role, active from club_members where id = $1', [m])).toEqual([{ user_id: U.stranger, name: 'pseudo-stranger', role: 'member', active: true }]);
    expect(await status('stranger')).toBe('ok');
    expect(await count('director')).toBe(0);
    expect((await as('stranger', 'select name from club_tournaments')).length).toBe(2);
    await as('stranger', 'select club_register($1)', [ids.pub]);
  });
  it('un administrateur valide aussi, et peut donner un rôle ; un gestionnaire non', async () => {
    await expect(validate('director', U.stranger, null, null, 'director')).rejects.toThrow(/administrateur/);
    await expect(validate('director', U.stranger, null, null, 'admin')).rejects.toThrow(/administrateur/);
    await expect(validate('director', U.stranger, ids.paper, null, 'director')).rejects.toThrow(/administrateur/);
    expect(await status('stranger')).toBe('pending');
    await expect(validate('admin', U.stranger, null, null, 'roi')).rejects.toThrow(/check/);
    await validate('admin', U.stranger, null, null, 'director');
    expect(await as('stranger', 'select club_role() as r')).toEqual([{ r: 'director' }]);
  });
  it('personne ne se valide soi-même, ni ne valide ou refuse sans être de l\'équipe', async () => {
    for (const q of [`select club_validate_account('${U.stranger}')`, `select club_refuse_account('${U.stranger}', true)`, 'select club_accounts()']) {
      await expect(as('alice', q)).rejects.toThrow(/gestionnaires/);
      await expect(as('stranger', q)).rejects.toThrow(/gestionnaires/);
      await expect(as('anon', q)).rejects.toThrow(/permission denied/);
    }
    expect(await count('alice')).toBe(0);
    for (const q of ['select club_account_status()', 'select club_account_ok()', 'select club_pending_count()']) await expect(as('anon', q)).rejects.toThrow(/permission denied/);
    await expect(as('stranger', `insert into club_members (user_id, name) values ($1, 'Moi')`, [U.stranger])).rejects.toThrow(/row-level security/);
    for (const t of ['club_refused_accounts', 'club_settings']) for (const who of ['anon', 'alice', 'director', 'admin'] as const) {
      await expect(as(who, `select * from ${t}`)).rejects.toThrow(/permission denied/);
      await expect(as(who, `delete from ${t}`)).rejects.toThrow(/permission denied/);
    }
    await as('admin', 'update club_members set active = false where id = $1', [ids.director]);
    await expect(as('director', 'select club_accounts()')).rejects.toThrow(/gestionnaires/);
    expect(await count('director')).toBe(0);
  });
  it('un compte en attente ou refusé n\'enregistre rien dans les outils, sans rien perdre', async () => {
    for (const t of ['range_collections', 'trainer_stats']) {
      const save = (who: keyof typeof U, v: string) => as(who, `insert into ${t} (user_id, data) values ($1, $2) on conflict (user_id) do update set data = excluded.data returning data`, [U[who], JSON.stringify(v)]);
      const read = async (who: keyof typeof U) => (await as<{ data: unknown }>(who, `select data from ${t}`)).map(x => x.data);
      await expect(save('stranger', 'a')).rejects.toThrow(/row-level security/);
      await root(`insert into ${t} values ($1, '"ancien"')`, [U.stranger]);
      await expect(save('stranger', 'b')).rejects.toThrow(/row-level security/);
      expect(await as('stranger', `update ${t} set data = '"c"' returning data`)).toEqual([]);
      expect(await read('stranger')).toEqual(['ancien']);
      await refuse('director', U.stranger);
      await expect(save('stranger', 'd')).rejects.toThrow(/row-level security/);
      expect(await read('stranger')).toEqual(['ancien']);

      const m = await validate('admin', U.stranger);
      expect(await save('stranger', 'e')).toEqual([{ data: 'e' }]);
      expect(await as('stranger', `update ${t} set data = '"f"' returning data`)).toEqual([{ data: 'f' }]);
      expect(await read('stranger')).toEqual(['f']);
      expect(await read('alice')).toEqual([]);
      await expect(as('stranger', `insert into ${t} (user_id, data) values ($1, '"vol"')`, [U.bob])).rejects.toThrow(/row-level security/);

      // Ancien adhérent : garde les outils. Compte détaché : repasse à valider.
      await as('admin', 'update club_members set active = false where id = $1', [m]);
      expect(await status('stranger')).toBe('ok');
      expect(await save('stranger', 'g')).toEqual([{ data: 'g' }]);
      await as('admin', 'update club_members set user_id = null where id = $1', [m]);
      expect(await status('stranger')).toBe('pending');
      await expect(save('stranger', 'h')).rejects.toThrow(/row-level security/);
      expect(await read('stranger')).toEqual(['g']);
      await as('admin', 'delete from club_members where id = $1', [m]);
    }
  });
  it('les adhérents existants enregistrent comme avant, et les règles d\'origine sont intactes', async () => {
    for (const who of ['admin', 'director', 'alice'] as const) {
      await as(who, `insert into range_collections (user_id, data) values ($1, '"x"')`, [U[who]]);
      await as(who, `delete from range_collections where user_id = $1`, [U[who]]);
    }
    expect(await root(`select tablename, policyname, permissive from pg_policies where tablename in ('range_collections', 'trainer_stats') order by 1, 2`)).toEqual(
      ['range_collections', 'trainer_stats'].flatMap(tablename => [
        { tablename, policyname: 'club_validated_insert', permissive: 'RESTRICTIVE' },
        { tablename, policyname: 'club_validated_update', permissive: 'RESTRICTIVE' },
        { tablename, policyname: 'own', permissive: 'PERMISSIVE' },
      ]));
  });
  it('refuser, revenir sur un refus, valider un compte refusé', async () => {
    await as('stranger', `select club_request_join('Moi')`);
    expect((await find('director', U.stranger)).asked).toBe('Moi');
    await refuse('director', U.stranger);
    await refuse('director', U.stranger);
    expect(await status('stranger')).toBe('refused');
    expect(await count('admin')).toBe(0);
    expect(await find('director', U.stranger)).toMatchObject({ refused: true, asked: null });
    await refuse('director', U.stranger, false);
    expect(await status('stranger')).toBe('pending');
    await refuse('admin', U.stranger);
    await validate('admin', U.stranger);
    expect(await status('stranger')).toBe('ok');
    expect(await root('select * from club_refused_accounts')).toEqual([]);
    await expect(refuse('admin', U.alice)).rejects.toThrow(/déjà rattaché/);
    expect(await status('alice')).toBe('ok');
  });
  it('adresses : toutes pour un administrateur, celles à valider pour un gestionnaire', async () => {
    const admin = await accounts('admin');
    expect(admin.map(a => a.username).sort()).toEqual(Object.keys(U).map(k => `pseudo-${k}`).sort());
    expect(admin.every(a => a.email)).toBe(true);
    expect((await accounts('director')).filter(a => a.email).map(a => a.user_id)).toEqual([U.stranger]);
    await as('admin', 'update club_members set active = false where id = $1', [ids.alice]);
    expect((await find('director', U.alice)).email).toBeNull();
  });
  it('le nom : choisi, sinon indiqué au club, sinon le pseudo', async () => {
    const m1 = await validate('admin', U.stranger, null, '  Zoé Riou ');
    expect(await root('select name from club_members where id = $1', [m1])).toEqual([{ name: 'Zoé Riou' }]);
    await root('delete from club_members where id = $1', [m1]);
    await as('stranger', `select club_request_join('Zoé du club')`);
    const m2 = await validate('admin', U.stranger);
    expect(await root('select name from club_members where id = $1', [m2])).toEqual([{ name: 'Zoé du club' }]);
    expect(await root('select * from club_join_requests')).toEqual([]);
  });
  it('relier à une fiche existante, même un ancien adhérent, sans doublon', async () => {
    await root('update club_members set active = false where id = $1', [ids.paper]);
    expect(await validate('director', U.stranger, ids.paper, 'Ignoré')).toBe(ids.paper);
    expect(await root('select name, active, user_id, role from club_members where id = $1', [ids.paper])).toEqual([{ name: 'Papier', active: true, user_id: U.stranger, role: 'member' }]);
    await expect(validate('admin', U.stranger)).rejects.toThrow(/déjà rattaché/);
    const other = await temp(1, 'autre');
    await expect(validate('admin', other, ids.alice)).rejects.toThrow(/déjà rattachée/);
    expect(await root('select user_id from club_members where id = $1', [ids.alice])).toEqual([{ user_id: U.alice }]);
  });
  it('le rôle déjà porté par une fiche ne change pas ; seul un administrateur la relie', async () => {
    await root(`update club_members set role = 'admin' where id = $1`, [ids.paper]);
    await expect(validate('director', U.stranger, ids.paper)).rejects.toThrow(/administrateur/);
    await validate('admin', U.stranger, ids.paper, null, 'director');
    expect(await as('stranger', 'select club_role() as r')).toEqual([{ r: 'admin' }]);
  });
  it('compte absent, adresse non confirmée, pseudo vide ou trop long', async () => {
    await expect(validate('admin', '00000000-0000-0000-0000-0000000001ff')).rejects.toThrow(/n'existe plus/);
    const fake = await temp(3, 'Président', 'email_confirmed_at = null');
    expect((await find('admin', fake)).confirmed).toBe(false);
    expect(await count('admin')).toBe(1);
    await expect(validate('admin', fake)).rejects.toThrow(/confirmée/);
    await expect(validate('admin', fake, ids.paper)).rejects.toThrow(/confirmée/);
    const blank = await temp(4, '   '), long = await temp(5, 'x'.repeat(200)), bare = await temp(6, 'x');
    await root('delete from profiles where id = $1', [bare]);
    expect((await accounts('admin')).filter(x => [blank, bare].includes(x.user_id)).map(x => x.username)).toEqual([null, null]);
    await expect(validate('admin', blank)).rejects.toThrow(/nom de la nouvelle fiche/);
    await expect(validate('admin', bare)).rejects.toThrow(/nom de la nouvelle fiche/);
    const m = await validate('admin', long);
    expect((await root<{ name: string }>('select name from club_members where id = $1', [m]))[0].name).toHaveLength(60);
  });
  it('un compte supprimé disparaît de la liste, sa fiche reste', async () => {
    const u = await temp(7, 'parti');
    const m = await validate('admin', u);
    await root('delete from auth.users where id = $1', [u]);
    expect((await accounts('admin')).some(x => x.user_id === u)).toBe(false);
    expect(await root('select name, user_id from club_members where id = $1', [m])).toEqual([{ name: 'parti', user_id: null }]);
  });
  it('relancer le script ne valide personne', async () => {
    await refuse('admin', await temp(8, 'refusé'));
    await db.exec(SQL[1]);
    expect(await status('stranger')).toBe('pending');
    expect(await root('select 1 from club_refused_accounts')).toHaveLength(1);
  });
  it('rien n\'est écrit dans les profils', async () => {
    const before = await root('select * from profiles order by id');
    await validate('admin', U.stranger, null, 'Autre nom');
    expect(await root('select * from profiles order by id')).toEqual(before);
  });
});

describe('déroulé', () => {
  const clock = async () => (await root<{ status: string; clock_level: number; clock_anchor: Date | null; clock_elapsed_ms: number }>(
    'select status, clock_level, clock_anchor, clock_elapsed_ms from club_tournaments where id = $1', [ids.t]))[0];
  it('horloge : démarrage, pause', async () => {
    await as('director', 'select club_set_clock($1, 0, 0, true)', [ids.t]);
    expect(await clock()).toMatchObject({ status: 'running', clock_level: 0 });
    expect((await clock()).clock_anchor).not.toBeNull();
    await as('director', 'select club_set_clock($1, 2, 90000, false)', [ids.t]);
    expect(await clock()).toMatchObject({ clock_level: 2, clock_anchor: null });
    expect(Number((await clock()).clock_elapsed_ms)).toBe(90000);
  });
  it('éliminations : recave comptée puis annulée, double élimination refusée', async () => {
    const [a, b] = await root<{ id: string }>(`insert into club_entries (tournament_id, name) values ($1, 'a'), ($1, 'b') returning id`, [ids.t]);
    const rev = async () => Number((await root<{ rev: number }>('select rev from club_tournaments where id = $1', [ids.t]))[0].rev);
    const before = await rev();
    const [k] = await as<{ id: string }>('director', 'insert into club_knockouts (tournament_id, victim_id, killer_ids, rebuy) values ($1, $2, $3, true) returning id', [ids.t, a.id, [b.id]]);
    expect(await root('select rebuys from club_entries where id = $1', [a.id])).toEqual([{ rebuys: 1 }]);
    expect(await rev()).toBeGreaterThan(before);
    await as('director', 'delete from club_knockouts where id = $1', [k.id]);
    expect(await root('select rebuys from club_entries where id = $1', [a.id])).toEqual([{ rebuys: 0 }]);
    const out = 'insert into club_knockouts (tournament_id, victim_id) values ($1, $2)';
    await as('director', out, [ids.t, a.id]);
    await expect(as('director', out, [ids.t, a.id])).rejects.toThrow(/duplicate/);
    await expect(as('director', out, [ids.pub, b.id])).rejects.toThrow(/foreign key/);
    await expect(as('alice', out, [ids.t, b.id])).rejects.toThrow(/row-level security/);
  });
  it('clôture, correction, réouverture', async () => {
    const [a, b, c] = await root<{ id: string }>(`insert into club_entries (tournament_id, name) values ($1, 'a'), ($1, 'b'), ($1, 'c') returning id`, [ids.t]);
    await as('director', 'select club_set_clock($1, 1, 1000, true)', [ids.t]);
    const finish = (rows: unknown) => as('director', 'select club_finish($1, $2)', [ids.t, JSON.stringify(rows)]);
    await finish([{ entry_id: a.id, position: 1, kos: 1.5, bounty: 10 }, { entry_id: b.id, position: 2, kos: 0, bounty: 0 }]);
    const pos = () => root<{ name: string; final_position: number | null }>('select name, final_position from club_entries where tournament_id = $1 order by name', [ids.t]);
    expect((await pos()).map(r => r.final_position)).toEqual([1, 2, null]);
    expect(await clock()).toMatchObject({ status: 'finished', clock_anchor: null });
    await finish([{ entry_id: c.id, position: 1, kos: 0, bounty: 0 }]);
    expect((await pos()).map(r => r.final_position)).toEqual([null, null, 1]);
    // Terminé : l'horloge ne repart pas par erreur.
    await as('director', 'select club_set_clock($1, 0, 0, true)', [ids.t]);
    expect(await clock()).toMatchObject({ status: 'finished', clock_level: 1, clock_anchor: null });
    await as('director', 'select club_reopen($1)', [ids.t]);
    expect((await pos()).map(r => r.final_position)).toEqual([null, null, null]);
    expect(await clock()).toMatchObject({ status: 'running' });
  });
  it('placements groupés, limités au tournoi visé', async () => {
    const [a] = await root<{ id: string }>(`insert into club_entries (tournament_id, name) values ($1, 'a') returning id`, [ids.t]);
    await as('director', 'select club_save_seats($1, $2)', [ids.pub, JSON.stringify([{ entry_id: a.id, table_no: 1, seat_no: 1 }])]);
    expect(await root('select table_no from club_entries where id = $1', [a.id])).toEqual([{ table_no: null }]);
    await as('director', 'select club_save_seats($1, $2)', [ids.t, JSON.stringify([{ entry_id: a.id, table_no: 2, seat_no: 5 }])]);
    expect(await root('select table_no, seat_no from club_entries where id = $1', [a.id])).toEqual([{ table_no: 2, seat_no: 5 }]);
  });
  it('supprimer un tournoi emporte tout ; un compte supprimé garde sa fiche', async () => {
    const [a] = await root<{ id: string }>(`insert into club_entries (tournament_id, name) values ($1, 'a') returning id`, [ids.t]);
    await as('director', 'insert into club_knockouts (tournament_id, victim_id, rebuy) values ($1, $2, true)', [ids.t, a.id]);
    await as('director', 'delete from club_tournaments where id = $1', [ids.t]);
    expect(await root('select * from club_knockouts')).toEqual([]);
    await root('delete from auth.users where id = $1', [U.bob]);
    expect(await root('select user_id from club_members where id = $1', [ids.bob])).toEqual([{ user_id: null }]);
    await root('insert into auth.users values ($1, $2)', [U.bob, 'bob@exemple.test']);
  });
  it('la table des tournois est publiée en temps réel', async () => {
    expect(await root(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)).toEqual([{ tablename: 'club_tournaments' }]);
  });
});
