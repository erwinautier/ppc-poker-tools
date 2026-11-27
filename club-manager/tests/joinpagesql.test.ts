/** 006_club_join_page.sql dans un vrai PostgreSQL : qui lit et qui modifie les questions de la page « Rejoindre le club ». */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_FAQ, FAQ_LIMITS, cleanFaq } from '../src/lib/joinPage';

const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const [CLUB, JOIN] = ['001_club.sql', '006_club_join_page.sql'].map(read);
let db: PGlite;
const U = { admin: 'e1', director: 'e2', alice: 'e3' } as const;
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
const save = async (who: Who, faq: unknown) =>
  (await as<{ faq: { q: string; a: string }[] }>(who, 'select club_save_join_faq($1::jsonb) as faq', [JSON.stringify(faq)]))[0].faq;
const stored = async () => (await root<{ faq: { q: string; a: string }[]; updated_by: string | null }>('select faq, updated_by from club_join_page'))[0];

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
  // Relançable, et à relancer après 001 (qui retire les règles d'accès des tables club_*).
  for (const s of [CLUB, JOIN, JOIN, CLUB, JOIN]) await db.exec(s);
});

beforeEach(async () => {
  await db.exec('delete from club_join_page; delete from club_members;');
  await root('select club_bootstrap_admin($1, $2)', ['admin@exemple.test', 'Ad']);
  await root(`insert into club_members (user_id, name, role) values ($1, 'Dir', 'director'), ($2, 'Alice', 'member')`, [uid('director'), uid('alice')]);
});

const FAQ = [{ q: 'Faut-il savoir jouer ?', a: 'Non.' }, { q: 'Quel âge ?', a: 'Majeurs.' }];

describe('lecture', () => {
  it('tout le monde lit la page, visiteurs compris', async () => {
    await save('admin', FAQ);
    for (const who of ['anon', 'alice', 'director'] as const) {
      expect((await as<{ faq: unknown }>(who, 'select faq from club_join_page where id = 1'))[0].faq).toEqual(FAQ);
    }
  });

  it('sans enregistrement, aucune ligne : la page garde ses questions par défaut', async () => {
    expect(await as('anon', 'select faq from club_join_page')).toEqual([]);
  });
});

describe('enregistrement', () => {
  it('réservé aux administrateurs', async () => {
    expect(await save('admin', FAQ)).toEqual(FAQ);
    expect((await stored()).updated_by).toBe(uid('admin'));
    await expect(save('director', [])).rejects.toThrow(/administrateurs/);
    await expect(save('alice', [])).rejects.toThrow(/administrateurs/);
    await expect(save('anon', [])).rejects.toThrow();
    expect((await stored()).faq).toEqual(FAQ);
  });

  it('aucune écriture directe dans la table, même pour un administrateur', async () => {
    await save('admin', FAQ);
    await expect(as('admin', `update club_join_page set faq = '[]'`)).rejects.toThrow();
    await expect(as('admin', 'delete from club_join_page')).rejects.toThrow();
    await expect(as('anon', `insert into club_join_page (id, faq) values (1, '[]') on conflict do nothing`)).rejects.toThrow();
    expect((await stored()).faq).toEqual(FAQ);
  });

  it('remplace la liste entière, dans l\'ordre donné', async () => {
    await save('admin', FAQ);
    await save('admin', [FAQ[1], FAQ[0]]);
    expect((await stored()).faq).toEqual([FAQ[1], FAQ[0]]);
    expect(await root('select id from club_join_page')).toHaveLength(1);
  });

  it('nettoie les textes et ignore les autres clés', async () => {
    const out = await save('admin', [{ q: '  Une question ?\n', a: '\tLigne 1\nLigne 2  ', extra: 1 }]);
    expect(out).toEqual([{ q: 'Une question ?', a: 'Ligne 1\nLigne 2' }]);
  });

  it('une liste vide est permise', async () => {
    expect(await save('admin', [])).toEqual([]);
    expect((await stored()).faq).toEqual([]);
  });

  it('refuse les listes mal formées', async () => {
    await expect(save('admin', { q: 'a', a: 'b' })).rejects.toThrow(/Liste de questions/);
    await expect(save('admin', [{ q: 'Sans réponse' }])).rejects.toThrow(/réponse/);
    await expect(save('admin', [{ q: '   ', a: 'x' }])).rejects.toThrow(/réponse/);
    await expect(save('admin', ['texte'])).rejects.toThrow(/réponse/);
    await expect(save('admin', [{ q: 'x'.repeat(FAQ_LIMITS.q + 1), a: 'x' }])).rejects.toThrow(/Question trop longue/);
    await expect(save('admin', [{ q: 'x', a: 'x'.repeat(FAQ_LIMITS.a + 1) }])).rejects.toThrow(/Réponse trop longue/);
    await expect(save('admin', Array.from({ length: FAQ_LIMITS.items + 1 }, () => ({ q: 'x', a: 'y' })))).rejects.toThrow(/Trente/);
    expect(await stored()).toBeUndefined();
  });
});

describe('mêmes règles dans l\'application', () => {
  it('les questions par défaut (rejoindre/faq.json) passent la base telles quelles', async () => {
    expect(DEFAULT_FAQ.length).toBeGreaterThan(0);
    expect(await save('admin', DEFAULT_FAQ)).toEqual(DEFAULT_FAQ);
  });

  it('cleanFaq nettoie comme la base et refuse les mêmes listes', async () => {
    const input = [{ q: '  Une question ?\n', a: '\tLigne 1\nLigne 2  ' }];
    expect(cleanFaq(input)).toEqual(await save('admin', input));
    expect(() => cleanFaq([{ q: 'Sans réponse', a: ' ' }])).toThrow(/réponse/);
    expect(() => cleanFaq([{ q: 'x'.repeat(FAQ_LIMITS.q + 1), a: 'x' }])).toThrow(/Question trop longue/);
    expect(() => cleanFaq([{ q: 'x', a: 'x'.repeat(FAQ_LIMITS.a + 1) }])).toThrow(/Réponse trop longue/);
    expect(() => cleanFaq(Array.from({ length: FAQ_LIMITS.items + 1 }, () => ({ q: 'x', a: 'y' })))).toThrow(/Trente/);
  });
});
