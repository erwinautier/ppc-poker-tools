/** Le script SQL et les droits, exécutés dans un vrai PostgreSQL (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const SQL = readFileSync(new URL('../supabase/001_club.sql', import.meta.url), 'utf8');
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
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create publication supabase_realtime;
    -- Droits par défaut de Supabase : tout est accordé, la RLS seule protège.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);
  for (const [k, v] of Object.entries(U)) await root('insert into auth.users values ($1, $2)', [v, `${k}@exemple.test`]);
  await db.exec(SQL);
  await db.exec(SQL); // relançable
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
