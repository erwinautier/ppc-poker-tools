export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = typeof RANKS[number];

// Returns the canonical hand name for matrix cell (row, col)
// row = rank index of higher card, col = rank index of lower card
// row < col → suited, row > col → offsuit, row === col → pair
export function cellToHand(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[col];
  if (row < col) return RANKS[row] + RANKS[col] + 's'; // suited: top-right
  return RANKS[col] + RANKS[row] + 'o'; // offsuit: bottom-left
}

export function getAllHands(): string[] {
  const hands: string[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      hands.push(cellToHand(r, c));
    }
  }
  return [...new Set(hands)];
}

// Number of combos for a hand
export function combosCount(hand: string): number {
  if (hand.endsWith('s')) return 4;   // suited
  if (hand.endsWith('o')) return 12;  // offsuit
  return 6;                            // pair
}
