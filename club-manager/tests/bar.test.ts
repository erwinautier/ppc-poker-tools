/** Buvette : calculs de l'ardoise et règles de la démo (les mêmes que 003_club_bar.sql, comparées dans barsql.test.ts). */
import { beforeEach, describe, expect, it } from 'vitest';
import { bySize, canUndo, cents, csv, DEFAULT_BAR, isLate, money, reminderText, totals, type BarApi } from '../src/lib/bar';
import { createDemoBar, eveningStart, slateOf, slates, type BarActor, type BarDb, type LineRow, type PaymentRow } from '../src/lib/demoBar';
import type { Member, Role } from '../src/lib/types';

const DAY = 86_400_000, MIN = 60_000;
const T0 = Date.parse('2026-11-25T21:00:00');
const person = (id: string, role: Role = 'member', over: Partial<Member> = {}): Member => ({ id, user_id: `u-${id}`, name: `${id} Test`, role, active: true, created_at: '', ...over });
const line = (id: string, member_id: string, price: number, daysAgo = 0, over: Partial<LineRow> = {}): LineRow =>
  ({ id, member_id, item_id: 'cafe', label: 'Café', price, guest: false, by_member: member_id, by_kiosk: null, created_at: new Date(T0 - daysAgo * DAY).toISOString(), cancelled_at: null, ...over });
const pay = (id: string, member_id: string, amount: number, status: PaymentRow['status'] = 'validated'): PaymentRow =>
  ({ id, member_id, amount, method: 'cash', status, declared_by: member_id, decided_by: null, created_at: new Date(T0).toISOString(), decided_at: null });

let db: BarDb, people: Member[], actor: BarActor, now: number, n: number, saves: number, bar: BarApi;
const as = (id: string | 'kiosk' | null) => { actor = id === 'kiosk' ? { me: null, kiosk: true } : { me: people.find(m => m.id === id) ?? null, kiosk: false }; };
const slate = (id: string) => totals(slateOf(db, people.find(m => m.id === id)!));
const due = (id: string) => slate(id).due;
const item = (id: string) => db.items.find(i => i.id === id) ?? { id, name: '', emoji: '', price: 0, active: true, sort: 0 };
const take = async (who: string, what: string, guest = false) => (await bar.take(who, item(what), guest)).id;

beforeEach(() => {
  people = [person('Admin', 'admin'), person('Gest', 'director'), person('Tres', 'member', { treasurer: true }), person('Alice'), person('Bob'), person('Parti', 'member', { active: false })];
  db = {
    items: [{ id: 'cafe', name: 'Café', emoji: '☕', price: 50, active: true, sort: 1 }, { id: 'soda', name: 'Soda', emoji: '', price: 150, active: true, sort: 2 }, { id: 'vieux', name: 'Ancien', emoji: '', price: 100, active: false, sort: 3 }],
    lines: [], payments: [], reminders: [], settings: { ...DEFAULT_BAR }, kiosks: [],
  };
  now = T0; n = 0; saves = 0; as('Alice');
  bar = createDemoBar({ db: () => db, members: () => people, actor: () => actor, now: () => now, uid: () => `x${++n}`, saved: () => { saves++; }, watch: () => () => {} });
});

