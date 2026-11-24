/**
 * Cartes : on écrit les cartes sous forme de chaînes ("As", "Th", "7c") dans le contenu
 * des leçons, et on les convertit en entiers (rang * 4 + couleur) pour l'évaluateur.
 */
import { evaluate } from './evaluator';

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'shdc';
export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_NAME: Record<string, string> = { s: 'pique', h: 'cœur', d: 'carreau', c: 'trèfle' };

export type Card = string;

export function toInt(c: Card): number {
  const r = RANK_CHARS.indexOf(c[0].toUpperCase());
  const s = SUIT_CHARS.indexOf(c[1].toLowerCase());
  if (r < 0 || s < 0) throw new Error(`Carte invalide : ${c}`);
  return r * 4 + s;
}
export function toStr(n: number): Card { return RANK_CHARS[n >> 2] + SUIT_CHARS[n & 3]; }
export function rankOf(c: Card): number { return RANK_CHARS.indexOf(c[0]); }
export function suitOf(c: Card): string { return c[1]; }

/** "As Kd 7h" → ["As", "Kd", "7h"] */
export function cards(s: string): Card[] { return s.trim().split(/\s+/).filter(Boolean); }

/** Affichage du rang : T → 10. */
export function rankLabel(c: Card | string): string { return c[0] === 'T' ? '10' : c[0]; }
export function cardLabel(c: Card): string { return rankLabel(c) + SUIT_SYMBOL[c[1]]; }

export function fullDeck(): Card[] {
  const out: Card[] = [];
  for (let r = 12; r >= 0; r--) for (const s of SUIT_CHARS) out.push(RANK_CHARS[r] + s);
  return out;
}
export function deckWithout(used: Card[]): Card[] {
  const u = new Set(used);
  return fullDeck().filter(c => !u.has(c));
}

export function shuffle<T>(a: T[]): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
export function randInt(min: number, max: number): number { return min + Math.floor(Math.random() * (max - min + 1)); }

/** Tire n cartes au hasard en excluant `used`. */
export function draw(n: number, used: Card[] = []): Card[] {
  return shuffle(deckWithout(used)).slice(0, n);
}

// ── Évaluation ─────────────────────────────────────────────────────────────

export function evalCards(cs: Card[]): number { return evaluate(cs.map(toInt)); }
export function categoryOf(v: number): number { return v >> 20; }

/** 0 hauteur … 8 quinte flush, 9 quinte flush royale (catégorie « pédagogique »). */
export function catOf(v: number): number {
  const c = categoryOf(v);
  if (c === 8 && (v & 0xf) === 12) return 9;
  return c;
}

export const CAT_NAMES = [
  'Hauteur', 'Paire', 'Deux paires', 'Brelan', 'Suite',
  'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale',
];

/** Rang principal d'une combinaison (pour comparer « à peu de chose près » deux mains). */
export function primaryRank(v: number): number {
  switch (categoryOf(v)) {
    case 8: case 4: return v & 0xf;
    case 7: case 6: return (v >> 4) & 0xf;
    case 5: case 0: return (v >> 16) & 0xf;
    case 3: case 2: return (v >> 8) & 0xf;
    case 1: return (v >> 12) & 0xf;
  }
  return 0;
}

/** Meilleure main de 5 cartes parmi 5 à 7. */
export function bestFive(cs: Card[]): { value: number; five: Card[] } {
  if (cs.length <= 5) return { value: evalCards(cs), five: cs.slice() };
  let best = -1, five: Card[] = [];
  const chosen: Card[] = [];
  const rec = (start: number) => {
    if (chosen.length === 5) {
      const v = evalCards(chosen);
      if (v > best) { best = v; five = chosen.slice(); }
      return;
    }
    for (let i = start; i <= cs.length - (5 - chosen.length); i++) {
      chosen.push(cs[i]); rec(i + 1); chosen.pop();
    }
  };
  rec(0);
  return { value: best, five };
}

// ── Noms français ──────────────────────────────────────────────────────────

const NAME = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];
const PLURAL = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'valets', 'dames', 'rois', 'as'];
/** « de rois », « d'as » */
function de(r: number): string { return r === 12 ? "d'as" : `de ${PLURAL[r]}`; }
/** « aux rois », « aux as » */
function aux(r: number): string { return `aux ${PLURAL[r]}`; }
function hauteur(r: number): string { return `hauteur ${r === 12 ? 'as' : NAME[r]}`; }

