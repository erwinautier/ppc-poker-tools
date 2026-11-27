/** Tournoi heads-up : tirages, exemptions, classement, barrage. */
import { describe, expect, it } from 'vitest';
import {
  boardOf, champion, currentDuel, drawPairs, eliminated, finished, huResults, inPlay, knownPlaces, needsPlayoff,
  nextIds, playoffPairs, roundLabel, standings, suggestedRounds, type Board, type Pair,
} from '../src/lib/hu';
import { withSettings, type HuMatch, type HuSystem } from '../src/lib/types';

/** Générateur fixe : les tirages sont reproductibles. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
/** Le plus petit numéro gagne toujours : p1 est le plus fort. */
const strongest = (a: string, b: string) => (Number(a.slice(1)) < Number(b.slice(1)) ? a : b);

class Sim {
  rows: HuMatch[] = [];
  n = 0;
  constructor(public system: HuSystem, public players: string[], public rounds = 0, public rnd = rng(7)) {}
  get board(): Board { return boardOf(withSettings({ format: 'hu', hu: { system: this.system, rounds: this.rounds } }), this.players, this.rows); }
  add(pairs: Pair[], playoff = false) {
    const round = Math.max(0, ...this.rows.map(m => m.round)) + 1;
    for (const p of pairs) this.rows.push({ id: `m${++this.n}`, tournament_id: 't', round, playoff, a: p.a, b: p.b, winner: null, created_at: String(this.n).padStart(4, '0') });
    return round;
  }
  /** Tire le tour suivant et le joue (gagnant choisi par « who »). */
  play(who: (a: string, b: string) => string = strongest) {
    const next = nextIds(this.board);
    if (!next) throw new Error('pas de tour à tirer');
    const round = this.add(drawPairs(this.board, next, this.rnd));
    for (const m of this.rows.filter(x => x.round === round && x.b)) m.winner = who(m.a, m.b!);
    return round;
  }
}

describe('élimination directe', () => {
  it('8 joueurs : trois tours, places ex æquo par tour', () => {
    const s = new Sim('elimination', ids(8));
    expect(roundLabel(s.board, { n: 1, matches: Array(4).fill(null), bye: null, playoff: false })).toBe('Quarts de finale');
    s.play(); s.play(); s.play();
    expect(finished(s.board)).toBe(true);
    expect(champion(s.board)).toBe('p1');
    const places = huResults(s.board)!.map(r => r.position);
    expect(places).toEqual([1, 2, 3, 3, 5, 5, 5, 5]);
    expect(nextIds(s.board)).toBeNull();
  });

  it('6 joueurs : exemptions données à des joueurs différents', () => {
    const s = new Sim('elimination', ids(6));
    s.play();                       // 3 matchs, 3 qualifiés
    s.play();                       // 1 match + 1 exempté
    const byes = s.board.rounds.map(r => r.bye).filter(Boolean);
    expect(byes).toHaveLength(1);
    s.play();                       // finale
    expect(finished(s.board)).toBe(true);
    const res = new Map(huResults(s.board)!.map(r => [r.entry_id, r.position]));
    expect([...res.values()].sort()).toEqual([1, 2, 3, 4, 4, 4]);
    expect(res.get('p1')).toBe(1);
  });

  it('en cours : joueurs en lice, places déjà connues, match d\'un joueur', () => {
    const s = new Sim('elimination', ids(5));
    s.play();
    const b = s.board;
    expect(eliminated(b)).toHaveLength(2);
    expect(inPlay(b)).toHaveLength(3);
    // Après le 1er tour restent 3 joueurs : les deux perdants finissent 4es.
    expect([...knownPlaces(b).values()]).toEqual([4, 4]);
    const bye = b.rounds[0].bye!;
    expect(currentDuel(b, bye)).toMatchObject({ duel: null });
    expect(huResults(b)).toBeNull();
  });

  it('le tour suivant attend tous les résultats', () => {
    const s = new Sim('elimination', ids(4));
    s.add(drawPairs(s.board, ids(4), rng(3)));
    expect(nextIds(s.board)).toBeNull();
    s.rows[0].winner = s.rows[0].a;
    expect(nextIds(s.board)).toBeNull();
    s.rows[1].winner = s.rows[1].b;
    expect(nextIds(s.board)).toHaveLength(2);
  });
});