describe('calculs', () => {
  it('solde exact : pas d\'erreur d\'arrondi', () => {
    db.lines = Array.from({ length: 30 }, (_, i) => line(`l${i}`, 'Alice', 10));
    expect(due('Alice')).toBe(300);
    expect([cents(0.1 + 0.2), cents(1.15), cents(2.675), cents(12)]).toEqual([30, 115, 268, 1200]);
    expect(money(1250)).toBe('12,50\u00a0€');
    expect(money(-50)).toBe('-0,50\u00a0€');
  });
  it('annulées, refusées et en attente', () => {
    db.lines = [line('a', 'Alice', 500), line('b', 'Alice', 100, 0, { cancelled_at: 'x' }), line('c', 'Bob', 900)];
    db.payments = [pay('p', 'Alice', 200), pay('q', 'Alice', 150, 'pending'), pay('r', 'Alice', 999, 'refused')];
    expect(slate('Alice')).toMatchObject({ taken: 500, paid: 200, pending: 150, due: 300, open: 150 });
  });
  it('une avance donne un solde négatif, jamais un reste à payer négatif', () => {
    db.lines = [line('a', 'Alice', 300)];
    db.payments = [pay('p', 'Alice', 1000)];
    expect(slate('Alice')).toMatchObject({ due: -700, open: 0, since: null });
  });
  it('impayé depuis : les paiements éteignent les plus anciennes', () => {
    db.lines = [line('a', 'Alice', 100, 40), line('b', 'Alice', 100, 20), line('c', 'Alice', 100, 5)];
    const since = () => Math.round((T0 - Date.parse(slate('Alice').since!)) / DAY);
    expect(since()).toBe(40);
    db.payments = [pay('p', 'Alice', 100)];
    expect(since()).toBe(20);
    db.payments = [pay('p', 'Alice', 150)];
    expect(since()).toBe(20);
    db.payments = [pay('p', 'Alice', 200)];
    expect(since()).toBe(5);
    db.lines.push(line('geste', 'Alice', -50, 1, { item_id: null }));
    expect(since()).toBe(5);
    db.payments = [pay('p', 'Alice', 250)];
    expect(slate('Alice').since).toBeNull();
    // Un paiement déclaré couvre les anciennes : la bière d'hier ne met pas en retard.
    db.lines = [line('a', 'Alice', 100, 40), line('b', 'Alice', 200, 1)];
    db.payments = [pay('p', 'Alice', 100, 'pending')];
    expect([since(), isLate(slate('Alice'), db.settings, T0)]).toEqual([1, false]);
  });
  it('en retard : trop lourd ou trop vieux, sauf si déjà déclaré', () => {
    db.lines = [line('a', 'Alice', 1999)];
    const late = () => isLate(slate('Alice'), db.settings, T0);
    expect(late()).toBe(false);
    db.lines = [line('a', 'Alice', 2000)];
    expect(late()).toBe(true);
    db.payments = [pay('p', 'Alice', 2000, 'pending')];
    expect(late()).toBe(false);
    db.payments = [];
    db.lines = [line('a', 'Alice', 50, 29)];
    expect(late()).toBe(false);
    db.lines = [line('a', 'Alice', 50, 30)];
    expect(late()).toBe(true);
  });
  it('liste des ardoises : seulement celles qui ont vécu, les plus lourdes d\'abord', () => {
    db.lines = [line('a', 'Alice', 100), line('b', 'Bob', 300), line('c', 'Tres', 100, 0, { cancelled_at: 'x' })];
    db.payments = [pay('p', 'Gest', 100)];
    expect(slates(db, people).map(totals).sort(bySize).map(s => [s.member_id, s.due])).toEqual([['Bob', 300], ['Alice', 100], ['Gest', -100]]);
  });
  it('ventes : sans les annulées ni les corrections', async () => {
    db.lines = [line('a', 'Alice', 50), line('b', 'Bob', 60, 0, { guest: true }), line('c', 'Bob', 150, 0, { item_id: 'soda', label: 'Soda' }), line('d', 'Bob', 50, 0, { cancelled_at: 'x' }), line('e', 'Bob', 900, 0, { item_id: null }), line('f', 'Bob', 50, 60)];
    as('Gest');
    expect(await bar.report(T0 - 30 * DAY)).toEqual([{ label: 'Soda', count: 1, amount: 150, guests: 0 }, { label: 'Café', count: 2, amount: 110, guests: 1 }]);
    expect((await bar.report(0))[0]).toEqual({ label: 'Café', count: 3, amount: 160, guests: 1 });
  });
  it('le comptoir repart de zéro à midi', () => {
    const at = (s: string) => new Date(eveningStart(Date.parse(s))).toString().slice(4, 21);
    expect(at('2026-11-25T21:00:00')).toBe('Nov 25 2026 12:00');
    expect(at('2026-11-26T02:30:00')).toBe('Nov 25 2026 12:00');
    expect(at('2026-11-26T12:00:00')).toBe('Nov 26 2026 12:00');
  });
  it('rappel et export', () => {
    db.lines = [line('a', 'Alice', 1250, 10)];
    expect(reminderText(slate('Alice'), db.settings)).toBe('Bonjour Alice, petit rappel de la buvette : ton ardoise est de 12,50\u00a0€, depuis le 15 novembre. Espèces dans la caisse, ou virement au club. Merci !');
    expect(reminderText(slate('Alice'), { ...db.settings, payInfo: '' })).toMatch(/novembre\. Merci !$/);
    people[3].name = 'Alice "A" ; X';
    expect(csv([slate('Alice')]).split('\r\n')[1]).toBe('"Alice ""A"" ; X";12,50;0,00;0,00;12,50;"15/11/2026"');
  });
});

