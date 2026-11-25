/** 003_club_bar.sql dans un vrai PostgreSQL : qui peut quoi, et le même calcul que la démo. */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { slateOf, slates, type BarDb } from '../src/lib/demoBar';
import { DEFAULT_BAR, type BarLine, type BarPayment, type Counter, type ItemStat, type Kiosk, type RawSlate } from '../src/lib/bar';
import type { Member } from '../src/lib/types';

const SQL = ['001_club.sql', '002_club_accounts.sql', '003_club_bar.sql'].map(f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8'));
let db: PGlite;
const U = { admin: 'c1', director: 'c2', treasurer: 'c3', alice: 'c4', bob: 'c5', stranger: 'c6', left: 'c7' } as const;
type Who = keyof typeof U | 'anon';
const uid = (w: keyof typeof U) => `00000000-0000-0000-0000-0000000000${U[w]}`;

const SETUP = `
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth, public to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, username text);
  `;

async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${who === 'anon' ? 'anon' : 'authenticated'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who === 'anon' ? '' : uid(who)]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const root = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
async function call<T = unknown>(who: Who, fn: string, ...args: unknown[]): Promise<T> {
  return (await as<{ r: T }>(who, `select ${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args))[0].r;
}
interface Load { items: { id: string; name: string; sort: number; price: number }[]; settings: { alert: number; days: number; payInfo: string }; manage: boolean; validate: boolean; slate: RawSlate; lines: BarLine[]; payments: BarPayment[]; team: { slates: RawSlate[]; pending: BarPayment[] } | null }
const load = (who: Who) => call<Load>(who, 'club_bar_load');
const due = async (id: string) => { const [s] = await root<{ d: number }>('select taken - paid as d from club_bar_slates($1)', [id]); return s.d; };
let n = 0;
const lineId = () => `10000000-0000-0000-0000-${String(++n).padStart(12, '0')}`;
async function take(who: Who, member: string, item: string, guest = false, at: string | null = null, key: string | null = null): Promise<string> {
  const id = lineId();
  await call(who, 'club_bar_take', id, member, item, guest, at, key);
  return id;
}
const age = (id: string, minutes: number) => root(`update club_bar_lines set created_at = now() - $2 * interval '1 minute' where id = $1`, [id, minutes]);

let ids: Record<string, string>;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(SETUP);
  await db.exec(SQL[0]); await db.exec(SQL[1]);
  for (const k of Object.keys(U) as (keyof typeof U)[]) await root('insert into auth.users (id, email) values ($1, $2)', [uid(k), `${k}@exemple.test`]);
  await db.exec(SQL[2]); await db.exec(SQL[2]);
  // L'ordre de relance documenté.
  for (const s of SQL) await db.exec(s);
});
beforeEach(async () => {
  await db.exec('delete from club_bar_reminders; delete from club_bar_lines; delete from club_bar_payments; delete from club_bar_kiosks; delete from club_bar_items; delete from club_members;');
  await root(`update club_bar_settings set alert = 2000, days = 30, pay_info = 'Caisse'`);
  const one = async (sql: string, p: unknown[] = []) => (await root<{ id: string }>(sql, p))[0].id;
  const member = (name: string, who: keyof typeof U | null, role = 'member', treasurer = false, active = true) => one('insert into club_members (user_id, name, role, treasurer, active) values ($1, $2, $3, $4, $5) returning id', [who && uid(who), name, role, treasurer, active]);
  ids = { admin: await member('Admin', 'admin', 'admin'), director: await member('Dir', 'director', 'director'), treasurer: await member('Trés', 'treasurer', 'member', true), alice: await member('Alice', 'alice'), bob: await member('Bob', 'bob'), paper: await member('Papier', null), left: await member('Parti', 'left', 'member', false, false) };
  ids.cafe = await one(`insert into club_bar_items (name, price, sort) values ('Café', 50, 1) returning id`);
  ids.soda = await one(`insert into club_bar_items (name, price, sort) values ('Soda', 150, 2) returning id`);
  ids.old = await one(`insert into club_bar_items (name, price, sort, active) values ('Ancien', 100, 3, false) returning id`);
});

describe('accès', () => {
  const TABLES = ['club_bar_items', 'club_bar_lines', 'club_bar_payments', 'club_bar_reminders', 'club_bar_kiosks'];
  it('aucune table en direct, pour personne', async () => {
    for (const t of TABLES) for (const who of ['anon', 'alice', 'director', 'treasurer', 'admin'] as const) {
      for (const q of [`select * from ${t}`, `delete from ${t}`, `update ${t} set id = id`]) await expect(as(who, q)).rejects.toThrow(/permission denied/);
    }
    await expect(as('admin', `insert into club_bar_payments (member_id, amount, method, status) values ($1, 100, 'cash', 'validated')`, [ids.alice])).rejects.toThrow(/permission denied/);
  });
  it('les réglages : lecture aux adhérents, écriture à personne', async () => {
    expect(await as('alice', 'select alert from club_bar_settings')).toEqual([{ alert: 2000 }]);
    expect(await as('stranger', 'select alert from club_bar_settings')).toEqual([]);
    await expect(as('anon', 'select * from club_bar_settings')).rejects.toThrow(/permission denied/);
    await expect(as('admin', 'update club_bar_settings set alert = 1')).rejects.toThrow(/permission denied/);
  });
  it('les fonctions internes sont fermées', async () => {
    for (const f of ['club_bar_slates()', 'club_bar_me()', `club_bar_kiosk('x')`, 'club_bar_items_json()', `club_bar_lines_json('${ids.alice}', 10)`, 'club_bar_payments_json(null, null, 10)', 'club_bar_need_manager()', 'club_bar_need_staff()', 'club_bar_evening()']) {
      for (const who of ['anon', 'alice', 'admin'] as const) await expect(as(who, `select ${f}`)).rejects.toThrow(/permission denied/);
    }
  });
  it('visiteur, compte à valider et ancien adhérent : rien', async () => {
    const all = ['club_bar_load()', `club_bar_detail('${ids.alice}')`, 'club_bar_report(now())', `club_bar_declare(100, 'cash')`, `club_bar_withdraw('${ids.alice}')`, `club_bar_decide('${ids.alice}', true)`, `club_bar_receive('${ids.alice}', 1, 'cash')`, `club_bar_adjust('${ids.alice}', 1, 'x')`, `club_bar_remind('[]')`, 'club_bar_seen()', `club_bar_save_item(null, 'x', '', 1, true)`, `club_bar_move_item('${ids.cafe}', 1)`, `club_bar_save_settings(1, 1, '')`, 'club_bar_kiosks()', `club_bar_create_kiosk('x')`, `club_bar_revoke_kiosk('${ids.cafe}')`];
    const open = ['club_bar_counter()', `club_bar_take('${lineId()}', '${ids.alice}', '${ids.cafe}')`, `club_bar_undo('${lineId()}')`];
    for (const f of all) {
      await expect(as('anon', `select ${f}`)).rejects.toThrow(/permission denied/);
      for (const who of ['stranger', 'left'] as const) await expect(as(who, `select ${f}`)).rejects.toThrow(/connectés/);
    }
    for (const f of open) for (const who of ['anon', 'stranger', 'left'] as const) await expect(as(who, `select ${f}`)).rejects.toThrow(/connectés/);
  });
  it('chacun ne voit que son ardoise ; l\'équipe les voit toutes', async () => {
    await take('alice', ids.alice, ids.cafe);
    await take('bob', ids.bob, ids.soda, true);
    await call('bob', 'club_bar_declare', 100, 'cash');
    const a = await load('alice');
    expect([a.manage, a.validate, a.team, a.lines.map(l => [l.label, l.by]), a.slate]).toEqual([false, false, null, [['Café', null]], expect.objectContaining({ member_id: ids.alice, taken: 50 })]);
    expect(a.settings).toEqual({ alert: 2000, days: 30, payInfo: 'Caisse' });
    for (const [who, validate] of [['director', false], ['treasurer', true], ['admin', true]] as const) {
      const d = await load(who);
      expect([d.manage, d.validate, d.lines, d.team!.slates.map(s => s.name).sort(), d.team!.pending.map(p => [p.name, p.amount])]).toEqual([true, validate, [], ['Alice', 'Bob'], [['Bob', 100]]]);
    }
    await expect(call('alice', 'club_bar_detail', ids.bob)).rejects.toThrow(/gestionnaires/);
    expect((await call<{ lines: BarLine[] }>('director', 'club_bar_detail', ids.bob)).lines).toMatchObject([{ label: 'Soda', guest: true, price: 150 }]);
  });
});

describe('consommer', () => {
  it('les siennes seulement ; l\'équipe pour tous ; le prix du moment', async () => {
    await take('alice', ids.alice, ids.cafe);
    await expect(take('alice', ids.bob, ids.cafe)).rejects.toThrow(/tes propres/);
    await take('director', ids.paper, ids.cafe);
    await call('director', 'club_bar_save_item', ids.cafe, 'Café', '☕', 80, true);
    await take('alice', ids.alice, ids.cafe);
    expect((await load('alice')).lines.map(l => l.price).sort()).toEqual([50, 80]);
    await expect(take('alice', ids.alice, ids.old)).rejects.toThrow(/plus proposé/);
    await expect(take('director', ids.left, ids.cafe)).rejects.toThrow(/n'existe plus/);
    await expect(take('alice', ids.alice, ids.alice)).rejects.toThrow(/Introuvable/);
    expect((await call<{ lines: BarLine[] }>('admin', 'club_bar_detail', ids.paper)).lines[0].by).toBe('Dir');
  });
  it('renvoyer la même conso ne la double pas', async () => {
    const id = lineId();
    for (let i = 0; i < 3; i++) await call('alice', 'club_bar_take', id, ids.alice, ids.cafe, false, null, null);
    expect(await due(ids.alice)).toBe(50);
    // Le même identifiant ne permet pas d'écrire sur l'ardoise d'un autre.
    await call('bob', 'club_bar_take', id, ids.bob, ids.soda, false, null, null);
    expect([await due(ids.alice), await due(ids.bob)]).toEqual([50, 0]);
  });
  it('l\'heure de l\'appareil est bornée', async () => {
    const at = async (x: string) => { const id = await take('alice', ids.alice, ids.cafe, false, x); return (await root<{ m: number }>(`select round(extract(epoch from now() - created_at) / 60)::int as m from club_bar_lines where id = $1`, [id]))[0].m; };
    expect(await at(new Date(Date.now() - 90 * 60_000).toISOString())).toBe(90);
    expect(await at('2000-01-01')).toBe(3 * 24 * 60);
    expect(await at('2100-01-01')).toBe(0);
  });
  it('annuler : dix minutes, puis l\'équipe ; jamais sa propre ardoise', async () => {
    const id = await take('alice', ids.alice, ids.cafe);
    await expect(call('bob', 'club_bar_undo', id)).rejects.toThrow(/tes propres/);
    await age(id, 9);
    await call('alice', 'club_bar_undo', id);
    expect(await due(ids.alice)).toBe(0);
    const late = await take('alice', ids.alice, ids.cafe);
    await age(late, 11);
    await expect(call('alice', 'club_bar_undo', late)).rejects.toThrow(/10 minutes/);
    await call('director', 'club_bar_undo', late);
    const own = await take('director', ids.director, ids.soda);
    await age(own, 11);
    await expect(call('director', 'club_bar_undo', own)).rejects.toThrow(/quelqu'un d'autre/);
    await call('treasurer', 'club_bar_undo', own);
    expect([await due(ids.alice), await due(ids.director)]).toEqual([0, 0]);
    await expect(call('alice', 'club_bar_undo', lineId())).rejects.toThrow(/Introuvable/);
  });
});

describe('payer', () => {
  it('déclaré par l\'adhérent, validé par la trésorerie ou un administrateur seulement', async () => {
    await take('alice', ids.alice, ids.soda);
    await call('alice', 'club_bar_declare', 150, 'cash');
    const [p] = (await load('alice')).payments;
    expect([p.status, await due(ids.alice)]).toEqual(['pending', 150]);
    for (const who of ['alice', 'bob', 'director'] as const) await expect(call(who, 'club_bar_decide', p.id, true)).rejects.toThrow(/valident/);
    await call('treasurer', 'club_bar_decide', p.id, true);
    expect(await due(ids.alice)).toBe(0);
    expect((await load('alice')).payments[0]).toMatchObject({ status: 'validated', decided_by: 'Trés' });
    await expect(call('admin', 'club_bar_decide', p.id, false)).rejects.toThrow(/déjà traité/);
    await expect(call('alice', 'club_bar_withdraw', p.id)).rejects.toThrow(/retiré/);
    for (const bad of [0, -5, 100_001, null]) await expect(call('alice', 'club_bar_declare', bad, 'cash')).rejects.toThrow(/invalide/);
    await expect(call('alice', 'club_bar_declare', 100, 'bitcoin')).rejects.toThrow(/check/);
  });
  it('refuser, retirer', async () => {
    await take('alice', ids.alice, ids.soda);
    await call('alice', 'club_bar_declare', 150, 'transfer');
    const id = (await load('alice')).payments[0].id;
    await call('admin', 'club_bar_decide', id, false);
    expect((await load('alice')).slate).toMatchObject({ taken: 150, paid: 0, pending: 0 });
    await call('alice', 'club_bar_declare', 50, 'cash');
    const two = (await load('alice')).payments.find(p => p.status === 'pending')!.id;
    await expect(call('bob', 'club_bar_withdraw', two)).rejects.toThrow(/retiré/);
    await call('alice', 'club_bar_withdraw', two);
    expect((await load('alice')).payments).toHaveLength(1);
  });
  it('personne ne valide son propre paiement, sauf à être seul', async () => {
    await call('treasurer', 'club_bar_declare', 300, 'cash');
    const id = (await load('treasurer')).payments[0].id;
    await expect(call('treasurer', 'club_bar_decide', id, true)).rejects.toThrow(/autre/);
    await expect(call('treasurer', 'club_bar_receive', ids.treasurer, 100, 'cash')).rejects.toThrow(/autre/);
    await expect(call('treasurer', 'club_bar_adjust', ids.treasurer, -100, 'cadeau')).rejects.toThrow(/autre/);
    await call('admin', 'club_bar_decide', id, true);
    await expect(call('admin', 'club_bar_receive', ids.admin, 100, 'cash')).rejects.toThrow(/autre/);
    await root('update club_members set treasurer = false where id = $1', [ids.treasurer]);
    await root('update club_members set treasurer = true where id = $1', [ids.paper]);
    await call('admin', 'club_bar_receive', ids.admin, 100, 'cash');
  });
  it('encaisser et corriger : trésorerie et administrateurs', async () => {
    for (const who of ['alice', 'director'] as const) {
      await expect(call(who, 'club_bar_receive', ids.alice, 100, 'cash')).rejects.toThrow(/valident/);
      await expect(call(who, 'club_bar_adjust', ids.alice, 100, 'x')).rejects.toThrow(/valident/);
    }
    await call('treasurer', 'club_bar_adjust', ids.paper, 1450, ' Reprise ');
    await call('treasurer', 'club_bar_receive', ids.paper, 450, 'cash');
    await call('treasurer', 'club_bar_adjust', ids.paper, -100, 'Erreur');
    expect(await due(ids.paper)).toBe(900);
    await call('treasurer', 'club_bar_receive', ids.left, 100, 'cash');
    for (const bad of [0, 100_001, -100_001, null]) await expect(call('treasurer', 'club_bar_adjust', ids.alice, bad, 'x')).rejects.toThrow(/invalide/);
    await expect(call('treasurer', 'club_bar_adjust', ids.alice, 5, '  ')).rejects.toThrow(/motif/);
    for (const bad of [0, -1, null]) await expect(call('treasurer', 'club_bar_receive', ids.alice, bad, 'cash')).rejects.toThrow(/invalide/);
    await expect(call('treasurer', 'club_bar_receive', ids.cafe, 5, 'cash')).rejects.toThrow(/n'existe plus/);
    await expect(call('treasurer', 'club_bar_adjust', ids.cafe, 5, 'x')).rejects.toThrow(/n'existe plus/);
  });
  it('annuler une correction : trésorerie et administrateurs, jamais la sienne', async () => {
    await call('treasurer', 'club_bar_adjust', ids.alice, 900, 'Reprise');
    await call('treasurer', 'club_bar_adjust', ids.treasurer, 900, 'Reprise');
    const [a] = await root<{ id: string }>('select id from club_bar_lines where member_id = $1', [ids.alice]);
    const [t] = await root<{ id: string }>('select id from club_bar_lines where member_id = $1', [ids.treasurer]);
    for (const who of ['alice', 'director'] as const) await expect(call(who, 'club_bar_undo', a.id)).rejects.toThrow(/valident/);
    await expect(call('treasurer', 'club_bar_undo', t.id)).rejects.toThrow(/autre/);
    await call('treasurer', 'club_bar_undo', a.id);
    await call('admin', 'club_bar_undo', t.id);
    expect([await due(ids.alice), await due(ids.treasurer)]).toEqual([0, 0]);
  });
});

describe('relancer et régler', () => {
  it('rappels : par l\'équipe, une fois tant que la personne ne l\'a pas vu, jamais sans dette ni sans compte', async () => {
    await take('alice', ids.alice, ids.soda);
    await take('director', ids.paper, ids.soda);
    await take('bob', ids.bob, ids.cafe);
    await call('admin', 'club_bar_adjust', ids.left, 500, 'Reste');
    await expect(call('alice', 'club_bar_remind', '[]')).rejects.toThrow(/gestionnaires/);
    const ask = (who: Who, ...m: string[]) => call<number>(who, 'club_bar_remind', JSON.stringify(m));
    expect(await ask('director', ids.alice, ids.alice, ids.paper, ids.left, ids.treasurer)).toBe(1);
    expect(await ask('director', ids.alice)).toBe(0);
    expect((await load('alice')).slate.reminder).toMatchObject({ seen_at: null });
    await call('bob', 'club_bar_seen');
    expect((await load('alice')).slate.reminder).toMatchObject({ seen_at: null });
    await call('alice', 'club_bar_seen');
    expect((await load('alice')).slate.reminder!.seen_at).not.toBeNull();
    expect(await ask('treasurer', ids.alice)).toBe(1);
    await call('bob', 'club_bar_declare', 50, 'cash');
    expect(await ask('admin', ids.bob)).toBe(0);
    await call('admin', 'club_bar_receive', ids.alice, 150, 'cash');
    expect((await load('alice')).slate.reminder).toBeNull();
  });
  it('tarifs et réglages : l\'équipe ; ordre et valeurs contrôlés', async () => {
    await expect(call('alice', 'club_bar_save_item', null, 'x', '', 1, true)).rejects.toThrow(/gestionnaires/);
    await expect(call('alice', 'club_bar_move_item', ids.cafe, 1)).rejects.toThrow(/gestionnaires/);
    await expect(call('alice', 'club_bar_save_settings', 1, 1, '')).rejects.toThrow(/gestionnaires/);
    await call('director', 'club_bar_save_item', null, '  Chips ', '🥔', 100, true);
    const names = async () => (await load('director')).items.map(i => i.name);
    const id = async (x: string) => (await load('director')).items.find(i => i.name === x)!.id;
    expect(await names()).toEqual(['Café', 'Soda', 'Ancien', 'Chips']);
    await call('treasurer', 'club_bar_move_item', await id('Chips'), -1);
    expect(await names()).toEqual(['Café', 'Soda', 'Chips', 'Ancien']);
    for (const [x, by] of [['Café', -1], ['Ancien', 1]] as const) await call('director', 'club_bar_move_item', await id(x), by);
    expect(await names()).toEqual(['Café', 'Soda', 'Chips', 'Ancien']);
    await call('director', 'club_bar_move_item', ids.cafe, 1);
    expect(await names()).toEqual(['Soda', 'Café', 'Chips', 'Ancien']);
    for (const bad of [[null, ' ', '', 1], [null, 'x', '', -1], [null, 'x', '', 10_001], [null, 'x', '', null]]) await expect(call('director', 'club_bar_save_item', ...bad, true)).rejects.toThrow(/nom|Prix/);
    await expect(call('director', 'club_bar_save_item', ids.alice, 'x', '', 1, true)).rejects.toThrow(/Introuvable/);
    await call('director', 'club_bar_save_settings', 1500, 15, ' Ici ');
    expect((await load('alice')).settings).toEqual({ alert: 1500, days: 15, payInfo: 'Ici' });
    for (const bad of [[-1, 15], [1, 0], [1, 366], [null, 1]]) await expect(call('director', 'club_bar_save_settings', ...bad, '')).rejects.toThrow(/invalide/);
  });
  it('bilan : ventes par produit', async () => {
    await take('alice', ids.alice, ids.cafe); await take('bob', ids.bob, ids.cafe, true);
    const x = await take('alice', ids.alice, ids.soda); await take('alice', ids.alice, ids.soda);
    await call('alice', 'club_bar_undo', x);
    await call('admin', 'club_bar_adjust', ids.alice, 900, 'Reprise');
    const old = await take('alice', ids.alice, ids.cafe);
    await age(old, 60 * 24 * 60);
    const report = (from: string) => call<ItemStat[]>('director', 'club_bar_report', from);
    expect(await report(new Date(Date.now() - 86_400_000).toISOString())).toEqual([{ label: 'Soda', count: 1, amount: 150, guests: 0 }, { label: 'Café', count: 2, amount: 100, guests: 1 }]);
    expect((await report('1970-01-01'))[0]).toEqual({ label: 'Café', count: 3, amount: 150, guests: 1 });
    await expect(call('alice', 'club_bar_report', '1970-01-01')).rejects.toThrow(/gestionnaires/);
  });
  it('chaque changement prévient les écrans, une fois', async () => {
    const rev = async () => Number((await root<{ rev: string }>('select rev from club_bar_settings'))[0].rev);
    const r0 = await rev();
    await take('alice', ids.alice, ids.cafe);
    expect(await rev()).toBe(r0 + 1);
    await call('alice', 'club_bar_declare', 50, 'cash');
    await call('director', 'club_bar_save_settings', 1, 1, '');
    expect(await rev()).toBe(r0 + 3);
    expect(await root(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'club_bar_settings'`)).toHaveLength(1);
  });
});

