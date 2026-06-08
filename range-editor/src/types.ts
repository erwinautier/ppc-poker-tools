export type Position = 'UTG' | 'UTG+1' | 'UTG+2' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const POSITIONS_BY_PLAYERS: Record<number, Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

export interface PaletteColor {
  id: string;
  hex: string;
  label: string;
}

// A hand assignment maps each colorId to a frequency (0–100). Sum should be ≤ 100.
export type HandAssignment = Record<string, number>;

export type RangeType = 'open' | 'facing_action';

export type VillainAction = 'open' | 'call' | '3bet' | 'xbet';

export interface VillainStep {
  position: Position;
  action: VillainAction | null; // null = n'a pas agi (fold / aucune action)
}

export interface Range {
  id: string;
  title: string;
  players: number;
  stackBB: number;
  position: Position;
  palette: PaletteColor[];
  hands: Record<string, HandAssignment>; // key = hand name e.g. "AKs"
  // Contexte d'action — pour la compatibilité trainer
  rangeType: RangeType;
  actionSequence: VillainStep[]; // uniquement pertinent si rangeType === 'facing_action'
  notes: string; // commentaires libres, max 500 caractères
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  rangeIds: string[];
  createdAt: number;
}

export interface AppState {
  ranges: Range[];
  collections: Collection[];
}
