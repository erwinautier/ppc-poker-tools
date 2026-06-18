import type { Range, Card } from '../types';
import { handTypeToCards } from './cards';

/**
 * Pick a random hand from a range, weighted by cumulative frequency.
 * Returns the hand type (e.g. "AKs") and the specific cards dealt.
 */
export function pickHandFromRange(range: Range, deadCards: Card[] = []): {
  handType: string;
  cards: [Card, Card];
} | null {
  // Build weighted list: each hand contributes (sum of its frequencies) weight
  const entries: { handType: string; weight: number }[] = [];
  for (const [handType, assignment] of Object.entries(range.hands)) {
    const weight = Object.values(assignment).reduce((s, v) => s + v, 0);
    if (weight > 0) entries.push({ handType, weight });
  }

  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      const cards = handTypeToCards(entry.handType, deadCards);
      if (!cards) continue; // dead cards conflict, try next
      return { handType: entry.handType, cards };
    }
  }

  // Fallback: try sequentially
  for (const entry of entries) {
    const cards = handTypeToCards(entry.handType, deadCards);
    if (cards) return { handType: entry.handType, cards };
  }

  return null;
}
