/**
 * Fast 5–7 card hand evaluator. Returns an integer: higher = better hand.
 * Encoding: category << 20 | up to five 4-bit kickers (high to low).
 * Categories: 8 straight flush, 7 quads, 6 full house, 5 flush, 4 straight,
 *             3 trips, 2 two pair, 1 pair, 0 high card.
 */

const CAT_SHIFT = 20;

/** Highest rank of a straight contained in the rank bitmask (bit 0 = '2' … bit 12 = 'A'), or -1. */
function straightTop(mask: number): number {
  // Ace plays low: add a virtual bit below '2'.
  const m = (mask << 1) | ((mask >> 12) & 1);
  for (let top = 13; top >= 4; top--) {
    // bits top, top-1, …, top-4 in m correspond to ranks top-1 … top-5 in the original numbering
    if (((m >> (top - 4)) & 0x1f) === 0x1f) return top - 1;
  }
  return -1;
}

function packTop(mask: number, count: number): number {
  let v = 0, n = 0;
  for (let r = 12; r >= 0 && n < count; r--) {
    if (mask & (1 << r)) { v = (v << 4) | r; n++; }
  }
  return v;
}

export function evaluate(cards: number[]): number {
  const suitMask = [0, 0, 0, 0];
  const rankCount = new Int8Array(13);
  let rankMask = 0;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const r = c >> 2, s = c & 3;
    suitMask[s] |= 1 << r;
    rankCount[r]++;
    rankMask |= 1 << r;
  }

  // Flush / straight flush
  for (let s = 0; s < 4; s++) {
    const m = suitMask[s];
    // popcount
    let n = m; n = n - ((n >> 1) & 0x5555); n = (n & 0x3333) + ((n >> 2) & 0x3333); n = (n + (n >> 4)) & 0x0f0f; n = (n + (n >> 8)) & 0xff;
    if (n >= 5) {
      const sf = straightTop(m);
      if (sf >= 0) return (8 << CAT_SHIFT) | sf;
      return (5 << CAT_SHIFT) | packTop(m, 5);
    }
  }

  // Count groups
  let quad = -1, trips = -1, trips2 = -1, pairHi = -1, pairLo = -1;
  for (let r = 12; r >= 0; r--) {
    const c = rankCount[r];
    if (c === 4) quad = r;
    else if (c === 3) { if (trips < 0) trips = r; else if (trips2 < 0) trips2 = r; }
    else if (c === 2) { if (pairHi < 0) pairHi = r; else if (pairLo < 0) pairLo = r; }
  }

  if (quad >= 0) {
    const kick = packTop(rankMask & ~(1 << quad), 1);
    return (7 << CAT_SHIFT) | (quad << 4) | kick;
  }
  if (trips >= 0 && (pairHi >= 0 || trips2 >= 0)) {
    const pair = Math.max(pairHi, trips2);
    return (6 << CAT_SHIFT) | (trips << 4) | pair;
  }
  const st = straightTop(rankMask);
  if (st >= 0) return (4 << CAT_SHIFT) | st;

  if (trips >= 0) {
    const kick = packTop(rankMask & ~(1 << trips), 2);
    return (3 << CAT_SHIFT) | (trips << 8) | kick;
  }
  if (pairHi >= 0 && pairLo >= 0) {
    const kick = packTop(rankMask & ~(1 << pairHi) & ~(1 << pairLo), 1);
    return (2 << CAT_SHIFT) | (pairHi << 8) | (pairLo << 4) | kick;
  }
  if (pairHi >= 0) {
    const kick = packTop(rankMask & ~(1 << pairHi), 3);
    return (1 << CAT_SHIFT) | (pairHi << 12) | kick;
  }
  return packTop(rankMask, 5);
}

export const CATEGORY_LABEL = [
  'Hauteur', 'Paire', 'Deux paires', 'Brelan', 'Suite',
  'Couleur', 'Full', 'Carré', 'Quinte flush',
];

export function categoryOf(value: number): number { return value >> CAT_SHIFT; }