describe('tablette', () => {
  const create = (who: Who = 'director', name = ' Bar ') => call<string>(who, 'club_bar_create_kiosk', name);
  it('créée et retirée par les gestionnaires, clé gardée en empreinte', async () => {
    for (const who of ['alice', 'treasurer'] as const) {
      await expect(create(who)).rejects.toThrow(/gestionnaires/);
      await expect(call(who, 'club_bar_kiosks')).rejects.toThrow(/gestionnaires/);
      await expect(call(who, 'club_bar_revoke_kiosk', ids.cafe)).rejects.toThrow(/gestionnaires/);
    }
    await expect(create('director', '  ')).rejects.toThrow(/nom/);
    const key = await create(), other = await create('admin');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(other).not.toBe(key);
    expect(await root('select 1 from club_bar_kiosks where key_hash = $1', [key])).toEqual([]);
    const list = await call<Kiosk[]>('admin', 'club_bar_kiosks');
    expect(list.map(k => [k.name, k.used_at])).toEqual([['Bar', null], ['Bar', null]]);
    expect(JSON.stringify(list)).not.toContain('hash');
  });
  it('sans compte : note pour tous, voit la soirée et rien d\'autre', async () => {
    const key = await create();
    await take('anon', ids.paper, ids.cafe, false, null, key);
    await take('anon', ids.paper, ids.cafe, true, null, key);
    const old = await take('alice', ids.alice, ids.soda);
    await age(old, 3 * 24 * 60);
    const c = await call<Counter>('anon', 'club_bar_counter', key);
    expect(c.tally).toEqual([{ member_id: ids.paper, item_id: ids.cafe, n: 2 }]);
    expect(c.people.map(p => p.name).sort()).toEqual(['Admin', 'Alice', 'Bob', 'Dir', 'Papier', 'Trés']);
    expect(Object.keys(c).sort()).toEqual(['items', 'people', 'tally']);
    expect(Object.keys(c.people[0]).sort()).toEqual(['id', 'name']);
    expect((await call<{ lines: BarLine[] }>('admin', 'club_bar_detail', ids.paper)).lines[0].by).toBe('le comptoir');
    expect((await call<Kiosk[]>('admin', 'club_bar_kiosks'))[0].used_at).not.toBeNull();
  });
  it('annule les siennes pendant dix minutes, jamais celles des autres', async () => {
    const key = await create(), other = await create();
    const id = await take('anon', ids.paper, ids.cafe, false, null, key), mine = await take('alice', ids.alice, ids.cafe);
    await expect(call('anon', 'club_bar_undo', id, other)).rejects.toThrow(/Introuvable/);
    await expect(call('anon', 'club_bar_undo', mine, key)).rejects.toThrow(/Introuvable/);
    await age(id, 11);
    await expect(call('anon', 'club_bar_undo', id, key)).rejects.toThrow(/10 minutes/);
    await age(id, 1);
    await call('anon', 'club_bar_undo', id, key);
    expect(await due(ids.paper)).toBe(0);
  });
  it('clé fausse, vide ou retirée : rien', async () => {
    const key = await create();
    for (const bad of ['', 'x', key.slice(0, 63), key.toUpperCase() === key ? 'x' : key.toUpperCase()]) {
      await expect(call('anon', 'club_bar_counter', bad)).rejects.toThrow(/plus valable/);
      await expect(take('anon', ids.alice, ids.cafe, false, null, bad)).rejects.toThrow(/plus valable/);
      await expect(call('anon', 'club_bar_undo', lineId(), bad)).rejects.toThrow(/plus valable/);
    }
    const [k] = await call<Kiosk[]>('director', 'club_bar_kiosks');
    await call('director', 'club_bar_revoke_kiosk', k.id);
    await expect(call('anon', 'club_bar_counter', key)).rejects.toThrow(/plus valable/);
    expect(await call('director', 'club_bar_kiosks')).toEqual([]);
    await expect(call('anon', 'club_bar_counter')).rejects.toThrow(/connectés/);
    await expect(call('alice', 'club_bar_counter')).rejects.toThrow(/gestionnaires/);
  });
  it('la soirée commence à midi, heure de Paris', async () => {
    const [e] = await root<{ h: string; past: boolean }>(`select to_char(club_bar_evening() at time zone 'Europe/Paris', 'HH24:MI') as h, club_bar_evening() <= now() and club_bar_evening() > now() - interval '24 hours' as past`);
    expect(e).toEqual({ h: '12:00', past: true });
  });
});

