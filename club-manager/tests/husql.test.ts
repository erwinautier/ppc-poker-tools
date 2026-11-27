/** 004_club_hu.sql dans un vrai PostgreSQL : qui voit et modifie les matchs, et les tirages refusés. */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const [CLUB, HU] = ['001_club.sql', '004_club_hu.sql'].map(read);
let db: PGlite;
const U = { admin: 'd1', director: 'd2', alice: 'd3', stranger: 'd4' } as const;
type Who = keyof typeof U | 'anon';
const uid = (w: keyof typeof U) => `00000000-0000-0000-0000-0000000000${U[w]}`;

async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${who === 'anon' ? 'anon' : 'authenticated'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who === 'anon' ? '' : uid(who)]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const root = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;

let t: string, pub: string, e: string[];
const pairs = (...list: [number, number | null][]) => JSON.stringify(list.map(([a, b]) => ({ a: e[a], b: b === null ? null : e[b] })));
const draw = (who: Who, round: number, p: string | null, replace = false, playoff = false, tour = t) =>
  as(who, 'select club_hu_round($1, $2, $3::jsonb, $4, $5)', [tour, round, p, replace, playoff]);
const matches = async (round?: number) => root<{ id: string; round: number; a: string; b: string | null; winner: string | null }>(
  `select id, round, a, b, winner from club_hu_matches where tournament_id = $1 ${round ? 'and round = $2' : ''} order by round, a`, round ? [t, round] : [t]);
