/** Première exécution de 002_club_accounts.sql sur un club qui a déjà des comptes. */
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const [SQL1, SQL2] = ['001_club.sql', '002_club_accounts.sql'].map(f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8'));
let db: PGlite;
const rows = async <T = Record<string, unknown>>(q: string, p: unknown[] = []) => (await db.query<T>(q, p)).rows;
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
async function account(n: number, username: string | null, confirmed = true) {
  await rows('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)', [uid(n), `c${n}@exemple.test`, confirmed ? new Date() : null]);
  if (username !== null) await rows('insert into profiles values ($1, $2)', [uid(n), username]);
}
const member = async (name: string, over: { user?: number; role?: string; active?: boolean } = {}) =>
  (await rows<{ id: string }>('insert into club_members (name, user_id, role, active) values ($1, $2, $3, $4) returning id', [name, over.user ? uid(over.user) : null, over.role ?? 'member', over.active ?? true]))[0].id;
const list = async () => (await rows<{ name: string; n: number | null; role: string; active: boolean }>(
  `select name, nullif(right(user_id::text, 12), '')::int as n, role, active from club_members order by user_id nulls last, name`)).map(m => `${m.name}${m.n ? ` = compte ${m.n}` : ''}${m.role === 'member' ? '' : ` (${m.role})`}${m.active ? '' : ' (ancien)'}`);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth, public to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, username text);
    create table public.range_collections (user_id uuid primary key, data jsonb);
    alter table public.range_collections enable row level security;
    create policy own on public.range_collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    grant all on public.range_collections to authenticated;
  `);
  await db.exec(SQL1);
});

it('tous les comptes confirmés deviennent adhérents, sans toucher aux fiches existantes', async () => {
  await account(1, 'chef'); await account(2, 'Nouveau'); await account(3, 'Pas confirmé', false); await account(4, null); await account(5, '  ');
  await member('Le chef', { user: 1, role: 'admin' });
  await member('Papier');
  await db.exec(SQL2);
  expect(await list()).toEqual(['Le chef = compte 1 (admin)', 'Nouveau = compte 2', 'Sans pseudo = compte 4', 'Sans pseudo = compte 5', 'Papier']);
});
it('une fiche au même nom est reliée, accents et majuscules compris', async () => {
  await account(1, 'gwendal SALAUN'); await account(2, 'Zoé');
  const g = await member('Gwendal Salaün');
  await db.exec(SQL2);
  expect(await list()).toEqual(['Gwendal Salaün = compte 1', 'Zoé = compte 2']);
  expect(await rows('select id from club_members where user_id = $1', [uid(1)])).toEqual([{ id: g }]);
});
it('au moindre doute, une nouvelle fiche : homonymes, ancien adhérent, rôle, fiche prise', async () => {
  await account(1, 'Yann'); await account(2, 'YANN'); await account(3, 'Chef'); await account(4, 'Parti'); await account(5, 'Pris'); await account(6, 'Double'); await account(7, '♠'); await account(8, 'pris par 8');
  await member('Yann'); await member('Chef', { role: 'admin' }); await member('Parti', { active: false }); await member('Pris', { user: 8 }); await member('Double'); await member('double'); await member('♥');
  await db.exec(SQL2);
  const l = await list();
  expect(l.slice(0, 8)).toEqual(['Yann = compte 1', 'YANN = compte 2', 'Chef = compte 3', 'Parti = compte 4', 'Pris = compte 5', 'Double = compte 6', '♠ = compte 7', 'Pris = compte 8']);
  expect(l.slice(8).sort()).toEqual(['Chef (admin)', 'Double', 'Parti (ancien)', 'Yann', 'double', '♥'].sort());
});
it('le nom déjà indiqué au club l\'emporte sur le pseudo, et la demande est soldée', async () => {
  await account(1, 'pseudo1'); await account(2, 'pseudo2', false);
  const m = await member('Jeanne Riou');
  await rows(`insert into club_join_requests (user_id, name) values ($1, 'Jeanne Riou'), ($2, 'Autre')`, [uid(1), uid(2)]);
  await db.exec(SQL2);
  expect(await rows('select id from club_members where user_id = $1', [uid(1)])).toEqual([{ id: m }]);
  expect(await rows('select name from club_join_requests')).toEqual([{ name: 'Autre' }]);
});
it('une seule fois : ni un nouveau compte, ni un compte détaché ne revient en relançant', async () => {
  await account(1, 'Un'); await account(2, 'Deux');
  await db.exec(SQL2);
  await account(3, 'Trois');
  await rows('update club_members set user_id = null where user_id = $1', [uid(2)]);
  await db.exec(SQL2);
  await db.exec(SQL1);
  await db.exec(SQL2);
  expect(await list()).toEqual(['Un = compte 1', 'Deux']);
});
it('un compte existant enregistre comme avant ; un compte créé ensuite attend', async () => {
  await account(1, 'Un');
  await db.exec(SQL2);
  await account(2, 'Deux');
  const save = (n: number) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid(n)]);
    await tx.query(`insert into range_collections values ($1, '1')`, [uid(n)]);
  });
  await save(1);
  await expect(save(2)).rejects.toThrow(/row-level security/);
});
it('sans les tables des outils, le script passe quand même', async () => {
  await db.exec('drop table range_collections');
  await account(1, 'Un');
  await db.exec(SQL2);
  expect(await list()).toEqual(['Un = compte 1']);
});
it('une erreur en cours de route n\'applique rien', async () => {
  await account(1, 'Un');
  await db.exec('drop table profiles');
  await expect(db.exec(SQL2)).rejects.toThrow();
  await db.exec('rollback');
  expect(await list()).toEqual([]);
  expect(await rows(`select 1 from pg_policies where policyname like 'club_validated%'`)).toEqual([]);
});
