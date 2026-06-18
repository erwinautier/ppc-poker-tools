// ── Shared types from range-editor format ────────────────────────────────────

export type Position = 'UTG' | 'UTG+1' | 'UTG+2' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface PaletteColor {
  id: string;
  hex: string;
  label: string;
}

export type HandAssignment = Record<string, number>; // colorId → frequency (0–100)

export interface Range {
  id: string;
  title: string;
  players: number;
  stackBB: number;
  position: Position;
  palette: PaletteColor[];
  hands: Record<string, HandAssignment>;
  rangeType: string;
  actionSequence: unknown[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  ranges: Range[];
  collections: { id: string; title: string; rangeIds: string[] }[];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = 's' | 'h' | 'd' | 'c';
export type Card = `${Rank}${Suit}`; // e.g. "As", "Kh", "Td"

// ── Game ──────────────────────────────────────────────────────────────────────

export type ActionType = 'check' | 'bet' | 'call' | 'fold' | 'raise' | 'all_in';

export interface StreetAction {
  player: 'hero' | 'villain';
  type: ActionType;
  amount?: number; // in BB
}

export type Street = 'flop' | 'turn' | 'river';

/** Who acts next on the current street, given the actions so far */
export type NextActor =
  | { who: 'hero'; facingBet: number }
  | { who: 'villain'; facingBet: number }
  | { who: 'done' }
  | { who: 'hand_over'; winner: 'hero' | 'villain' | 'showdown' };

export type GamePhase =
  | 'setup'
  | 'hero_turn'
  | 'villain_turn'
  | 'loading'
  | 'showing_result'
  | 'next_street'
  | 'hand_over'
  | 'reviewing';  // fetching end-of-hand AI review

export interface GameState {
  heroRange: Range;
  villainRange: Range;
  heroHand: [Card, Card];
  heroHandType: string;
  villainPickedHand: [Card, Card];
  villainPickedHandType: string;
  board: Card[];
  street: Street;
  pot: number;
  heroStack: number;
  villainStack: number;
  heroIsIP: boolean;
  allActions: StreetAction[];
  streetActions: StreetAction[];
  phase: GamePhase;
  lastComment: string | null;
  lastVillainAction: VillainDecision | null;
  handReview: HandReview | null;
  error: string | null;
}

/** Villain's action decision — no comment during play; reasoning revealed only at end */
export interface VillainDecision {
  action: ActionType;
  amount?: number;
}

export interface ClaudeResponse {
  comment: string;
  villain: VillainDecision;
}

export interface VillainOnlyResponse {
  villain: VillainDecision;
}

// ── End-of-hand review ────────────────────────────────────────────────────────

export interface HandReviewItem {
  player: 'hero' | 'villain';
  action: string;
  explanation: string;
}

export interface HandReview {
  villainHand: string;
  summary: string;
  items: HandReviewItem[];
}