describe('ronde suisse', () => {
  it('tours suggérés : assez pour un seul invaincu', () => {
    expect([2, 4, 5, 8, 9, 16, 20].map(suggestedRounds)).toEqual([1, 2, 3, 3, 4, 4, 5]);
  });

  it('7 joueurs en 3 tours : personne ne sort, pas de revanche, exemption à ½ point', () => {
    const s = new Sim('swiss', ids(7));
    expect(s.board.planned).toBe(3);
    s.play(); s.play(); s.play();
    const b = s.board;
    expect(finished(b)).toBe(true);
    expect(inPlay(b)).toHaveLength(7);
    const seen = new Set<string>();
    for (const r of b.rounds) for (const m of r.matches) {
      const key = [m.a, m.b].sort().join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    const byes = b.rounds.map(r => r.bye);
    expect(new Set(byes).size).toBe(3);
    const st = standings(b);
    expect(st.reduce((x, r) => x + r.points, 0)).toBe(3 * 3 + 3 * 0.5);
    expect(st[0].id).toBe('p1');
    expect(st[0].points).toBe(3);
    expect(champion(b)).toBe('p1');
    expect(huResults(b)!.map(r => r.position)[0]).toBe(1);
  });

  it('égalité parfaite en tête : barrage, qui décide la 1re place', () => {
    // 4 joueurs, 1 tour : les deux vainqueurs sont à égalité sur tous les critères.
    const s = new Sim('swiss', ids(4), 1);
    s.add([{ a: 'p1', b: 'p2' }, { a: 'p3', b: 'p4' }]);
    s.rows[0].winner = 'p1';
    s.rows[1].winner = 'p3';
    const b = s.board;
    expect(finished(b)).toBe(true);
    // p1 et p3 : 1 point, Buchholz 0, aucune confrontation.
    expect(needsPlayoff(b)).toBe(true);
    expect(champion(b)).toBeNull();
    const pairs = playoffPairs(b);
    expect(pairs[0].b).not.toBeNull();
    s.add(pairs, true);
    expect(finished(s.board)).toBe(false);
    s.rows.at(-1)!.winner = 'p3';
    expect(champion(s.board)).toBe('p3');
    expect(standings(s.board).slice(0, 2).map(x => x.id)).toEqual(['p3', 'p1']);
    expect(nextIds(s.board)).toBeNull();
  });

  it('un joueur pointé après le premier tour joue les tours suivants', () => {
    const s = new Sim('swiss', ids(4), 3);
    s.play();
    s.players = [...s.players, 'p5'];
    expect(nextIds(s.board)).toHaveLength(5);
    s.play();
    expect(s.board.rounds[1].matches.length + (s.board.rounds[1].bye ? 1 : 0)).toBe(3);
  });

  it('nombre de tours choisi', () => {
    const s = new Sim('swiss', ids(8), 2);
    s.play(); s.play();
    expect(finished(s.board)).toBe(true);
    expect(roundLabel(s.board, s.board.rounds[0])).toBe('sur 2');
  });
});

describe('lecture des matchs enregistrés', () => {
  it('exemption = ligne sans adversaire ; barrage repéré', () => {
    const rows: HuMatch[] = [
      { id: 'a', tournament_id: 't', round: 1, playoff: false, a: 'p1', b: 'p2', winner: 'p1', created_at: '1' },
      { id: 'b', tournament_id: 't', round: 1, playoff: false, a: 'p3', b: null, winner: null, created_at: '2' },
      { id: 'c', tournament_id: 't', round: 2, playoff: true, a: 'p1', b: 'p3', winner: null, created_at: '3' },
    ];
    const b = boardOf(withSettings({ format: 'hu', hu: { system: 'swiss', rounds: 1 } }), ['p1', 'p2', 'p3', 'p4'], rows);
    expect(b.rounds.map(r => [r.n, r.matches.length, r.bye, r.playoff])).toEqual([[1, 1, 'p3', false], [2, 1, null, true]]);
    expect(b.players).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});
