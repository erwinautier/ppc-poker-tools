/** 005_carnet.sql dans un vrai PostgreSQL : publier, voter, voir les résultats, retirer. */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const [CLUB, CARNET] = ['001_club.sql', '005_carnet.sql'].map(read);
let db: PGlite;
const U = { admin: 'e1', director: 'e2', alice: 'e3', bob: 'e4', carol: 'e5', stranger: 'e6' } as const;
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

const HAND = { v: 1, date: 1, ctx: { kind: 'club', name: 'T', level: 3, blinds: { sb: 50, bb: 100, ante: 0, anteMode: 'bb' }, table: 2 },
  seats: [{ stack: 5000 }, { stack: 5000 }], hero: 0, actions: [{ p: 0, k: 'raise', to: 300 }], board: [], decision: 0, winners: [], tags: [], complete: true };
const OPTIONS = [{ k: 'fold' }, { k: 'call' }, { k: 'raise', to: 250 }, { k: 'raise', to: 5000, allin: true }];

const publish = async (who: Who, hand: object = HAND, show = false) =>
  (await as<{ id: string }>(who, 'select carnet_publish($1::jsonb, $2::jsonb, $3) as id', [JSON.stringify(hand), JSON.stringify(OPTIONS), show]))[0].id;
const vote = (who: Who, id: string, choice: number, reasons: number[] = []) =>
  as(who, 'select carnet_vote($1, $2, $3::int[])', [id, choice, reasons]);
interface Post { id: string; author_name: string | null; mine: boolean; hidden: boolean; votes: number; my_vote: number | null; my_reasons: number[]; hand: Record<string, unknown>; results: { total: number; counts: number[]; reasons: number[][] } | null }
const feed = async (who: Who, id?: string) =>
  (await as<{ f: { member: boolean; staff: boolean; hands: Post[] } }>(who, 'select carnet_feed($1) as f', [id ?? null]))[0].f;

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
  // Relançable.
  for (const s of [CLUB, CARNET, CARNET]) await db.exec(s);
});

beforeEach(async () => {
  await db.exec('delete from carnet_hands; delete from club_members;');
  await root('select club_bootstrap_admin($1, $2)', ['admin@exemple.test', 'Ad Min']);
  await root(`insert into club_members (user_id, name, role) values ($1, 'Dir', 'director'), ($2, 'Alice Martin', 'member'), ($3, 'Bob', 'member'), ($4, 'Carol', 'member')`,
    [uid('director'), uid('alice'), uid('bob'), uid('carol')]);
});

describe('publier', () => {
  it('réservé aux adhérents', async () => {
    await expect(publish('stranger')).rejects.toThrow(/adhérents/);
    await expect(publish('anon')).rejects.toThrow();
    expect((await feed('stranger')).member).toBe(false);
    expect((await feed('stranger')).hands).toEqual([]);
  });

  it('prénom seulement si demandé ; la note et les clés inconnues ne sont pas gardées', async () => {
    const a = await publish('alice', { ...HAND, note: 'privé', extra: 1 }, true);
    const b = await publish('alice');
    const f = await feed('bob');
    expect(f.hands.map(h => h.id)).toEqual([b, a]);
    expect(f.hands.find(h => h.id === a)!.author_name).toBe('Alice');
    expect(f.hands.find(h => h.id === b)!.author_name).toBeNull();
    expect(f.hands[0].hand).not.toHaveProperty('note');
    expect(f.hands[1].hand).not.toHaveProperty('extra');
    expect(f.hands[0].mine).toBe(false);
    expect((await feed('alice')).hands[0].mine).toBe(true);
  });

  it('refuse les données illisibles', async () => {
    await expect(as('alice', `select carnet_publish('[]'::jsonb, $1::jsonb)`, [JSON.stringify(OPTIONS)])).rejects.toThrow(/illisible/);
    await expect(as('alice', `select carnet_publish($1::jsonb, '[{"k":"fold"}]'::jsonb)`, [JSON.stringify(HAND)])).rejects.toThrow(/illisibles/);
    await expect(as('alice', `select carnet_publish($1::jsonb, '[{"k":"fold"},{"k":"insulte"}]'::jsonb)`, [JSON.stringify(HAND)])).rejects.toThrow(/illisibles/);
  });

  it('aucun accès direct aux tables', async () => {
    await expect(as('alice', 'select * from carnet_hands')).rejects.toThrow();
    await expect(as('alice', 'select * from carnet_votes')).rejects.toThrow();
    await expect(as('alice', `insert into carnet_votes (hand_id, voter, choice) values (gen_random_uuid(), $1, 0)`, [uid('alice')])).rejects.toThrow();
    await expect(as('alice', `select carnet_results(gen_random_uuid(), 2)`)).rejects.toThrow();
  });
});