describe('qui peut quoi', () => {
  it('un adhérent note et annule les siennes, pas celles des autres', async () => {
    const id = await take('Alice', 'cafe');
    await take('Alice', 'soda', true);
    expect(db.lines.map(l => [l.label, l.price, l.guest, l.by_member])).toEqual([['Café', 50, false, 'Alice'], ['Soda', 150, true, 'Alice']]);
    await expect(take('Bob', 'cafe')).rejects.toThrow(/tes propres/);
    as('Bob');
    await expect(bar.undo(id)).rejects.toThrow(/tes propres/);
    as('Alice');
    await bar.undo(id);
    expect(due('Alice')).toBe(150);
    as(null);
    await expect(take('Alice', 'cafe')).rejects.toThrow(/connectés/);
    await expect(bar.undo(id)).rejects.toThrow(/connectés/);
  });
  it('annuler : dix minutes, puis un gestionnaire ; personne n\'efface sa propre ardoise', async () => {
    const id = await take('Alice', 'cafe');
    now += 9 * MIN;
    expect(canUndo((await bar.load())!.lines[0], now)).toBe(true);
    now += MIN;
    await expect(bar.undo(id)).rejects.toThrow(/10 minutes/);
    as('Gest');
    await bar.undo(id);
    expect(due('Alice')).toBe(0);
    const own = await take('Gest', 'soda');
    now += 11 * MIN;
    await expect(bar.undo(own)).rejects.toThrow(/quelqu'un d'autre/);
    as('Admin');
    await bar.undo(own);
  });
  it('le prix est celui du moment ; produit retiré ou adhérent parti : refus', async () => {
    await take('Alice', 'cafe');
    as('Gest');
    await bar.saveItem({ ...db.items[0], price: 80 });
    as('Alice');
    await take('Alice', 'cafe');
    expect(db.lines.map(l => l.price)).toEqual([50, 80]);
    await expect(take('Alice', 'vieux')).rejects.toThrow(/plus proposé/);
    as('Gest');
    await expect(take('Parti', 'cafe')).rejects.toThrow(/n'existe plus/);
    await expect(take('Alice', 'rien')).rejects.toThrow(/Introuvable/);
  });
  it('le comptoir note pour tous, ne voit que la soirée, et ne gère rien', async () => {
    db.lines = [line('vieux', 'Alice', 500, 3)];
    db.payments = [pay('p', 'Alice', 100, 'pending')];
    as('kiosk');
    const id = await take('Bob', 'cafe');
    await take('Bob', 'cafe', true);
    expect(db.lines.at(-1)).toMatchObject({ member_id: 'Bob', by_member: null, by_kiosk: 'demo-kiosk' });
    const c = await bar.counter();
    expect(c.tally).toEqual([{ member_id: 'Bob', item_id: 'cafe', n: 2 }]);
    expect(c.people.map(x => x.id)).toEqual(['Admin', 'Alice', 'Bob', 'Gest', 'Tres']);
    expect(Object.keys(c).sort()).toEqual(['items', 'people', 'queued', 'tally']);
    await bar.undo(id);
    expect((await bar.counter()).tally[0].n).toBe(1);
    await expect(bar.undo('vieux')).rejects.toThrow(/Introuvable/);
    const late = await take('Bob', 'cafe');
    now += 11 * MIN;
    await expect(bar.undo(late)).rejects.toThrow(/10 minutes/);
    for (const op of [() => bar.load(), () => bar.detail('Bob'), () => bar.report(0), () => bar.declare(100, 'cash'), () => bar.decide('p', true), () => bar.receive('Bob', 100, 'cash'), () => bar.adjust('Bob', 100, 'x'), () => bar.remind(['Bob']), () => bar.saveItem(db.items[0]), () => bar.saveSettings(db.settings), () => bar.moveItem('cafe', 1), () => bar.kiosks(), () => bar.createKiosk('x'), () => bar.revokeKiosk('x')]) await expect(op()).rejects.toThrow(/connectés/);
    as('Alice');
    await expect(bar.counter()).rejects.toThrow(/gestionnaires/);
  });
  it('chacun ne voit que son ardoise ; l\'équipe les voit toutes', async () => {
    db.lines = [line('a', 'Alice', 100), line('b', 'Bob', 200)];
    db.payments = [pay('p', 'Alice', 50), pay('q', 'Bob', 60, 'pending')];
    const seen = async (id: string) => { as(id); const d = (await bar.load())!; return [d.lines.length, d.payments.length, d.team?.slates.length ?? null, d.team?.pending.length ?? null, d.manage, d.validate]; };
    expect(await seen('Alice')).toEqual([1, 1, null, null, false, false]);
    expect(await seen('Gest')).toEqual([0, 0, 2, 1, true, false]);
    expect(await seen('Tres')).toEqual([0, 0, 2, 1, true, true]);
    expect(await seen('Admin')).toEqual([0, 0, 2, 1, true, true]);
    as('Alice');
    await expect(bar.detail('Bob')).rejects.toThrow(/gestionnaires/);
    await expect(bar.report(0)).rejects.toThrow(/gestionnaires/);
    (await bar.load())!.lines[0].price = 0;
    expect(db.lines[0].price).toBe(100);
    as('Gest');
    expect((await bar.detail('Bob')).payments[0]).toMatchObject({ name: 'Bob Test', amount: 60, decided_by: null });
    as(null);
    await expect(bar.load()).rejects.toThrow(/connectés/);
  });
  it('payer : déclaré par l\'adhérent, validé par la trésorerie ou un administrateur seulement', async () => {
    db.lines = [line('a', 'Alice', 500)];
    await bar.declare(500, 'cash');
    const p = db.payments[0].id;
    expect([due('Alice'), slate('Alice').open]).toEqual([500, 0]);
    for (const who of ['Alice', 'Bob', 'Gest']) { as(who); await expect(bar.decide(p, true)).rejects.toThrow(/valident/); }
    as('Tres');
    await bar.decide(p, true);
    expect([due('Alice'), db.payments[0].decided_by]).toEqual([0, 'Tres']);
    await expect(bar.decide(p, false)).rejects.toThrow(/déjà traité/);
    as('Alice');
    await expect(bar.withdraw(p)).rejects.toThrow(/retiré/);
    for (const bad of [0, -5, 1.5, NaN, 1_000_000]) await expect(bar.declare(bad, 'cash')).rejects.toThrow(/invalide/);
  });
  it('refuser, retirer sa déclaration', async () => {
    db.lines = [line('a', 'Alice', 500)];
    await bar.declare(500, 'transfer');
    as('Admin');
    await bar.decide(db.payments[0].id, false);
    expect(slate('Alice')).toMatchObject({ due: 500, open: 500 });
    as('Alice');
    await bar.declare(200, 'cash');
    as('Bob');
    await expect(bar.withdraw(db.payments[1].id)).rejects.toThrow(/retiré/);
    as('Alice');
    await bar.withdraw(db.payments[1].id);
    expect(db.payments).toHaveLength(1);
  });
  it('personne ne valide son propre paiement, sauf à être seul', async () => {
    as('Tres');
    await bar.declare(300, 'cash');
    const p = db.payments[0].id;
    await expect(bar.decide(p, true)).rejects.toThrow(/autre/);
    await expect(bar.receive('Tres', 100, 'cash')).rejects.toThrow(/autre/);
    await expect(bar.adjust('Tres', -100, 'cadeau')).rejects.toThrow(/autre/);
    as('Admin');
    await bar.decide(p, true);
    await expect(bar.receive('Admin', 100, 'cash')).rejects.toThrow(/autre/);
    people = people.filter(m => m.id !== 'Tres');
    as('Admin');
    await bar.receive('Admin', 100, 'cash');
    people.push(person('SansCompte', 'member', { treasurer: true, user_id: null }));
    await bar.receive('Admin', 100, 'cash');
  });
  it('annuler une correction : trésorerie et administrateurs, jamais la sienne', async () => {
    as('Tres');
    await bar.adjust('Alice', 900, 'Reprise');
    await bar.adjust('Tres', 900, 'Reprise');
    const [a, t] = db.lines.map(l => l.id);
    as('Alice');
    await expect(bar.undo(a)).rejects.toThrow(/valident/);
    as('Gest');
    await expect(bar.undo(a)).rejects.toThrow(/valident/);
    as('Tres');
    await expect(bar.undo(t)).rejects.toThrow(/autre/);
    await bar.undo(a);
    as('Admin');
    await bar.undo(t);
    expect([due('Alice'), due('Tres')]).toEqual([0, 0]);
  });
  it('encaisser et corriger : trésorerie et administrateurs', async () => {
    as('Gest');
    await expect(bar.receive('Alice', 100, 'cash')).rejects.toThrow(/valident/);
    await expect(bar.adjust('Alice', 100, 'x')).rejects.toThrow(/valident/);
    as('Tres');
    await bar.adjust('Alice', 1450, 'Reprise du tableau papier');
    await bar.receive('Alice', 450, 'cash');
    await bar.adjust('Alice', -100, 'Erreur');
    expect(due('Alice')).toBe(900);
    for (const bad of [0, 0.5, 200_000]) await expect(bar.adjust('Alice', bad, 'x')).rejects.toThrow(/invalide/);
    await expect(bar.adjust('Alice', 5, '  ')).rejects.toThrow(/motif/);
  });
  it('rappels : par l\'équipe, une fois tant que la personne ne l\'a pas vu, jamais sans dette', async () => {
    db.lines = [line('a', 'Alice', 700), line('b', 'Bob', 100), line('c', 'Parti', 100)];
    people.push(person('Papier', 'member', { user_id: null }));
    db.lines.push(line('d', 'Papier', 100));
    await expect(bar.remind(['Alice'])).rejects.toThrow(/gestionnaires/);
    as('Gest');
    expect(await bar.remind(['Alice', 'Alice', 'Tres', 'Parti', 'Papier', 'inconnu'])).toBe(1);
    expect(await bar.remind(['Alice'])).toBe(0);
    as('Bob');
    await bar.seen();
    expect(db.reminders[0]).toMatchObject({ member_id: 'Alice', amount: 700, seen_at: null });
    as('Alice');
    await bar.seen();
    expect(db.reminders[0].seen_at).not.toBeNull();
    as('Tres');
    expect(await bar.remind(['Alice'])).toBe(1);
    as('Bob');
    await bar.declare(100, 'cash');
    as('Admin');
    expect(await bar.remind(['Bob'])).toBe(0);
  });
  it('tarifs et réglages : l\'équipe ; ordre et valeurs contrôlés', async () => {
    await expect(bar.saveItem({ ...db.items[0] })).rejects.toThrow(/gestionnaires/);
    await expect(bar.saveSettings(db.settings)).rejects.toThrow(/gestionnaires/);
    as('Gest');
    await bar.saveItem({ name: '  Chips ', emoji: '🥔', price: 100, active: true });
    expect(db.items.at(-1)).toMatchObject({ name: 'Chips', sort: 4 });
    await bar.moveItem(db.items.at(-1)!.id, -1);
    expect((await bar.load())!.items.map(i => i.name)).toEqual(['Café', 'Soda', 'Chips', 'Ancien']);
    await bar.moveItem('cafe', -1);
    for (const bad of [{ name: ' ' }, { price: 1.5 }, { price: -1 }]) await expect(bar.saveItem({ ...db.items[0], ...bad })).rejects.toThrow();
    await bar.saveSettings({ alert: 1500, days: 15, payInfo: ' Caisse ' });
    expect(db.settings).toEqual({ alert: 1500, days: 15, payInfo: 'Caisse' });
    await expect(bar.saveSettings({ ...db.settings, days: 0 })).rejects.toThrow(/invalide/);
  });
  it('une opération refusée n\'enregistre rien', async () => {
    await take('Bob', 'cafe').catch(() => {});
    await bar.decide('x', true).catch(() => {});
    await bar.declare(-1, 'cash').catch(() => {});
    expect([saves, db.lines, db.payments]).toEqual([0, [], []]);
  });
  it('tablettes : gestionnaires et administrateurs', async () => {
    for (const who of ['Alice', 'Tres']) { as(who); await expect(bar.createKiosk('Bar')).rejects.toThrow(/gestionnaires/); await expect(bar.kiosks()).rejects.toThrow(/gestionnaires/); }
    as('Gest');
    await expect(bar.createKiosk('  ')).rejects.toThrow(/nom/);
    await bar.createKiosk(' Bar ');
    expect((await bar.kiosks()).map(k => k.name)).toEqual(['Bar']);
    await bar.revokeKiosk(db.kiosks[0].id);
    expect(await bar.kiosks()).toEqual([]);
  });
});
