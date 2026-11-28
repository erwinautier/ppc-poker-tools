import { describe, expect, it } from 'vitest';
import { apply, boardMissing, positions, potOdds, potOf, replay, sizes, start, type Action, type Blinds, type Seat, type State } from '../src/lib/engine';
import { MAX_QUESTIONS, lineText, sanitize, story, toggleDecision, upgrade, type HandData } from '../src/lib/hand';
import { matchOption, questionsOf, voteOptions } from '../src/lib/vote';
import { readPosts } from '../src/lib/club';
import { clubLevel, nextLevel, prevLevel } from '../src/lib/levels';
import { decodeHand, encodeHand, handText } from '../src/lib/share';

const B: Blinds = { sb: 300, bb: 600, ante: 600, anteMode: 'bb' };
const nine = (stack = 23000): Seat[] => Array.from({ length: 9 }, () => ({ stack }));
// UTG 0, UTG+1 1, UTG+2 2, MP 3, HJ 4, CO 5, BTN 6, SB 7, BB 8
const fold = (p: number): Action => ({ p, k: 'fold' });
const ok = (s: State | string): State => { if (typeof s === 'string') throw new Error(s); return s; };
const run = (seats: Seat[], acts: Action[], b = B) => { const r = replay(b, seats, acts); if (r.error) throw new Error(r.error.message); return r.states.at(-1)!; };

const PRE: Action[] = [{ p: 0, k: 'raise', to: 1500 }, fold(1), fold(2), fold(3), fold(4), fold(5), { p: 6, k: 'call' }, fold(7), { p: 8, k: 'call' }];
const FLOP: Action[] = [{ p: 8, k: 'check' }, { p: 0, k: 'bet', to: 2500 }, { p: 6, k: 'call' }, fold(8)];
const seatsEx = () => { const s = nine(); s[0] = { stack: 20500 }; s[6] = { stack: 23000, cards: [50, 45] }; return s; };

describe('déroulé d\'une main', () => {
  it('antes et blindes posées, UTG parle', () => {
    const s = start(B, nine());
    expect(s.pot).toBe(600);
    expect(s.ps[7].bet).toBe(300);
    expect(s.ps[8].bet).toBe(600);
    expect(s.ps[8].stack).toBe(23000 - 1200);
    expect(s.toAct).toBe(0);
    expect(positions(9)[6]).toBe('BTN');
  });

  it('préflop puis flop : pot, ordre de parole, tour suivant', () => {
    const s = run(seatsEx(), PRE);
    expect(s.street).toBe(1);
    expect(s.pot).toBe(600 + 3 * 1500 + 300);
    expect(s.toAct).toBe(8);
    const f = run(seatsEx(), [...PRE, ...FLOP]);
    expect(f.street).toBe(2);
    expect(f.pot).toBe(5400 + 5000);
    expect(f.toAct).toBe(0);
  });

  it('tapis au turn : cote, réponses du vote, abattage', () => {
    const t = run(seatsEx(), [...PRE, ...FLOP, { p: 0, k: 'bet', to: 999999 }]);
    expect(t.ps[0].allin).toBe(true);
    expect(t.toAct).toBe(6);
    expect(potOdds(t)).toBeCloseTo(16500 / (10400 + 33000), 5);
    // Personne ne peut répondre à une relance : passer ou suivre.
    expect(voteOptions(t, 600).map(o => o.k)).toEqual(['fold', 'call']);
    expect(sizes(t, 600)).toEqual([]);
    const end = ok(apply(t, { p: 6, k: 'call' }, 600));
    expect(end.over).toBe(true);
    expect(end.won).toBeNull();
    expect(potOf(end)).toBe(10400 + 33000);
    expect(boardMissing(end, 4)).toEqual({ count: 1, optional: true });
  });

  it('relance non suivie : la mise en trop revient au relanceur', () => {
    const s = run(nine(), [{ p: 0, k: 'raise', to: 1500 }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(fold)]);
    expect(s.over).toBe(true);
    expect(s.won).toBe(0);
    expect(potOf(s)).toBe(600 + 300 + 600 + 600);
    expect(s.returned).toEqual({ p: 0, amount: 900 });
    expect(s.ps[0].stack).toBe(23000 - 600);
  });

  it('option de la grosse blinde après un limp de la petite', () => {
    const s = run(nine(), [...[0, 1, 2, 3, 4, 5, 6].map(fold), { p: 7, k: 'call' }]);
    expect(s.street).toBe(0);
    expect(s.toAct).toBe(8);
    const f = ok(apply(s, { p: 8, k: 'check' }, 600));
    expect(f.street).toBe(1);
    expect(f.toAct).toBe(7);
  });

  it('tête-à-tête : le bouton paie la petite blinde, parle d\'abord préflop, en dernier ensuite', () => {
    const b: Blinds = { sb: 50, bb: 100, ante: 0, anteMode: 'bb' };
    const s = start(b, [{ stack: 5000 }, { stack: 5000 }]);
    expect(s.ps[0].bet).toBe(50);
    expect(s.toAct).toBe(0);
    const f = run([{ stack: 5000 }, { stack: 5000 }], [{ p: 0, k: 'call' }, { p: 1, k: 'check' }], b);
    expect(f.street).toBe(1);
    expect(f.toAct).toBe(1);
  });

  it('ante par joueur, grosse blinde à court de jetons', () => {
    const b: Blinds = { sb: 100, bb: 200, ante: 25, anteMode: 'each' };
    const seats = nine(10000);
    seats[8] = { stack: 150 };
    const s = start(b, seats);
    expect(s.pot).toBe(9 * 25);
    expect(s.ps[8].allin).toBe(true);
    expect(s.ps[8].bet).toBe(125);
    expect(s.current).toBe(125);
  });

  it('refuse une action hors tour ou impossible', () => {
    const s = start(B, nine());
    expect(apply(s, { p: 3, k: 'fold' }, 600)).toMatch(/pas à ce joueur/);
    expect(apply(s, { p: 0, k: 'check' }, 600)).toMatch(/checker/);
    expect(apply(s, { p: 0, k: 'raise', to: 500 }, 600)).toMatch(/dépasser/);
  });

  it('tailles proposées : ouverture en bb, mise en fraction du pot', () => {
    const s = start(B, nine());
    expect(sizes(s, 600).map(x => x.to)).toEqual([1200, 1500, 1800, 23000]);
    const f = run(seatsEx(), PRE);
    expect(sizes(f, 600).map(x => x.label)).toEqual(['⅓ pot', '½ pot', '⅔ pot', 'Pot', 'Tapis']);
    expect(sizes(f, 600)[0].to).toBe(1800);
  });
});