describe('fiches', () => {
  it('la trésorerie se confie par un administrateur, et sa fiche est protégée', async () => {
    await expect(as('director', 'update club_members set treasurer = true where id = $1', [ids.alice])).rejects.toThrow(/trésorerie/);
    await expect(as('director', `insert into club_members (name, treasurer) values ('x', true)`)).rejects.toThrow(/trésorerie/);
    for (const set of ['treasurer = false', 'active = false', `name = 'x'`, 'user_id = null']) await expect(as('director', `update club_members set ${set} where id = $1`, [ids.treasurer])).rejects.toThrow(/trésorerie/);
    await expect(as('director', 'delete from club_members where id = $1', [ids.treasurer])).rejects.toThrow(/trésorerie/);
    await expect(as('alice', 'update club_members set treasurer = true where id = $1 returning id', [ids.alice])).resolves.toEqual([]);
    // Une fiche de trésorerie sans compte ne se donne pas à un inconnu.
    await root('update club_members set treasurer = true where id = $1', [ids.paper]);
    await expect(call('director', 'club_validate_account', uid('stranger'), ids.paper)).rejects.toThrow(/trésorerie/);
    await as('admin', 'update club_members set treasurer = true where id = $1', [ids.alice]);
    expect((await load('alice')).validate).toBe(true);
    await as('director', `update club_members set name = 'Bobby' where id = $1`, [ids.bob]);
    await as('director', `insert into club_members (name) values ('Nouveau')`);
  });
  it('une ardoise ouverte bloque la suppression ; soldée, les ventes restent, anonymes', async () => {
    await take('alice', ids.alice, ids.soda);
    await expect(as('admin', 'delete from club_members where id = $1', [ids.alice])).rejects.toThrow(/ardoise/);
    await call('admin', 'club_bar_receive', ids.alice, 150, 'cash');
    await as('admin', 'delete from club_members where id = $1', [ids.alice]);
    expect(await root('select member_id, price from club_bar_lines')).toEqual([{ member_id: null, price: 150 }]);
    expect(await call('admin', 'club_bar_report', '1970-01-01')).toEqual([{ label: 'Soda', count: 1, amount: 150, guests: 0 }]);
    expect((await load('admin')).team!.slates).toEqual([]);
    await call('bob', 'club_bar_declare', 100, 'cash');
    await expect(as('admin', 'delete from club_members where id = $1', [ids.bob])).rejects.toThrow(/ardoise/);
    await as('admin', 'delete from club_members where id = $1', [ids.paper]);
  });
  it('un compte supprimé garde sa fiche et son ardoise', async () => {
    await root('insert into auth.users (id, email) values ($1, $2)', ['00000000-0000-0000-0000-0000000000cf', 'temp@exemple.test']);
    await root('update club_members set user_id = $1 where id = $2', ['00000000-0000-0000-0000-0000000000cf', ids.paper]);
    await take('director', ids.paper, ids.soda);
    await root('delete from auth.users where id = $1', ['00000000-0000-0000-0000-0000000000cf']);
    expect((await load('admin')).team!.slates[0]).toMatchObject({ name: 'Papier', account: false, taken: 150 });
  });
});

