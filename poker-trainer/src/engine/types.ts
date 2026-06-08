// ── Game constants ─────────────────────────────────────────────────────────────

export type GameFormat = '6max' | '8max';

export const POSITIONS_6MAX = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export const POSITIONS_8MAX = ['UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

export const STACK_DEPTHS = [100, 50, 25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10] as const;
export type StackDepth = (typeof STACK_DEPTHS)[number];

export type Scenario = 'open' | 'call' | '3bet' | 'open-shove' | '3bet-shove';
export const SCENARIOS: Scenario[] = ['open', 'call', '3bet', 'open-shove', '3bet-shove'];

export const SCENARIO_LABELS: Record<Scenario, string> = {
  open:         'Open',
  call:         'Call vs open',
  '3bet':       '3-bet vs open',
  'open-shove': 'Open shove',
  '3bet-shove': '3-bet shove',
};

export type Action = 'fold' | 'open' | 'call' | '3bet' | 'open-shove' | '3bet-shove';
export const ACTIONS: Action[] = ['fold', 'open', 'call', '3bet', 'open-shove', '3bet-shove'];

export const ACTION_LABELS: Record<Action, string> = {
  fold:         'Fold',
  open:         'Open',
  call:         'Call',
  '3bet':       '3-bet',
  'open-shove': 'Open shove',
  '3bet-shove': '3-bet shove',
};

export const ACTION_COLORS: Record<Action, { bg: string; text: string; inactive: string }> = {
  fold:         { bg: '#334155', text: '#94a3b8', inactive: '#1e293b' },
  open:         { bg: '#16a34a', text: '#fff',    inactive: '#14532d' },
  call:         { bg: '#3b82f6', text: '#fff',    inactive: '#1e3a5f' },
  '3bet':       { bg: '#7c3aed', text: '#fff',    inactive: '#3b1a6b' },
  'open-shove': { bg: '#f97316', text: '#fff',    inactive: '#7c2d12' },
  '3bet-shove': { bg: '#ef4444', text: '#fff',    inactive: '#7f1d1d' },
};

export const POSITION_COLORS: Record<string, { active: string; inactive: string }> = {
  UTG:  { active: '#ef4444', inactive: '#3f1212' },
  UTG1: { active: '#f97316', inactive: '#3f1a0a' },
  LJ:   { active: '#eab308', inactive: '#3f300a' },
  HJ:   { active: '#a3e635', inactive: '#1a2e0a' },
  CO:   { active: '#22d3ee', inactive: '#0a2a2e' },
  BTN:  { active: '#f59e0b', inactive: '#3f2800' },
  SB:   { active: '#38bdf8', inactive: '#0a1e2e' },
  BB:   { active: '#3b82f6', inactive: '#0a1435' },
};

// ── Range types ────────────────────────────────────────────────────────────────

export interface RangeContext {
  format: GameFormat;
  position: string;
  stack: StackDepth;
  scenario: Scenario;
  villainPosition?: string;
}

/**
 * handKey → Action[] (non-fold only; missing key or empty array = fold only)
 * Multiple actions mean all of them are considered correct.
 */
export type HandActions = Record<string, Action[]>;

// ── Statistics ─────────────────────────────────────────────────────────────────

export interface HandStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  lastCorrect: boolean | null;
}

export interface AppStats {
  // key: `${contextKey}::${handKey}` → stats (preflop)
  // key: `sizing::${sizingCtxKey}` → stats (postflop sizing)
  data: Record<string, HandStats>;
  totalAttempts: number;
  totalCorrect: number;
}
