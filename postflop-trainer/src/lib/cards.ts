import type { Card, Rank, Suit } from '../types';

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR: Record<Suit, string> = { s: '#c8d6f0', h: '#f87171', d: '#f87171', c: '#c8d6f0' };

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}` as Card);
  return deck;
}

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal N cards from the deck excluding dead cards */
export function dealCards(n: number, deadCards: Card[]): Card[] {
  const dead = new Set(deadCards);
  const available = fullDeck().filter(c => !dead.has(c));
  return shuffled(available).slice(0, n);
}

/**
 * Convert a hand-type string (e.g. "AKs", "AKo", "AA") to two specific cards.
 * Avoids picking cards that are already dead.
 */
export function handTypeToCards(handType: string, deadCards: Card[] = []): [Card, Card] | null {
  const dead = new Set(deadCards);

  if (handType.length === 2) {
    // Pair: e.g. "AA"
    const rank = handType[0] as Rank;
    const suitPairs: [Suit, Suit][] = [];
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const c1 = `${rank}${SUITS[i]}` as Card;
        const c2 = `${rank}${SUITS[j]}` as Card;
        if (!dead.has(c1) && !dead.has(c2)) suitPairs.push([SUITS[i], SUITS[j]]);
      }
    }
    if (suitPairs.length === 0) return null;
    const [s1, s2] = suitPairs[Math.floor(Math.random() * suitPairs.length)];
    return [`${rank}${s1}` as Card, `${rank}${s2}` as Card];
  }

  const rank1 = handType[0] as Rank;
  const rank2 = handType[1] as Rank;
  const suited = handType[2] === 's';

  if (suited) {
    const options: [Card, Card][] = [];
    for (const s of SUITS) {
      const c1 = `${rank1}${s}` as Card;
      const c2 = `${rank2}${s}` as Card;
      if (!dead.has(c1) && !dead.has(c2)) options.push([c1, c2]);
    }
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)];
  } else {
    const options: [Card, Card][] = [];
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        const c1 = `${rank1}${s1}` as Card;
        const c2 = `${rank2}${s2}` as Card;
        if (!dead.has(c1) && !dead.has(c2)) options.push([c1, c2]);
      }
    }
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)];
  }
}

export function cardRank(c: Card): Rank { return c[0] as Rank; }
export function cardSuit(c: Card): Suit { return c[1] as Suit; }

export function cardLabel(c: Card): { rank: string; suit: string; color: string } {
  const suit = cardSuit(c);
  return { rank: cardRank(c), suit: SUIT_SYMBOL[suit], color: SUIT_COLOR[suit] };
}
