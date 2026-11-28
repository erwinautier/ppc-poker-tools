/**
 * Théorie calculée pour le parcours Exploration : noms des places, combos et bloqueurs,
 * équité range contre range, maths du sizing, ICM. Aucune valeur n'est écrite à la main.
 */
import { type Card, RANK_CHARS, SUIT_CHARS, catOf, deckWithout, evalCards, rankOf, toInt } from './cards';
import { evaluate } from './evaluator';

// ── Places ─────────────────────────────────────────────────────────────────
// UTG parle toujours en premier ; CO, HJ et LJ sont les places juste avant le bouton ;
// UTG+1 et UTG+2 s'intercalent quand la table s'agrandit.

const BEFORE_BUTTON: Record<number, string[]> = {
  6: ['UTG', 'HJ', 'CO'],
  7: ['UTG', 'LJ', 'HJ', 'CO'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
};

/** Places dans l'ordre de parole préflop (UTG … BB), pour 6 à 9 joueurs. */
export function seatOrder(n: number): string[] {
  return [...(BEFORE_BUTTON[n] ?? BEFORE_BUTTON[8]), 'BTN', 'SB', 'BB'];
}
/** Places à partir du bouton, dans le sens des aiguilles d'une montre (BTN, SB, BB, UTG…). */
export function seatsFromButton(n: number): string[] {
  const o = seatOrder(n);
  return [...o.slice(-3), ...o.slice(0, -3)];
}
/** Nom de la place du siège `seat` quand le bouton est au siège `button` (table de n joueurs). */
export function seatName(seat: number, button: number, n: number): string {
  return seatsFromButton(n)[(seat - button + n) % n];
}
export function seatOfName(name: string, button: number, n: number): number {
  return (button + seatsFromButton(n).indexOf(name)) % n;
}
export const SEAT_GROUP: Record<string, 'EP' | 'MP' | 'LP' | 'Blinds'> = {
  UTG: 'EP', 'UTG+1': 'EP', 'UTG+2': 'EP', LJ: 'MP', HJ: 'MP', CO: 'LP', BTN: 'LP', SB: 'Blinds', BB: 'Blinds',
};
/** Ordre de parole après le flop : SB, BB, UTG… BTN. Plus l'index est grand, plus on parle tard. */
export function postflopOrder(n: number): string[] {
  const o = seatOrder(n);
  return [...o.slice(-2), ...o.slice(0, -2)];
}

/** Articles devant un nom de place : « la BB », « l’UTG », « le CO ». */
const fem = (s: string) => s === 'SB' || s === 'BB';
const vowel = (s: string) => s.startsWith('UTG');
export const le = (s: string) => (fem(s) ? `la ${s}` : vowel(s) ? `l’${s}` : `le ${s}`);
export const Le = (s: string) => { const x = le(s); return x[0].toUpperCase() + x.slice(1); };
export const au = (s: string) => (fem(s) ? `à la ${s}` : vowel(s) ? `à l’${s}` : `au ${s}`);
/** Préfixe seul (« de la », « de l’ », « du ») pour mettre la place en gras à part. */
export const duP = (s: string) => (fem(s) ? 'de la ' : vowel(s) ? 'de l’' : 'du ');

// ── Combos et bloqueurs ────────────────────────────────────────────────────

/** Tous les combos d'une main ("AKs", "QQ", "T9o", ou "AK" pour assorties + dépareillées), cartes mortes exclues. */
export function combosOf(code: string, dead: Card[] = []): [Card, Card][] {
  const d = new Set(dead);
  const r1 = code[0], r2 = code[1];
  const kind = code[2]; // 's', 'o' ou undefined
  const out: [Card, Card][] = [];
  const suits = [...SUIT_CHARS];
  if (r1 === r2) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([r1 + suits[a], r2 + suits[b]]);
  } else {
    for (const s1 of suits) for (const s2 of suits) {
      if (kind === 's' && s1 !== s2) continue;
      if (kind === 'o' && s1 === s2) continue;
      out.push([r1 + s1, r2 + s2]);
    }
  }
  return out.filter(([a, b]) => !d.has(a) && !d.has(b));
}

