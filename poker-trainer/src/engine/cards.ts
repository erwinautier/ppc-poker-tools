export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = 'h' | 'd' | 'c' | 's';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  h: true,
  d: true,
  c: false,
  s: false,
};

export function parseCard(str: string): Card {
  return {
    rank: str[0].toUpperCase() as Rank,
    suit: str[1].toLowerCase() as Suit,
  };
}

export function heroHandToKey(c1: string, c2: string): string {
  const r1 = c1[0] as Rank;
  const r2 = c2[0] as Rank;
  const s1 = c1[1];
  const s2 = c2[1];

  const i1 = RANKS.indexOf(r1);
  const i2 = RANKS.indexOf(r2);

  if (i1 === i2) return r1 + r1;

  const hi = Math.min(i1, i2);
  const lo = Math.max(i1, i2);
  const suited = s1 === s2;
  return RANKS[hi] + RANKS[lo] + (suited ? 's' : 'o');
}

export function getGridCell(handKey: string): { r: number; c: number } {
  const r1 = handKey[0] as Rank;
  const r2 = handKey[1] as Rank;
  const type = handKey[2];

  const i1 = RANKS.indexOf(r1);
  const i2 = RANKS.indexOf(r2);

  if (i1 === i2) return { r: i1, c: i1 };

  if (type === 's') {
    return { r: Math.min(i1, i2), c: Math.max(i1, i2) };
  } else {
    const higherIdx = Math.min(i1, i2);
    const lowerIdx = Math.max(i1, i2);
    return { r: lowerIdx, c: higherIdx };
  }
}

export function cellToHandKey(r: number, c: number): string {
  if (r === c) return RANKS[r] + RANKS[r];
  if (c > r) return RANKS[r] + RANKS[c] + 's';
  return RANKS[c] + RANKS[r] + 'o';
}
