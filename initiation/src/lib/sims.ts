/** Simulations et calculs exacts utilisés par les leçons. */
import { type Card, toInt, deckWithout, evalCards, catOf, primaryRank, categoryOf, shuffle, fullDeck } from './cards';
import { evaluate } from './evaluator';

// ── Équité main contre main (Monte Carlo, par paquets pour l'animation) ────

export interface Equity { a: number; b: number; tie: number; n: number }

export function equityRun(a: Card[], b: Card[], board: Card[], n: number, acc?: Equity): Equity {
  const res: Equity = acc ? { ...acc } : { a: 0, b: 0, tie: 0, n: 0 };
  const deck = deckWithout([...a, ...b, ...board]).map(toInt);
  const A = a.map(toInt), B = b.map(toInt), Bd = board.map(toInt);
  const need = 5 - board.length;
  for (let i = 0; i < n; i++) {
    // tirage partiel de Fisher-Yates
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(Math.random() * (deck.length - k));
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
    }
    const full = Bd.concat(deck.slice(0, need));
    const va = evaluate(A.concat(full)), vb = evaluate(B.concat(full));
    if (va > vb) res.a++; else if (vb > va) res.b++; else res.tie++;
    res.n++;
  }
  return res;
}

/** Part de pot moyenne (les égalités comptent pour moitié). */
export function share(e: Equity, who: 'a' | 'b'): number {
  if (!e.n) return 0;
  return ((who === 'a' ? e.a : e.b) + e.tie / 2) / e.n;
}

// ── Nuts : la meilleure main possible sur un board ────────────────────────

export interface Nuts { value: number; combos: [Card, Card][] }

export function nutsOf(board: Card[]): Nuts {
  const rest = deckWithout(board);
  let best = -1; let combos: [Card, Card][] = [];
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) {
    const v = evalCards([...board, rest[i], rest[j]]);
    if (v > best) { best = v; combos = [[rest[i], rest[j]]]; }
    else if (v === best) combos.push([rest[i], rest[j]]);
  }
  return { value: best, combos };
}

/** Deux mains « équivalentes » : même catégorie et même rang principal. */
export function sameStrength(v1: number, v2: number): boolean {
  return categoryOf(v1) === categoryOf(v2) && primaryRank(v1) === primaryRank(v2);
}

// ── Outs : cartes qui font atteindre une catégorie visée ───────────────────

export function outsFor(hole: Card[], board: Card[], minCat: number): Card[] {
  return deckWithout([...hole, ...board]).filter(c => catOf(evalCards([...hole, ...board, c])) >= minCat);
}

/** Probabilité exacte de toucher au moins un out en `cardsToCome` cartes. */
export function hitProbability(outs: number, unseen: number, cardsToCome: 1 | 2): number {
  if (cardsToCome === 1) return outs / unseen;
  const miss = ((unseen - outs) / unseen) * ((unseen - outs - 1) / (unseen - 1));
  return 1 - miss;
}

// ── Fréquences des combinaisons sur des mains de 5 cartes ─────────────────

export function dealFiveCounts(n: number, counts: number[] = Array(10).fill(0)): number[] {
  const deck = fullDeck().map(toInt);
  const out = counts.slice();
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 5; k++) {
      const j = k + Math.floor(Math.random() * (deck.length - k));
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
    }
    const v = evaluate(deck.slice(0, 5));
    let c = v >> 20;
    if (c === 8 && (v & 0xf) === 12) c = 9;
    out[c]++;
  }
  return out;
}

/** Nombre exact de mains de 5 cartes par catégorie (sur 2 598 960). */
export const FIVE_CARD_COUNTS = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 36, 4];
export const FIVE_CARD_TOTAL = 2598960;

/** Simulation générique : fraction des essais où `trial()` est vrai. */
export function frequency(trial: () => boolean, n: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (trial()) k++;
  return k / n;
}

export function randomCards(n: number, exclude: Card[] = []): Card[] {
  return shuffle(deckWithout(exclude)).slice(0, n);
}