/** Combos d'une range (ensemble de codes "AKs", "QQ"…), cartes mortes exclues. */
export function rangeCombos(range: Iterable<string>, dead: Card[] = []): [Card, Card][] {
  const out: [Card, Card][] = [];
  for (const code of range) out.push(...combosOf(code, dead));
  return out;
}

/** Nombre de combos d'une range qui atteignent au moins la catégorie `minCat` sur le board. */
export function strongCombos(range: Iterable<string>, board: Card[], minCat: number): number {
  return rangeCombos(range, board).filter(c => catOf(evalCards([...c, ...board])) >= minCat).length;
}

/** Combos par catégorie (brelan/set, deux paires, suite, couleur, full ou mieux). */
export function strongDetail(range: Iterable<string>, board: Card[]) {
  const res = { twoPair: 0, sets: 0, straights: 0, better: 0 };
  const all = rangeCombos(range, board);
  for (const c of all) {
    const cat = catOf(evalCards([...c, ...board]));
    if (cat === 2) res.twoPair++;
    else if (cat === 3) res.sets++;
    else if (cat === 4) res.straights++;
    else if (cat >= 5) res.better++;
  }
  const total = res.twoPair + res.sets + res.straights + res.better;
  /** share : part de la range (en combos) faite de mains très fortes */
  return { ...res, total, combos: all.length, share: all.length ? total / all.length : 0 };
}

// ── Équité range contre range (Monte Carlo, par paquets) ──────────────────

export interface RvR { a: number; b: number; tie: number; n: number }

export function rangeVsRange(rangeA: Iterable<string>, rangeB: Iterable<string>, board: Card[], n: number, acc?: RvR): RvR {
  const res: RvR = acc ? { ...acc } : { a: 0, b: 0, tie: 0, n: 0 };
  const A = rangeCombos(rangeA, board), B = rangeCombos(rangeB, board);
  if (!A.length || !B.length) return res;
  const Bd = board.map(toInt);
  const need = 5 - board.length;
  for (let i = 0; i < n; i++) {
    const ca = A[Math.floor(Math.random() * A.length)];
    let cb: [Card, Card] | null = null;
    for (let t = 0; t < 30; t++) {
      const x = B[Math.floor(Math.random() * B.length)];
      if (x[0] !== ca[0] && x[0] !== ca[1] && x[1] !== ca[0] && x[1] !== ca[1]) { cb = x; break; }
    }
    if (!cb) continue;
    const rest = deckWithout([...board, ...ca, ...cb]);
    const extra: number[] = [];
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(Math.random() * (rest.length - k));
      [rest[k], rest[j]] = [rest[j], rest[k]];
      extra.push(toInt(rest[k]));
    }
    const full = Bd.concat(extra);
    const va = evaluate(ca.map(toInt).concat(full)), vb = evaluate(cb.map(toInt).concat(full));
    if (va > vb) res.a++; else if (vb > va) res.b++; else res.tie++;
    res.n++;
  }
  return res;
}
export function shareA(e: RvR): number { return e.n ? (e.a + e.tie / 2) / e.n : 0; }

// ── Sizing : les maths ─────────────────────────────────────────────────────

/** Équité dont l'adversaire a besoin pour suivre une mise B dans un pot P. */
export const priceNeeded = (bet: number, pot: number) => bet / (pot + 2 * bet);
/** Fréquence de réussite nécessaire pour qu'un bluff B dans un pot P soit rentable (alpha). */
export const alpha = (bet: number, pot: number) => bet / (pot + bet);
/** Fréquence minimale de défense face à une mise B dans un pot P (MDF). */
export const mdf = (bet: number, pot: number) => pot / (pot + bet);
/** Part de bluffs dans une range de mise polarisée à la river (indifférence de l'adversaire). */
export const bluffShare = (bet: number, pot: number) => bet / (pot + 2 * bet);
/** Fraction du pot à miser à chaque tour pour être à tapis après `streets` mises égales. */
export const geometricFraction = (pot: number, stack: number, streets: number) => (Math.pow((pot + 2 * stack) / pot, 1 / streets) - 1) / 2;
/** Pot après une mise et un call d'une fraction f du pot. */
export const potAfterBet = (pot: number, f: number) => pot * (1 + 2 * f);