describe('vote', () => {
  it('ouverture : passer, suivre, relance standard, tapis ; la réponse du héros est retrouvée', () => {
    const s = start(B, nine());
    const o = voteOptions(s, 600);
    expect(o.map(x => x.k)).toEqual(['fold', 'call', 'raise', 'raise']);
    expect(o[2].to).toBe(1500);
    expect(o[3].allin).toBe(true);
    expect(matchOption(o, s, { p: 0, k: 'raise', to: 1800 })).toBe(2);
    expect(matchOption(o, s, { p: 0, k: 'raise', to: 999999 })).toBe(3);
    expect(matchOption(o, s, { p: 0, k: 'fold' })).toBe(0);
  });
  it('personne n\'a misé : parole, deux tailles, tapis', () => {
    const f = run(seatsEx(), PRE);
    expect(voteOptions(f, 600).map(x => x.k)).toEqual(['check', 'bet', 'bet', 'bet']);
  });
});

const sample = (): HandData => ({
  v: 1, date: 1764000000000,
  ctx: { kind: 'club', name: 'Tournoi d\'hiver', level: 7, blinds: B, table: 9 },
  seats: seatsEx(), hero: 6,
  actions: [...PRE, ...FLOP, { p: 0, k: 'bet', to: 16500 }, { p: 6, k: 'call' }],
  board: [44, 21, 2, 31, 12], decisions: [14], winners: [6], tags: ['Hésitation'], complete: true,
});

describe('récit et partage', () => {
  it('regroupe les abandons d\'affilée', () => {
    const h = sample();
    const [pre] = story(h);
    expect(lineText(h, pre)).toBe('UTG relance à 1 500, UTG+1, UTG+2, MP, HJ et CO passent, BTN (héros) suit 1 500, SB passe, BB suit 1 500');
  });

  it('texte WhatsApp : s\'arrête à la décision, ou raconte tout', () => {
    const h = sample();
    const q = handText(h, { all: false, link: 'https://x/#/voir/abc' });
    expect(q).toContain('Et toi, tu fais quoi ?');
    expect(q).toContain('*Flop* K♠ 7♥ 2♦ (pot 5 400) : BB parole');
    expect(q).toContain('*Turn* 9♣ (pot 10 400) : UTG tapis 16 500');
    expect(q).not.toContain('remporte');
    expect(q).toContain('La suite et le rejoueur : https://x/#/voir/abc');
    const all = handText(h, { all: true });
    expect(all).toContain('BTN (héros) remporte 43 400.');
    expect(all).not.toContain('Et toi');
  });

  it('lien : aller-retour sans perte, données douteuses écartées', async () => {
    const h = sample();
    const code = await encodeHand(h);
    expect(await decodeHand(code)).toEqual(h);
    expect(await decodeHand('zpas-du-tout')).toBeNull();
    expect(sanitize({ seats: [{ stack: 1 }] })).toBeNull();
    const bad = sanitize({ ...h, actions: [...h.actions.slice(0, 3), { p: 8, k: 'check' }], decisions: [12], board: [1, 1, 2] });
    expect(bad!.actions).toHaveLength(3);
    expect(bad!.decisions).toEqual([]);
    expect(bad!.board).toEqual([1, 2]);
  });
});