it('même calcul que la démo, sur des ardoises tirées au hasard', async () => {
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const members = (await root<Member>('select id, user_id, name, role, active, treasurer, created_at::text from club_members'));
  const T0 = Date.parse('2026-11-25T20:00:00Z');
  const demo: BarDb = { items: [], lines: [], payments: [], reminders: [], settings: { ...DEFAULT_BAR }, kiosks: [] };
  for (let i = 0; i < 260; i++) {
    const m = pick(members), conso = rnd() < 0.9;
    demo.lines.push({ id: lineId(), member_id: m.id, item_id: conso ? ids.cafe : null, label: 'x', price: conso ? Math.floor(rnd() * 300) : Math.floor(rnd() * 800) - 400, guest: false, by_member: m.id, by_kiosk: null, created_at: new Date(T0 - Math.floor(rnd() * 90 * 86_400_000)).toISOString(), cancelled_at: rnd() < 0.1 ? new Date(T0).toISOString() : null });
  }
  for (let i = 0; i < 60; i++) demo.payments.push({ id: lineId(), member_id: pick(members).id, amount: 1 + Math.floor(rnd() * 1900), method: 'cash', status: pick(['pending', 'validated', 'validated', 'refused']), declared_by: null, decided_by: null, created_at: new Date(T0 - i * 1000).toISOString(), decided_at: null });
  for (let i = 0; i < 12; i++) demo.reminders.push({ id: lineId(), member_id: pick(members).id, amount: 1, by_member: null, created_at: new Date(T0 - i * 60_000).toISOString(), seen_at: rnd() < 0.5 ? new Date(T0).toISOString() : null });
  for (const l of demo.lines) await root('insert into club_bar_lines (id, member_id, item_id, label, price, created_at, cancelled_at) values ($1,$2,$3,$4,$5,$6,$7)', [l.id, l.member_id, l.item_id, l.label, l.price, l.created_at, l.cancelled_at]);
  for (const p of demo.payments) await root('insert into club_bar_payments (id, member_id, amount, method, status, created_at) values ($1,$2,$3,$4,$5,$6)', [p.id, p.member_id, p.amount, p.method, p.status, p.created_at]);
  for (const r of demo.reminders) await root('insert into club_bar_reminders (id, member_id, amount, created_at, seen_at) values ($1,$2,$3,$4,$5)', [r.id, r.member_id, r.amount, r.created_at, r.seen_at]);
  const norm = (s: RawSlate) => ({ ...s, since: s.since && Date.parse(s.since), last: s.last && Date.parse(s.last), reminder: s.reminder && [Date.parse(s.reminder.created_at), s.reminder.seen_at && Date.parse(s.reminder.seen_at)] });
  const sort = (l: RawSlate[]) => l.map(norm).sort((a, b) => a.member_id.localeCompare(b.member_id));
  const sql = (await load('admin')).team!.slates;
  expect(sort(sql)).toEqual(sort(slates(demo, members)));
  expect(sql.some(s => s.since)).toBe(true);
  expect(sql.some(s => s.taken < s.paid)).toBe(true);
  for (const m of members) {
    const [one] = await root<{ j: RawSlate }>('select to_jsonb(s) as j from club_bar_slates($1) s', [m.id]);
    expect(norm(one.j)).toEqual(norm(slateOf(demo, m)));
  }
});