export function rankName(r: number): string { return NAME[r]; }
export function rankPlural(r: number): string { return PLURAL[r]; }

/** Description lisible : « Paire de rois, kicker as », « Full aux dames par les 7 »… */
export function describe(v: number, withKicker = false): string {
  const c = categoryOf(v);
  const n = (shift: number) => (v >> shift) & 0xf;
  switch (c) {
    case 8: return (v & 0xf) === 12 ? 'Quinte flush royale' : `Quinte flush ${hauteur(v & 0xf)}`;
    case 7: return `Carré ${de(n(4))}` + (withKicker ? `, kicker ${NAME[n(0)]}` : '');
    case 6: return `Full ${aux(n(4))} par les ${PLURAL[n(0)]}`;
    case 5: return `Couleur ${hauteur(n(16))}`;
    case 4: return `Suite ${hauteur(v & 0xf)}`;
    case 3: return `Brelan ${de(n(8))}` + (withKicker ? `, kickers ${NAME[n(4)]} et ${NAME[n(0)]}` : '');
    case 2: return `Deux paires, ${PLURAL[n(8)]} et ${PLURAL[n(4)]}` + (withKicker ? `, kicker ${NAME[n(0)]}` : '');
    case 1: return `Paire ${de(n(12))}` + (withKicker ? `, kickers ${NAME[n(8)]}, ${NAME[n(4)]}, ${NAME[n(0)]}` : '');
    default: return `${hauteur(n(16)).replace('hauteur', 'Hauteur')}` + (withKicker ? `, puis ${NAME[n(12)]}, ${NAME[n(8)]}, ${NAME[n(4)]}, ${NAME[n(0)]}` : '');
  }
}

// ── Générateurs de mains d'une catégorie donnée (5 cartes) ─────────────────

function suitsNotAllSame(n: number): string[] {
  for (;;) {
    const s = Array.from({ length: n }, () => pick([...SUIT_CHARS]));
    if (new Set(s).size > 1) return s;
  }
}
function distinctRanks(n: number, exclude: number[] = []): number[] {
  const pool = shuffle([...Array(13).keys()].filter(r => !exclude.includes(r)));
  return pool.slice(0, n);
}
function isStraightRanks(rs: number[]): boolean {
  const s = [...new Set(rs)].sort((a, b) => a - b);
  if (s.length !== 5) return false;
  if (s[4] - s[0] === 4) return true;
  return s.join() === '0,1,2,3,12';
}
function withSuits(ranks: number[], suitsFor: (i: number) => string): Card[] {
  const used = new Set<string>();
  const out: Card[] = [];
  ranks.forEach((r, i) => {
    let s = suitsFor(i);
    let c = RANK_CHARS[r] + s;
    let guard = 0;
    while (used.has(c) && guard++ < 10) { s = pick([...SUIT_CHARS]); c = RANK_CHARS[r] + s; }
    used.add(c); out.push(c);
  });
  return out;
}