const win = (who: Who, id: string, winner: string | null) => as(who, 'update club_hu_matches set winner = $2 where id = $1 returning id', [id, winner]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth, public to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, username text);
  `);
  for (const w of Object.keys(U) as (keyof typeof U)[]) await root('insert into auth.users (id, email) values ($1, $2)', [uid(w), `${w}@exemple.test`]);
  // Relançable, et à relancer après 001.
  for (const s of [CLUB, HU, HU, CLUB, HU]) await db.exec(s);
});

beforeEach(async () => {
  await db.exec('delete from club_tournaments; delete from club_members;');
  await root('select club_bootstrap_admin($1, $2)', ['admin@exemple.test', 'Ad']);
  await root(`insert into club_members (user_id, name, role) values ($1, 'Dir', 'director'), ($2, 'Alice', 'member')`, [uid('director'), uid('alice')]);
  t = (await root<{ id: string }>(`insert into club_tournaments (name, starts_at, status, settings) values ('HU', now(), 'open', '{"format":"hu"}') returning id`))[0].id;
  pub = (await root<{ id: string }>(`insert into club_tournaments (name, starts_at, status, visibility) values ('P', now(), 'open', 'public') returning id`))[0].id;
  e = (await root<{ id: string }>(`insert into club_entries (tournament_id, name, checked_in) select $1, 'J' || g, true from generate_series(1, 5) g returning id`, [t])).map(r => r.id);
});

describe('tirage des tours', () => {
  it('premier tour : matchs et exemption, le tournoi passe en direct', async () => {
    await draw('director', 1, pairs([0, 1], [2, 3], [4, null]));
    expect(await matches()).toHaveLength(3);
    expect((await root<{ status: string }>('select status from club_tournaments where id = $1', [t]))[0].status).toBe('running');
  });

  it('réservé à l\'équipe', async () => {
    await expect(draw('alice', 1, pairs([0, 1]))).rejects.toThrow(/gestionnaires/);
    await expect(draw('anon', 1, pairs([0, 1]))).rejects.toThrow();
    await expect(as('director', `insert into club_hu_matches (tournament_id, round, a, b) values ($1, 1, $2, $3)`, [t, e[0], e[1]])).rejects.toThrow();
    await draw('director', 1, pairs([0, 1]));
    await expect(as('director', 'delete from club_hu_matches')).rejects.toThrow();
  });

  it('deux tirages du même tour : le second est refusé', async () => {
    await draw('director', 1, pairs([0, 1], [2, 3], [4, null]));
    await expect(draw('admin', 1, pairs([0, 2], [1, 3], [4, null]))).rejects.toThrow(/déjà été tiré/);
    await expect(draw('admin', 3, pairs([0, 2]))).rejects.toThrow(/déjà été tiré/);
  });

  it('tour suivant seulement quand le tour en cours est joué', async () => {
    await draw('director', 1, pairs([0, 1], [2, 3], [4, null]));
    await expect(draw('director', 2, pairs([0, 2], [4, null]))).rejects.toThrow(/pas fini/);
    const [m1, m2] = (await matches(1)).filter(m => m.b);
    await win('director', m1.id, m1.a);
    await win('director', m2.id, m2.b);
    await draw('director', 2, pairs([0, 3], [4, null]));
    expect(await matches(2)).toHaveLength(2);
  });

  it('retirer au sort tant qu\'aucun résultat n\'est saisi', async () => {
    await draw('director', 1, pairs([0, 1], [2, 3], [4, null]));
    await draw('director', 1, pairs([0, 2], [1, 3], [4, null]), true);
    expect((await matches(1)).find(m => m.a === e[0])!.b).toBe(e[2]);
    const m = (await matches(1)).find(x => x.b)!;
    await win('director', m.id, m.a);
    await expect(draw('director', 1, pairs([0, 3], [1, 2], [4, null]), true)).rejects.toThrow(/résultats/);
  });

  it('annuler le dernier tour, pas un autre', async () => {
    await draw('director', 1, pairs([0, 1], [2, 3], [4, null]));
    for (const m of (await matches(1)).filter(x => x.b)) await win('director', m.id, m.a);
    await draw('director', 2, pairs([0, 2], [4, null]));
    await expect(draw('director', 1, null)).rejects.toThrow(/changé/);
    await draw('director', 2, null);
    expect((await matches()).every(m => m.round === 1)).toBe(true);
  });

  it('un joueur deux fois dans un tour, un joueur d\'un autre tournoi : refusé', async () => {
    await expect(draw('director', 1, pairs([0, 1], [1, 2]))).rejects.toThrow(/deux fois/);
    const other = (await root<{ id: string }>(`insert into club_entries (tournament_id, name) values ($1, 'X') returning id`, [pub]))[0].id;
    await expect(as('director', 'select club_hu_round($1, 1, $2::jsonb, false, false)', [t, JSON.stringify([{ a: e[0], b: other }])])).rejects.toThrow();
    expect(await matches()).toHaveLength(0);
  });

  it('tournoi terminé : plus de tirage ni de correction', async () => {
    await draw('director', 1, pairs([0, 1]));
    const [m] = await matches(1);
    await root(`update club_tournaments set status = 'finished' where id = $1`, [t]);
    await expect(draw('director', 2, pairs([0, 2]))).rejects.toThrow(/terminé/);
    await expect(win('director', m.id, m.a)).rejects.toThrow(/terminé/);
  });
});

describe('vainqueur d\'un match', () => {
  it('l\'équipe seule, et un des deux joueurs', async () => {
    await draw('director', 1, pairs([0, 1], [2, null]));
    const list = await matches(1);
    const m = list.find(x => x.b)!, bye = list.find(x => !x.b)!;
    expect(await win('alice', m.id, m.a)).toEqual([]);
    expect((await matches(1)).find(x => x.id === m.id)!.winner).toBeNull();
    await expect(win('director', m.id, e[3])).rejects.toThrow(/club_hu_matches_winner/);
    await expect(win('director', bye.id, bye.a)).rejects.toThrow(/club_hu_matches_winner/);
    await win('director', m.id, m.b);
    await win('director', m.id, null);
    expect((await matches(1)).find(x => x.id === m.id)!.winner).toBeNull();
  });

  it('seul le vainqueur se modifie', async () => {
    await draw('director', 1, pairs([0, 1]));
    const [m] = await matches(1);
    await expect(as('director', 'update club_hu_matches set a = $2 where id = $1', [m.id, e[2]])).rejects.toThrow();
  });

  it('un tour clos ne se corrige plus', async () => {
    await draw('director', 1, pairs([0, 1], [2, 3], [4, null]));
    const played = (await matches(1)).filter(x => x.b);
    for (const m of played) await win('director', m.id, m.a);
    await draw('director', 2, pairs([0, 2], [4, null]));
    await expect(win('director', played[0].id, played[0].b)).rejects.toThrow(/tour suivant/);
  });
});

describe('lecture et temps réel', () => {
  it('les matchs suivent la visibilité du tournoi', async () => {
    await draw('director', 1, pairs([0, 1]));
    const n = async (w: Who) => (await as(w, 'select id from club_hu_matches')).length;
    expect(await n('anon')).toBe(0);
    expect(await n('stranger')).toBe(0);
    expect(await n('alice')).toBe(1);
    await root(`update club_tournaments set visibility = 'public' where id = $1`, [t]);
    expect(await n('anon')).toBe(1);
  });

  it('chaque changement fait avancer « rev »', async () => {
    const rev = async () => Number((await root<{ rev: number }>('select rev from club_tournaments where id = $1', [t]))[0].rev);
    const r0 = await rev();
    await draw('director', 1, pairs([0, 1]));
    const r1 = await rev();
    expect(r1).toBeGreaterThan(r0);
    await win('director', (await matches(1))[0].id, e[0]);
    expect(await rev()).toBeGreaterThan(r1);
  });

  it('supprimer le tournoi supprime ses matchs', async () => {
    await draw('director', 1, pairs([0, 1]));
    await root('delete from club_tournaments where id = $1', [t]);
    expect((await root('select id from club_hu_matches')).length).toBe(0);
  });
});