it('première exécution : seules les fonctions prévues sont ouvertes', async () => {
  const fresh = new PGlite();
  await fresh.exec(SETUP);
  for (const x of SQL) await fresh.exec(x);
  const open = async (role: string) => (await fresh.query<{ f: string }>(
    `select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname like 'club\\_bar\\_%' or p.proname = 'club_members_treasurer') and has_function_privilege($1, p.oid, 'execute') order by 1`, [role])).rows.map(r => r.f.replace('club_bar_', ''));
  expect(await open('anon')).toEqual(['counter', 'take', 'undo']);
  expect(await open('authenticated')).toEqual(['adjust', 'counter', 'create_kiosk', 'decide', 'declare', 'detail', 'kiosks', 'load', 'move_item', 'receive', 'remind', 'report', 'revoke_kiosk', 'save_item', 'save_settings', 'seen', 'take', 'undo', 'withdraw']);
  const tables = await fresh.query<{ t: string }>(`select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'club\\_bar\\_%' and (not c.relrowsecurity or has_table_privilege('anon', c.oid, 'select, insert, update, delete'))`);
  expect(tables.rows).toEqual([]);
  const bilan = await fresh.query<{ tables_buvette: number; fonctions: number }>(SQL[2].slice(SQL[2].lastIndexOf('select\n')));
  expect(bilan.rows[0]).toMatchObject({ tables_buvette: 6 });
});