/** Main de 5 cartes de la catégorie `cat` (0…9, 9 = royale). */
export function handOfCategory(cat: number): Card[] {
  for (let guard = 0; guard < 200; guard++) {
    let hand: Card[] = [];
    if (cat === 9 || cat === 8) {
      const s = pick([...SUIT_CHARS]);
      const top = cat === 9 ? 12 : randInt(3, 11);
      const ranks = top === 3 ? [3, 2, 1, 0, 12] : [top, top - 1, top - 2, top - 3, top - 4];
      hand = ranks.map(r => RANK_CHARS[r] + s);
    } else if (cat === 7) {
      const [q, k] = distinctRanks(2);
      hand = [...SUIT_CHARS].map(s => RANK_CHARS[q] + s).concat(RANK_CHARS[k] + pick([...SUIT_CHARS]));
    } else if (cat === 6) {
      const [t, p] = distinctRanks(2);
      const st = shuffle([...SUIT_CHARS]).slice(0, 3), sp = shuffle([...SUIT_CHARS]).slice(0, 2);
      hand = st.map(s => RANK_CHARS[t] + s).concat(sp.map(s => RANK_CHARS[p] + s));
    } else if (cat === 5) {
      const s = pick([...SUIT_CHARS]);
      const rs = distinctRanks(5);
      if (isStraightRanks(rs)) continue;
      hand = rs.map(r => RANK_CHARS[r] + s);
    } else if (cat === 4) {
      const top = randInt(3, 12);
      const ranks = top === 3 ? [3, 2, 1, 0, 12] : [top, top - 1, top - 2, top - 3, top - 4];
      const ss = suitsNotAllSame(5);
      hand = ranks.map((r, i) => RANK_CHARS[r] + ss[i]);
    } else if (cat === 3) {
      const [t, a, b] = distinctRanks(3);
      const st = shuffle([...SUIT_CHARS]).slice(0, 3);
      hand = st.map(s => RANK_CHARS[t] + s).concat([RANK_CHARS[a] + pick([...SUIT_CHARS]), RANK_CHARS[b] + pick([...SUIT_CHARS])]);
    } else if (cat === 2) {
      const [p1, p2, k] = distinctRanks(3);
      const s1 = shuffle([...SUIT_CHARS]).slice(0, 2), s2 = shuffle([...SUIT_CHARS]).slice(0, 2);
      hand = [RANK_CHARS[p1] + s1[0], RANK_CHARS[p1] + s1[1], RANK_CHARS[p2] + s2[0], RANK_CHARS[p2] + s2[1], RANK_CHARS[k] + pick([...SUIT_CHARS])];
    } else if (cat === 1) {
      const [p, a, b, c] = distinctRanks(4);
      const sp = shuffle([...SUIT_CHARS]).slice(0, 2);
      hand = [RANK_CHARS[p] + sp[0], RANK_CHARS[p] + sp[1], ...[a, b, c].map(r => RANK_CHARS[r] + pick([...SUIT_CHARS]))];
    } else {
      const rs = distinctRanks(5);
      if (isStraightRanks(rs)) continue;
      const ss = suitsNotAllSame(5);
      hand = withSuits(rs, i => ss[i]);
    }
    if (new Set(hand).size !== 5) continue;
    if (catOf(evalCards(hand)) === cat) return sortHand(hand);
  }
  throw new Error('Génération impossible');
}

/** Trie des cartes du plus fort au plus faible (pour l'affichage). */
export function sortHand(cs: Card[]): Card[] {
  return cs.slice().sort((a, b) => rankOf(b) - rankOf(a) || SUIT_CHARS.indexOf(a[1]) - SUIT_CHARS.indexOf(b[1]));
}

// ── Mains de départ ("AKs", "QQ", "T9o") ───────────────────────────────────

export const RANKS_DESC = 'AKQJT98765432';

/** Étiquette de main de départ pour deux cartes : ["Ah","Kh"] → "AKs". */
export function handCode(c1: Card, c2: Card): string {
  let a = c1, b = c2;
  if (rankOf(a) < rankOf(b)) [a, b] = [b, a];
  if (a[0] === b[0]) return a[0] + b[0];
  return a[0] + b[0] + (a[1] === b[1] ? 's' : 'o');
}

/** Cellule de grille 13×13 → étiquette (assorties au-dessus de la diagonale). */
export function cellToHand(row: number, col: number): string {
  const R = RANKS_DESC;
  if (row === col) return R[row] + R[col];
  if (row < col) return R[row] + R[col] + 's';
  return R[col] + R[row] + 'o';
}

/** Deux cartes concrètes pour une étiquette de main ("AKs" → ["Ah","Kh"]). */
export function cardsForCode(code: string, avoid: Card[] = []): [Card, Card] {
  for (let i = 0; i < 50; i++) {
    let c1: Card, c2: Card;
    if (code.length === 2) {
      const [s1, s2] = shuffle([...SUIT_CHARS]);
      c1 = code[0] + s1; c2 = code[1] + s2;
    } else if (code[2] === 's') {
      const s = pick([...SUIT_CHARS]); c1 = code[0] + s; c2 = code[1] + s;
    } else {
      const [s1, s2] = shuffle([...SUIT_CHARS]); c1 = code[0] + s1; c2 = code[1] + s2;
    }
    if (!avoid.includes(c1) && !avoid.includes(c2)) return [c1, c2];
  }
  throw new Error('Plus de cartes disponibles');
}

/** Nom lisible d'une main de départ : "AKs" → « As-Roi assortis ». */
export function codeLabel(code: string): string {
  const r = (ch: string) => rankLabel(ch);
  if (code.length === 2) return `${r(code[0])}${r(code[1])}`;
  return `${r(code[0])}${r(code[1])}${code[2]}`;
}