describe('voter', () => {
  it('résultats cachés avant de voter, visibles après ; votes anonymes', async () => {
    const id = await publish('alice');
    expect((await feed('bob', id)).hands[0].results).toBeNull();
    await vote('bob', id, 1, [0, 3]);
    await vote('carol', id, 3, [3]);
    const after = (await feed('bob', id)).hands[0];
    expect(after.my_vote).toBe(1);
    expect(after.my_reasons).toEqual([0, 3]);
    expect(after.results!.total).toBe(2);
    expect(after.results!.counts).toEqual([0, 1, 0, 1]);
    expect(after.results!.reasons[1]).toEqual([1, 0, 0, 1, 0, 0, 0, 0]);
    expect(after.results!.reasons[3][3]).toBe(1);
    expect(JSON.stringify(after)).not.toContain(uid('carol'));
    // L'auteur et l'équipe voient sans voter ; les autres voient seulement le nombre de votes.
    expect((await feed('alice', id)).hands[0].results!.total).toBe(2);
    expect((await feed('director', id)).hands[0].results!.total).toBe(2);
    expect((await feed('admin', id)).hands[0].votes).toBe(2);
  });

  it('changer son vote ne le compte qu\'une fois', async () => {
    const id = await publish('alice');
    await vote('bob', id, 0);
    await vote('bob', id, 2, [1]);
    const r = (await feed('bob', id)).hands[0].results!;
    expect(r.total).toBe(1);
    expect(r.counts).toEqual([0, 0, 1, 0]);
  });

  it('refusé : sa propre main, réponse ou raisons hors liste, non-adhérent', async () => {
    const id = await publish('alice');
    await expect(vote('alice', id, 0)).rejects.toThrow(/ta main/);
    await expect(vote('bob', id, 4)).rejects.toThrow(/inconnue/);
    await expect(vote('bob', id, -1)).rejects.toThrow(/inconnue/);
    await expect(vote('bob', id, 0, [1, 2, 3])).rejects.toThrow(/Deux raisons/);
    await expect(vote('bob', id, 0, [8])).rejects.toThrow(/Deux raisons/);
    await expect(vote('bob', id, 0, [2, 2])).rejects.toThrow(/Deux raisons/);
    await expect(vote('stranger', id, 0)).rejects.toThrow(/adhérents/);
  });
});

describe('retirer', () => {
  it('l\'équipe masque une main : elle disparaît pour les autres, plus de vote', async () => {
    const id = await publish('alice');
    await expect(as('bob', 'select carnet_hide($1, true)', [id])).rejects.toThrow(/gestionnaires/);
    await as('director', 'select carnet_hide($1, true)', [id]);
    expect((await feed('bob')).hands).toEqual([]);
    expect((await feed('alice')).hands[0].hidden).toBe(true);
    expect((await feed('admin')).hands[0].hidden).toBe(true);
    await expect(vote('bob', id, 0)).rejects.toThrow(/introuvable/);
    await as('admin', 'select carnet_hide($1, false)', [id]);
    expect((await feed('bob')).hands).toHaveLength(1);
  });

  it('l\'auteur ou l\'équipe supprime ; les votes partent avec', async () => {
    const id = await publish('alice');
    await vote('bob', id, 0);
    await expect(as('bob', 'select carnet_delete($1)', [id])).rejects.toThrow(/quelqu'un d'autre/);
    await as('alice', 'select carnet_delete($1)', [id]);
    expect((await root<{ n: number }>('select count(*)::int as n from carnet_votes'))[0].n).toBe(0);
    const other = await publish('carol');
    await as('director', 'select carnet_delete($1)', [other]);
    expect((await feed('carol')).hands).toEqual([]);
  });

  it('vingt mains par jour au plus', async () => {
    for (let i = 0; i < 20; i++) await publish('bob');
    await expect(publish('bob')).rejects.toThrow(/Vingt mains/);
  });
});