describe('plusieurs questions', () => {
  // Flop : le héros suit 2 500 (action 11) ; turn : il suit le tapis (action 14).
  const two = (): HandData => ({ ...sample(), decisions: [11, 14] });

  it('posées dans l\'ordre, chacune avec ses réponses et ce qu\'a fait le joueur', () => {
    const qs = questionsOf(two());
    expect(qs.map(q => [q.step, q.index, q.state.street])).toEqual([[0, 11, 1], [1, 14, 2]]);
    expect(qs.map(q => q.options[q.did].k)).toEqual(['call', 'call']);
  });

  it('liens d\'avant (une seule « decision ») et données douteuses', () => {
    const { decisions: _, ...old } = sample();
    expect(sanitize({ ...old, decision: 14 })!.decisions).toEqual([14]);
    expect(upgrade({ ...old, decision: 14 })).not.toHaveProperty('decision');
    expect(upgrade({ ...old, decision: 14 }).decisions).toEqual([14]);
    expect(upgrade({ ...old }).decisions).toEqual([]);
    // Pas le héros (12), en double, hors main : écartés ; l'ordre de la main est rétabli.
    expect(sanitize({ ...old, decisions: [14, 12, 11, 11, 99] })!.decisions).toEqual([11, 14]);
  });

  it(`${MAX_QUESTIONS} au plus`, () => {
    let l: number[] = [];
    for (const i of [9, 3, 7, 1, 5]) l = toggleDecision(l, i);
    expect(l).toEqual([1, 3, 7, 9]);
    expect(toggleDecision(l, 3)).toEqual([1, 7, 9]);
  });

  it('le texte WhatsApp pose la première, le lien les autres', () => {
    const t = handText(two(), { all: false, link: 'https://x/#/voir/abc' });
    expect(t).toContain('UTG mise 2 500');
    expect(t).not.toContain('Turn');
    expect(t).toContain('Il faut payer 2 500');
    expect(t).toContain('La suite, une autre question et le rejoueur : https://x/#/voir/abc');
  });

  it('mains du club : avant et après le script 007', () => {
    const h = sample();
    const opts = [{ k: 'fold' }, { k: 'call', to: 16500 }];
    const [old] = readPosts([{ id: 'a', hand: h, options: opts, my_vote: 1, my_reasons: [2], results: { total: 3, counts: [1, 2], reasons: [] }, votes: 3 }]);
    expect(old.steps).toEqual([opts]);
    expect(old.my_votes).toEqual([{ choice: 1, reasons: [2] }]);
    expect(old.results[0]!.counts).toEqual([1, 2]);
    const [now] = readPosts([{ id: 'b', hand: two(), options: [[{ k: 'fold' }, { k: 'call' }], opts], my_votes: [{ choice: 0, reasons: [] }, null], results: [{ total: 1, counts: [1, 0], reasons: [] }, null], votes: 1 }]);
    expect(now.steps).toHaveLength(2);
    expect(now.my_votes).toEqual([{ choice: 0, reasons: [] }, null]);
    expect(now.results[1]).toBeNull();
    // Questions et réponses qui ne correspondent pas : la main est écartée.
    expect(readPosts([{ id: 'c', hand: two(), options: [opts] }])).toEqual([]);
  });
});

describe('blindes', () => {
  it('niveau suivant et précédent, ante comprise', () => {
    expect(nextLevel(B)).toEqual({ sb: 400, bb: 800, ante: 800, anteMode: 'bb' });
    expect(prevLevel(B)).toEqual({ sb: 250, bb: 500, ante: 500, anteMode: 'bb' });
    expect(nextLevel({ sb: 100, bb: 200, ante: 25, anteMode: 'each' }).ante).toBe(38);
  });
  it('horloge du club : niveau en cours, pause comprise', () => {
    const levels = [
      { kind: 'level' as const, sb: 25, bb: 50, ante: 0, minutes: 20 },
      { kind: 'level' as const, sb: 50, bb: 100, ante: 100, minutes: 20 },
      { kind: 'break' as const, sb: 0, bb: 0, ante: 0, minutes: 10 },
      { kind: 'level' as const, sb: 100, bb: 200, ante: 200, minutes: 20 },
    ];
    const t = { id: 't', name: 'T', status: 'running', levels, seats_per_table: 9, starting_stack: 20000, clock_level: 0, clock_elapsed_ms: 0, clock_anchor: new Date(0).toISOString() };
    expect(clubLevel(t, 25 * 60_000)).toEqual({ level: 2, blinds: { sb: 50, bb: 100, ante: 100, anteMode: 'bb' } });
    expect(clubLevel(t, 45 * 60_000)!.level).toBe(3);
    expect(clubLevel({ ...t, clock_anchor: null, clock_elapsed_ms: 5 * 60_000 })!.level).toBe(1);
  });
});
