/** Card encoding: integer 0..51 = rankIdx * 4 + suitIdx, rankIdx 0 = '2' … 12 = 'A'. */

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'shdc';
export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR: Record<string, string> = { s: '#c8d6f0', h: '#f87171', d: '#60a5fa', c: '#4ade80' };

/** Ranks from high to low, as used by the 13×13 grid. */
export const RANKS_DESC = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export function cardToInt(card: string): number {
  const r = RANK_CHARS.indexOf(card[0].toUpperCase());
  const s = SUIT_CHARS.indexOf(card[1].toLowerCase());
  if (r < 0 || s < 0) throw new Error(`Carte invalide : ${card}`);
  return r * 4 + s;
}

export function intToCard(n: number): string {
  return RANK_CHARS[n >> 2] + SUIT_CHARS[n & 3];
}

export function cardRank(n: number): number { return n >> 2; }
export function cardSuit(n: number): number { return n & 3; }

export function fullDeck(): number[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

/** All combos (pairs of card ints) for a hand label like "AKs", "AKo", "QQ". */
export function handCombos(hand: string): [number, number][] {
  const r1 = RANK_CHARS.indexOf(hand[0]);
  const r2 = RANK_CHARS.indexOf(hand[1]);
  const out: [number, number][] = [];
  if (hand.length === 2) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([r1 * 4 + a, r1 * 4 + b]);
  } else if (hand[2] === 's') {
    for (let s = 0; s < 4; s++) out.push([r1 * 4 + s, r2 * 4 + s]);
  } else {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([r1 * 4 + a, r2 * 4 + b]);
  }
  return out;
}

/** Hand label for two card ints, e.g. [As, Kd] → "AKo". */
export function combosToHand(a: number, b: number): string {
  let ra = cardRank(a), rb = cardRank(b);
  if (ra < rb) { [ra, rb] = [rb, ra]; [a, b] = [b, a]; }
  if (ra === rb) return RANK_CHARS[ra] + RANK_CHARS[rb];
  return RANK_CHARS[ra] + RANK_CHARS[rb] + (cardSuit(a) === cardSuit(b) ? 's' : 'o');
}