// ── ICM (Malmuth-Harville) ─────────────────────────────────────────────────

/** Espérance de gains de chaque joueur selon ses jetons et la structure de paiement. */
export function icm(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const ev = new Array(n).fill(0);
  const rec = (remaining: number[], place: number, prob: number) => {
    if (place >= payouts.length || remaining.length === 0) return;
    const total = remaining.reduce((a, i) => a + stacks[i], 0);
    for (const i of remaining) {
      const p = prob * (stacks[i] / total);
      ev[i] += p * payouts[place];
      rec(remaining.filter(j => j !== i), place + 1, p);
    }
  };
  rec([...Array(n).keys()].filter(i => stacks[i] > 0), 0, 1);
  return ev;
}

// ── Mains, tirages, boards (pour les exercices de vocabulaire) ─────────────

const RANK_OF = (c: Card) => rankOf(c);

/**
 * Nom de la main faite par rapport à un flop NON pairé (les boards pairés sont exclus des exercices).
 */
export function madeHand(hole: Card[], board: Card[]): string {
  const cat = catOf(evalCards([...hole, ...board]));
  const br = board.map(RANK_OF).sort((a, b) => b - a);
  const [h1, h2] = hole.map(RANK_OF).sort((a, b) => b - a);
  const pocketPair = h1 === h2;
  if (cat >= 5) return cat === 5 ? 'Flush' : 'Full house or better';
  if (cat === 4) return 'Straight';
  if (cat === 3) return 'Set';
  if (cat === 2) return 'Two pair';
  if (cat === 1) {
    if (pocketPair) return h1 > br[0] ? 'Overpair' : h1 < br[br.length - 1] ? 'Underpair' : 'Pocket pair (middle)';
    const pairRank = br.includes(h1) ? h1 : h2;
    const kicker = pairRank === h1 ? h2 : h1;
    if (pairRank === br[0]) {
      const best = [...Array(13).keys()].reverse().find(r => r !== pairRank && !br.includes(r));
      return kicker === best ? 'TPTK' : 'Top pair';
    }
    return pairRank === br[1] ? 'Second pair' : 'Bottom pair';
  }
  return 'High card';
}

/** Tirages du joueur au flop (couleur, suite), calculés sur les cartes restantes. */
export function draws(hole: Card[], board: Card[]): { flush: boolean; nutFlush: boolean; straightOuts: number; backdoorFlush: boolean } {
  const all = [...hole, ...board];
  const madeCat = catOf(evalCards(all));
  let flush = false, nutFlush = false, backdoorFlush = false;
  for (const s of SUIT_CHARS) {
    const n = all.filter(c => c[1] === s).length;
    const mine = hole.filter(c => c[1] === s);
    if (n === 4 && mine.length > 0 && madeCat < 5) {
      flush = true;
      // nut flush draw : on détient la plus haute carte de cette couleur absente du board
      const top = [...RANK_CHARS].reverse().find(r => !board.includes(r + s));
      nutFlush = mine.some(c => c[0] === top);
    }
    if (n === 3 && mine.length > 0 && board.length === 3) backdoorFlush = true;
  }
  let straightOuts = 0;
  if (madeCat < 4) {
    for (const c of deckWithout(all)) if (catOf(evalCards([...all, c])) === 4) straightOuts++;
  }
  return { flush, nutFlush, straightOuts, backdoorFlush };
}

/** Texture du flop. */
export function boardTexture(board: Card[]) {
  const suits = new Set(board.map(c => c[1])).size;
  const ranks = board.map(RANK_OF);
  const paired = new Set(ranks).size < ranks.length;
  return { suits: suits === 1 ? 'monotone' : suits === 2 ? 'two-tone' : 'rainbow', paired } as const;
}
