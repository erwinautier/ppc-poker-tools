import { describe, expect, it } from 'vitest';
import { readClock, clockOf, play, pause, goTo, back, nudge, levelNumber, withinLevel } from '../src/lib/clock';
import { generateLevels, niceBlinds, estimateMinutes, PRESETS } from '../src/lib/structure';
import { autoPercents, chipCount, finalRows, outcomes, payouts, replay } from '../src/lib/engine';
import { placePoints, points, standings } from '../src/lib/scoring';
import { advise, breakTable, draw, placeOne, tablesOf } from '../src/lib/seating';
import { accountName, nameScore, waitingAccounts } from '../src/lib/accounts';
import { DEFAULT_SCORING, clubTeam, isLastAdmin, withSettings, type Entry, type Knockout, type Level, type Account, type Member, type Settings, type Tournament } from '../src/lib/types';

const L = (bb: number, minutes = 10): Level => ({ kind: 'level', sb: bb / 2, bb, ante: 0, minutes });
const B = (minutes = 5): Level => ({ kind: 'break', sb: 0, bb: 0, ante: 0, minutes });
const MIN = 60_000;

const entry = (id: string, over: Partial<Entry> = {}): Entry => ({
  id, tournament_id: 't', member_id: `m-${id}`, name: id, status: 'registered', registered_at: '', checked_in: true,
  rebuys: 0, addons: 0, table_no: null, seat_no: null, bounty_start: null, points_adjust: 0,
  final_position: null, final_kos: null, final_bounty: null, ...over,
});
let seq = 0;
const ko = (victim: string, killers: string[] = [], rebuy = false, tournament = 't'): Knockout => ({
  id: `k${++seq}`, seq, tournament_id: tournament, victim_id: victim, killer_ids: killers, rebuy, level: null, created_at: '',
});
const settings = (s: Partial<Settings> = {}) => withSettings(s);
const tournament = (over: Partial<Tournament> = {}): Tournament => ({
  id: 't', championship_id: 'c', name: 'T', description: '', venue: '', starts_at: '2026-11-25T19:00:00Z', status: 'running',
  visibility: 'members', max_players: null, seats_per_table: 8, starting_stack: 10000, structure_name: '', levels: [], chips: [],
  settings: settings(), clock_level: 0, clock_elapsed_ms: 0, clock_anchor: null, finished_at: null, rev: 0, created_at: '', ...over,
});

describe('horloge', () => {
  const levels = [L(100), L(200), B(), L(400)];
  it('en pause, le temps ne bouge pas', () => {
    const v = readClock(levels, { level: 1, elapsedMs: 3 * MIN, anchor: null }, 1e12);
    expect(v.index).toBe(1);
    expect(v.remainingMs).toBe(7 * MIN);
    expect(v.running).toBe(false);
  });
  it('enchaîne les niveaux et la pause sans aucune écriture', () => {
    const s = { level: 0, elapsedMs: 0, anchor: 0 };
    expect(readClock(levels, s, 9 * MIN).index).toBe(0);
    expect(readClock(levels, s, 10 * MIN).index).toBe(1);
    expect(readClock(levels, s, 22 * MIN)).toMatchObject({ index: 2, remainingMs: 3 * MIN });
    expect(readClock(levels, s, 26 * MIN)).toMatchObject({ index: 3, remainingMs: 9 * MIN });
  });
  it('reste sur le dernier niveau une fois la structure épuisée', () => {
    const v = readClock(levels, { level: 0, elapsedMs: 0, anchor: 0 }, 500 * MIN);
    expect(v).toMatchObject({ index: 3, remainingMs: 0, overtime: true, next: null });
  });
  it('temps avant la pause', () => {
    const s = { level: 0, elapsedMs: 0, anchor: 0 };
    expect(readClock(levels, s, 4 * MIN).toBreakMs).toBe(16 * MIN);
    expect(readClock(levels, s, 22 * MIN).toBreakMs).toBeNull();
    expect(readClock(levels, s, 30 * MIN).toBreakMs).toBeNull();
  });
  it('commandes : pause, reprise, saut, retour, ajustement', () => {
    const v = readClock(levels, { level: 0, elapsedMs: 0, anchor: 0 }, 14 * MIN);
    expect(pause(v)).toEqual({ level: 1, elapsedMs: 4 * MIN, running: false });
    expect(play(v)).toEqual({ level: 1, elapsedMs: 4 * MIN, running: true });
    expect(goTo(v, levels, 99)).toEqual({ level: 3, elapsedMs: 0, running: true });
    expect(back(v, levels).level).toBe(1);
    expect(back(readClock(levels, { level: 1, elapsedMs: 1000, anchor: null }, 0), levels).level).toBe(0);
    expect(nudge(v, MIN).elapsedMs).toBe(3 * MIN);
    expect(nudge(v, -30 * MIN).elapsedMs).toBe(10 * MIN - 1000);
    // Ajouter du temps au tout début d'un niveau allonge bien ce niveau.
    const start = readClock(levels, { level: 1, elapsedMs: 0, anchor: null }, 0);
    const longer = readClock(levels, { ...nudge(start, MIN), anchor: null }, 0);
    expect(longer.remainingMs).toBe(11 * MIN);
    expect(longer.progress).toBe(0);
  });
  it('numérote les niveaux sans compter les pauses', () => {
    expect(levelNumber(levels, 1)).toBe(2);
    expect(levelNumber(levels, 2)).toBe(2);
    expect(levelNumber(levels, 3)).toBe(3);
    expect(withinLevel(levels, 2, 2)).toBe(true);
    expect(withinLevel(levels, 3, 2)).toBe(false);
    expect(withinLevel(levels, 0, 0)).toBe(false);
  });
  it('structure vide : pas de plantage', () => {
    expect(readClock([], { level: 3, elapsedMs: 5, anchor: 0 }, 10).level).toBeNull();
    expect(clockOf(tournament({ clock_elapsed_ms: 12 })).anchor).toBeNull();
  });
});

describe('générateur de structure', () => {
  it('blindes payables avec le plus petit jeton', () => {
    for (const chip of [5, 25, 100]) for (const bb of niceBlinds(chip)) expect((bb / 2) % chip).toBe(0);
  });
  for (const p of PRESETS) {
    it(`${p.name} : strictement croissante et proche de la durée visée`, () => {
      const levels = generateLevels(p.input);
      const bbs = levels.filter(l => l.kind === 'level').map(l => l.bb);
      for (let i = 1; i < bbs.length; i++) {
        expect(bbs[i]).toBeGreaterThan(bbs[i - 1]);
        expect(bbs[i] / bbs[i - 1]).toBeLessThanOrEqual(2);
      }
      const est = estimateMinutes(levels, p.input.players, p.input.stack)!;
      expect(est).not.toBeNull();
      expect(Math.abs(est - p.input.totalMinutes)).toBeLessThanOrEqual(p.input.levelMinutes * 2 + p.input.breakMinutes);
      expect(levels.at(-1)!.kind).toBe('level');
    });
  }
  it('aucun champ extrême ne fait planter', () => {
    for (const players of [2, 9, 120]) for (const total of [30, 600]) for (const chip of [1, 25, 500]) {
      const l = generateLevels({ players, stack: 5000, totalMinutes: total, levelMinutes: 12, startBB: 50, ante: 'bb', anteFrom: 1, smallestChip: chip, breakEvery: 0, breakMinutes: 5 });
      expect(l.length).toBeGreaterThanOrEqual(4);
      expect(l.every(x => x.sb > 0 && x.bb === x.sb * 2)).toBe(true);
    }
  });
});

describe('éliminations', () => {
  const four = ['a', 'b', 'c', 'd'].map(id => entry(id));
  it('places, KO et vainqueur', () => {
    const r = replay(four, [ko('a', ['b']), ko('c', ['b']), ko('b', ['d'])], settings());
    expect(r.byId.get('a')!.position).toBe(4);
    expect(r.byId.get('c')!.position).toBe(3);
    expect(r.byId.get('b')).toMatchObject({ position: 2, kos: 2 });
    expect(r.alive.map(p => p.entry.id)).toEqual(['d']);
    expect(finalRows(r, settings()).map(x => [x.entry_id, x.position])).toEqual([['d', 1], ['b', 2], ['c', 3], ['a', 4]]);
  });
  it('une inscription tardive décale les places déjà attribuées', () => {
    expect(replay([...four, entry('e')], [ko('a')], settings()).byId.get('a')!.position).toBe(5);
  });
  it('KO partagé', () => {
    const r = replay(four, [ko('a', ['b', 'c'])], settings({ bounty: { mode: 'fixed', unit: 'eur', amount: 10 } }));
    expect(r.byId.get('b')).toMatchObject({ kos: 0.5, bountyWon: 5 });
  });
  it('prime progressive : moitié encaissée, moitié sur la tête, et le compte est bon', () => {
    const s = settings({ bounty: { mode: 'progressive', unit: 'eur', amount: 20 } });
    const r = replay(four, [ko('a', ['b']), ko('b', ['c']), ko('d', ['c'])], s);
    expect(r.byId.get('b')).toMatchObject({ bountyWon: 10, head: 0 });
    expect(r.byId.get('c')).toMatchObject({ bountyWon: 25, head: 45 });
    const rows = finalRows(r, s);
    expect(rows.reduce((x, y) => x + y.bounty, 0)).toBe(80);
  });
  it('prime fixe en euros : le vainqueur récupère la sienne ; en points, non', () => {
    const kos = [ko('a', ['b']), ko('c', ['b']), ko('d', ['b'])];
    const e = settings({ bounty: { mode: 'fixed', unit: 'eur', amount: 5 } });
    expect(finalRows(replay(four, kos, e), e)[0].bounty).toBe(20);
    const p = settings({ bounty: { mode: 'fixed', unit: 'pts', amount: 5 } });
    expect(finalRows(replay(four, kos, p), p)[0].bounty).toBe(15);
  });
  it('recave : la prime est versée, le joueur reste en course avec une prime neuve', () => {
    const s = settings({ bounty: { mode: 'fixed', unit: 'eur', amount: 10 } });
    const r = replay(four, [ko('a', ['b'], true)], s);
    expect(r.alive.length).toBe(4);
    expect(r.byId.get('a')!.head).toBe(10);
    expect(r.byId.get('b')!.bountyWon).toBe(10);
  });
  it('prime spéciale sur un joueur', () => {
    const s = settings({ bounty: { mode: 'fixed', unit: 'lot', amount: 0 } });
    const r = replay([entry('a', { bounty_start: 1 }), entry('b'), entry('c')], [ko('a', ['b']), ko('c', ['b'])], s);
    expect(r.byId.get('b')!.bountyWon).toBe(1);
  });
  it('abandon : prime non attribuée, pas de KO', () => {
    const r = replay(four, [ko('a')], settings({ bounty: { mode: 'fixed', unit: 'eur', amount: 10 } }));
    expect(r.unclaimed).toBe(10);
  });
  it('joueur inconnu ou déjà sorti dans le journal : ignoré', () => {
    const r = replay(four, [ko('zzz', ['a']), ko('a', ['b']), ko('a', ['c'])], settings());
    expect(r.alive.length).toBe(3);
    expect(r.byId.get('c')!.kos).toBe(0);
  });
  it('résultats figés : priorité à ce qui est enregistré, absents exclus', () => {
    const t = tournament({ status: 'finished' });
    const list = outcomes(t, [entry('a', { final_position: 2, final_kos: 1 }), entry('b', { final_position: 1 }), entry('c')], []);
    expect(list.map(o => o.entry.id)).toEqual(['b', 'a']);
  });
  it('en direct, un joueur en course vaut au pire la place « joueurs restants »', () => {
    const list = outcomes(tournament(), four, [ko('a', ['b'])]);
    expect(list.find(o => o.entry.id === 'b')).toMatchObject({ position: 3, provisional: true });
    expect(list.find(o => o.entry.id === 'a')).toMatchObject({ position: 4, provisional: false });
  });
});

describe('jetons et dotation', () => {
  it('tapis moyen avec recaves et add-ons', () => {
    const t = tournament({ settings: settings({ rebuy: { enabled: true, price: 10, stack: 8000, untilLevel: 4, max: 1 }, addon: { enabled: true, price: 5, stack: 5000 } }) });
    const c = chipCount(t, [entry('a', { rebuys: 1 }), entry('b', { addons: 1 }), entry('c')], 2, 1000);
    expect(c).toEqual({ totalChips: 43000, avgStack: 21500, avgBB: 21.5 });
  });
  it('la somme distribuée vaut toujours la cagnotte', () => {
    for (let n = 2; n <= 60; n++) for (const rounding of [1, 5, 10]) {
      const t = tournament({ settings: settings({ buyIn: 17, payouts: { mode: 'auto', percents: [], lots: [], rounding } }) });
      const list = payouts(t, Array.from({ length: n }, (_, i) => entry(`p${i}`)));
      expect(Math.round(list.reduce((s, p) => s + p.amount!, 0) * 100) / 100).toBe(17 * n);
      for (let i = 1; i < list.length; i++) expect(list[i].amount!).toBeLessThanOrEqual(list[i - 1].amount!);
    }
  });
  it('les répartitions conseillées font 100 %', () => {
    for (let n = 2; n < 80; n++) expect(autoPercents(n).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('lots : libellés par place', () => {
    const t = tournament({ settings: settings({ payouts: { mode: 'lots', percents: [], lots: ['Coupe', ' ', 'Porte-clés'], rounding: 1 } }) });
    expect(payouts(t, [entry('a')])).toEqual([{ place: 1, amount: null, label: 'Coupe' }, { place: 3, amount: null, label: 'Porte-clés' }]);
  });
});

describe('points et classement', () => {
  it('barème selon le nombre de joueurs', () => {
    const s = { ...DEFAULT_SCORING, brackets: [{ minPlayers: 20, points: [200, 150] }, { minPlayers: 0, points: [100, 75] }] };
    expect(placePoints(s, 1, 12)).toBe(100);
    expect(placePoints(s, 1, 20)).toBe(200);
    expect(placePoints(s, 3, 20)).toBe(0);
  });
  it('formules linéaire et racine', () => {
    expect(placePoints({ ...DEFAULT_SCORING, method: 'linear', factor: 2 }, 3, 10)).toBe(16);
    expect(placePoints({ ...DEFAULT_SCORING, method: 'sqrt', factor: 10 }, 4, 36)).toBe(30);
  });
  it('coefficient sur la place seulement, plus participation, KO, primes et ajustement', () => {
    const s = { ...DEFAULT_SCORING, participation: 5, koPoints: 3 };
    expect(points(s, { position: 1, players: 10, kos: 2, bountyPts: 4, adjust: -1, coefficient: 1.5 })).toBe(164);
  });

  const t1 = tournament({ id: 't1', status: 'finished' });
  const t2 = tournament({ id: 't2', status: 'finished' });
  const t3 = tournament({ id: 't3', status: 'finished' });
  const res = (t: string, order: string[], over: Record<string, Partial<Entry>> = {}) =>
    order.map((p, i) => entry(`${t}-${p}`, { tournament_id: t, member_id: p, name: p, final_position: i + 1, final_kos: 0, ...over[p] }));
  const scoring = { ...DEFAULT_SCORING, participation: 0, brackets: [{ minPlayers: 0, points: [10, 6, 4] }] };

  it('cumule, départage, et garde les ex æquo', () => {
    const rows = standings({ scoring, tournaments: [t1, t2], entries: [...res('t1', ['a', 'b', 'c']), ...res('t2', ['b', 'a', 'c'])], knockouts: [] });
    expect(rows.map(r => [r.name, r.total, r.rank])).toEqual([['a', 16, 1], ['b', 16, 1], ['c', 8, 3]]);
    const withKo = standings({ scoring, tournaments: [t1, t2], entries: [...res('t1', ['a', 'b', 'c'], { b: { final_kos: 2 } }), ...res('t2', ['b', 'a', 'c'])], knockouts: [] });
    expect(withKo.map(r => [r.name, r.rank])).toEqual([['b', 1], ['a', 2], ['c', 3]]);
  });
  it('ne retient que les meilleurs résultats', () => {
    const rows = standings({ scoring: { ...scoring, bestOf: 2 }, tournaments: [t1, t2, t3], entries: [...res('t1', ['a', 'b']), ...res('t2', ['a', 'b']), ...res('t3', ['b', 'a'])], knockouts: [] });
    const a = rows.find(r => r.name === 'a')!;
    expect(a.total).toBe(20);
    expect(a.cells.get('t3')!.counted).toBe(false);
    expect(a.played).toBe(3);
  });
  it('les invités comptent dans le nombre de joueurs, pas dans le classement', () => {
    const list = [...res('t1', ['a', 'x', 'b'], { x: { member_id: null } })];
    const rows = standings({ scoring, tournaments: [t1], entries: list, knockouts: [] });
    expect(rows.map(r => [r.name, r.total])).toEqual([['a', 10], ['b', 4]]);
    expect(rows[0].cells.get('t1')!.players).toBe(3);
    expect(standings({ scoring: { ...scoring, rankGuests: true }, tournaments: [t1], entries: list, knockouts: [] }).length).toBe(3);
  });
  it('brouillons, tournois à venir et annulés ne rapportent rien', () => {
    for (const status of ['draft', 'open', 'closed', 'cancelled'] as const) {
      expect(standings({ scoring, tournaments: [tournament({ id: 't1', status })], entries: res('t1', ['a']), knockouts: [] })).toEqual([]);
    }
  });
});

describe('tables', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
  const seated = (n: number, size: number) => {
    const s = draw(ids(n), size);
    return ids(n).map(id => { const x = s.find(y => y.entry_id === id)!; return entry(id, { table_no: x.table_no, seat_no: x.seat_no }); });
  };
  it('tirage équilibré, sans doublon de place', () => {
    for (let n = 2; n <= 60; n++) for (const size of [6, 8, 9, 10]) {
      const list = seated(n, size);
      const t = tablesOf(list);
      const counts = t.map(x => x.players.length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(Math.max(...counts)).toBeLessThanOrEqual(size);
      expect(new Set(list.map(e => `${e.table_no}-${e.seat_no}`)).size).toBe(n);
    }
  });
  it('joueur tardif : table la moins remplie, siège libre', () => {
    const list = seated(17, 9);
    const s = placeOne('new', list, 9);
    expect(tablesOf(list).find(t => t.no === s.table_no)!.players.length).toBe(8);
    expect(list.some(e => e.table_no === s.table_no && e.seat_no === s.seat_no)).toBe(false);
    expect(placeOne('new', seated(18, 9), 9)).toMatchObject({ table_no: 3, seat_no: 1 });
  });
  it('conseils : équilibrer, fermer une table, table finale', () => {
    const list = seated(16, 8);
    const t1 = list.filter(e => e.table_no === 1);
    const two = list.filter(e => e !== t1[0] && e !== t1[1]);
    expect(advise(two, 8)[0]).toMatchObject({ kind: 'move', from: 2, to: 1 });
    expect(advise(list, 8)).toEqual([]);
    expect(advise(seated(17, 8).filter(e => e.id !== 'p0'), 8)[0]).toMatchObject({ kind: 'break' });
    const nine = seated(9, 8);
    expect(advise(nine.slice(0, 8), 8)[0]).toEqual({ kind: 'final' });
  });
  it('fermer une table replace tout le monde', () => {
    const list = seated(17, 8).slice(0, 15);
    const no = tablesOf(list).at(-1)!.no;
    const moves = breakTable(list, no, 8)!;
    const after = list.map(e => { const m = moves.find(x => x.entry_id === e.id); return m ? { ...e, table_no: m.table_no, seat_no: m.seat_no } : e; });
    expect(after.some(e => e.table_no === no)).toBe(false);
    expect(new Set(after.map(e => `${e.table_no}-${e.seat_no}`)).size).toBe(15);
    expect(breakTable(seated(16, 8), 1, 8)).toBeNull();
  });
});

describe('équipe du club', () => {
  const m = (id: string, over: Partial<Member> = {}): Member => ({ id, user_id: `u-${id}`, name: id, role: 'member', active: true, created_at: '', ...over });
  it('administrateurs d\'abord, sans les anciens ni les adhérents', () => {
    const list = [m('Zoé', { role: 'director' }), m('Bob'), m('Yan', { role: 'admin' }), m('Ève', { role: 'director' }), m('Parti', { role: 'admin', active: false })];
    expect(clubTeam(list).map(x => x.id)).toEqual(['Yan', 'Ève', 'Zoé']);
  });
  it('le dernier administrateur : actif et avec un compte', () => {
    const a = m('a', { role: 'admin' });
    expect(isLastAdmin([a, m('b', { role: 'director' })], a)).toBe(true);
    expect(isLastAdmin([a, m('b', { role: 'admin' })], a)).toBe(false);
    expect(isLastAdmin([a, m('b', { role: 'admin', user_id: null })], a)).toBe(true);
    expect(isLastAdmin([a, m('b', { role: 'admin', active: false })], a)).toBe(true);
    const paper = m('p', { role: 'admin', user_id: null });
    expect(isLastAdmin([paper], paper)).toBe(false);
  });
});

describe('comptes à valider', () => {
  const a = (user_id: string, over: Partial<Account> = {}): Account => ({ user_id, username: user_id, asked: null, email: null, confirmed: true, created_at: '2026-11-01', member_id: null, refused: false, ...over });
  it('ni les adhérents, ni les refusés ; adresses confirmées d\'abord, puis les plus récents', () => {
    const list = [a('vieux'), a('flou', { confirmed: false, created_at: '2026-12-01' }), a('neuf', { created_at: '2026-11-20' }), a('membre', { member_id: 'm' }), a('non', { refused: true })];
    expect(waitingAccounts(list).map(x => x.user_id)).toEqual(['neuf', 'vieux', 'flou']);
  });
  it('le nom indiqué au club passe avant le pseudo', () => {
    expect([accountName({ asked: 'Léa Riou', username: 'lea22' }), accountName({ asked: null, username: 'lea22' }), accountName({ asked: null, username: null })]).toEqual(['Léa Riou', 'lea22', 'Sans pseudo']);
  });
  it('propose la fiche au nom proche, accents compris', () => {
    expect(nameScore('gwendal salaun', 'Gwendal Salaün')).toBe(2);
    expect(nameScore('Gwendal', 'Gwendal Salaün')).toBe(1);
    expect(nameScore('Zoé', 'Gwendal Salaün')).toBe(0);
    expect(nameScore('♠', '♥')).toBe(0);
  });
});
