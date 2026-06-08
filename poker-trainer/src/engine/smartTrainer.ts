import { RANKS } from './cards';
import type { Action, HandActions, HandStats, AppStats } from './types';

// ── All 169 canonical hand keys ────────────────────────────────────────────────

export function buildAllHandKeys(): string[] {
  const keys: string[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (r === c)      keys.push(RANKS[r] + RANKS[r]);
      else if (c > r)   keys.push(RANKS[r] + RANKS[c] + 's');
      else              keys.push(RANKS[c] + RANKS[r] + 'o');
    }
  }
  return keys;
}

export const ALL_HAND_KEYS: string[] = buildAllHandKeys(); // 169 entries

// ── Action lookup (multi-action) ──────────────────────────────────────────────

/**
 * Returns valid actions for a hand.
 * Missing key or empty array → ['fold'] (fold is the only correct answer).
 */
export function getActions(hands: HandActions, key: string): Action[] {
  const stored = hands[key];
  if (!stored || stored.length === 0) return ['fold'];
  return stored;
}

/** @deprecated use getActions */
export function getAction(hands: HandActions, key: string): Action {
  return getActions(hands, key)[0];
}

// ── Weight for smart selection ─────────────────────────────────────────────────

function getWeight(stats: HandStats | undefined): number {
  if (!stats || stats.attempts === 0) return 2.5; // never seen → high priority

  const errorRate = 1 - stats.correct / stats.attempts;

  // Base: 1.0 (error-free) → 4.0 (always wrong)
  let w = 1 + errorRate * 3;

  // Bonus for correct streak (mastered)
  if (stats.streak >= 5)      w *= 0.2;
  else if (stats.streak >= 3) w *= 0.45;
  else if (stats.streak >= 1) w *= 0.75;

  return Math.max(w, 0.05);
}

/**
 * Pick a hand key using weighted random selection.
 * All 169 hands are eligible (missing hands = fold is a valid answer).
 */
export function pickHandKey(
  contextStats: Record<string, HandStats> | undefined,
): string {
  const weights = ALL_HAND_KEYS.map(key => getWeight(contextStats?.[key]));
  const total   = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;

  for (let i = 0; i < ALL_HAND_KEYS.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return ALL_HAND_KEYS[i];
  }
  return ALL_HAND_KEYS[ALL_HAND_KEYS.length - 1];
}

// ── Stat key ──────────────────────────────────────────────────────────────────

export function statKey(contextKey: string, handKey: string): string {
  return `${contextKey}::${handKey}`;
}

export function getHandStats(stats: AppStats, ctxKey: string, handKey: string): HandStats | undefined {
  return stats.data[statKey(ctxKey, handKey)];
}

// ── Record a training attempt ──────────────────────────────────────────────────

export function recordAttempt(
  stats: AppStats,
  ctxKey: string,
  handKey: string,
  correct: boolean,
): AppStats {
  const key  = statKey(ctxKey, handKey);
  const prev = stats.data[key];

  const next: HandStats = {
    attempts:    (prev?.attempts    ?? 0) + 1,
    correct:     (prev?.correct     ?? 0) + (correct ? 1 : 0),
    streak:      correct ? (prev?.streak ?? 0) + 1 : 0,
    lastSeen:    Date.now(),
    lastCorrect: correct,
  };

  return {
    data:          { ...stats.data, [key]: next },
    totalAttempts: stats.totalAttempts + 1,
    totalCorrect:  stats.totalCorrect  + (correct ? 1 : 0),
  };
}

// ── Context stats aggregation (preflop only) ──────────────────────────────────

export interface ContextSummary {
  contextKey: string;
  attempts: number;
  correct: number;
  pct: number;
}

export function aggregateByContext(stats: AppStats): ContextSummary[] {
  const map: Record<string, { attempts: number; correct: number }> = {};

  for (const [key, hs] of Object.entries(stats.data)) {
    if (key.startsWith('sizing::')) continue;  // skip sizing stats
    const [ctxKey] = key.split('::');
    if (!map[ctxKey]) map[ctxKey] = { attempts: 0, correct: 0 };
    map[ctxKey].attempts += hs.attempts;
    map[ctxKey].correct  += hs.correct;
  }

  return Object.entries(map)
    .map(([contextKey, { attempts, correct }]) => ({
      contextKey,
      attempts,
      correct,
      pct: attempts > 0 ? Math.round(correct / attempts * 100) : 0,
    }))
    .filter(s => s.attempts >= 5)
    .sort((a, b) => a.pct - b.pct);
}

// ── Per-hand stats aggregation ────────────────────────────────────────────────

export interface HandSummary {
  handKey: string;
  attempts: number;
  correct: number;
  pct: number;
}

export function aggregateByHand(stats: AppStats): HandSummary[] {
  const map: Record<string, { attempts: number; correct: number }> = {};

  for (const [key, hs] of Object.entries(stats.data)) {
    const handKey = key.split('::')[1];
    if (!map[handKey]) map[handKey] = { attempts: 0, correct: 0 };
    map[handKey].attempts += hs.attempts;
    map[handKey].correct  += hs.correct;
  }

  return Object.entries(map)
    .map(([handKey, { attempts, correct }]) => ({
      handKey,
      attempts,
      correct,
      pct: attempts > 0 ? Math.round(correct / attempts * 100) : 0,
    }))
    .filter(s => s.attempts >= 3)
    .sort((a, b) => a.pct - b.pct);
}

// ── Context stats for a specific context ─────────────────────────────────────

export function contextHandStats(
  stats: AppStats,
  ctxKey: string,
): Record<string, HandStats> {
  const result: Record<string, HandStats> = {};
  const prefix = `${ctxKey}::`;
  for (const [key, hs] of Object.entries(stats.data)) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = hs;
    }
  }
  return result;
}

// ── Generate specific card display from hand key ──────────────────────────────

const SUITS = ['h', 'd', 'c', 's'] as const;
const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_IS_RED:  Record<string, boolean> = { h: true, d: true, c: false, s: false };

function pickSuit(): string {
  return SUITS[Math.floor(Math.random() * SUITS.length)];
}

function twoDistinctSuits(): [string, string] {
  const shuffled = [...SUITS].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export interface CardDisplay {
  rank: string;
  suit: string;
  symbol: string;
  isRed: boolean;
}

export function handKeyToCards(key: string): [CardDisplay, CardDisplay] {
  const r1 = key[0];
  const r2 = key[1];
  const type = key[2]; // undefined=pair, 's'=suited, 'o'=offsuit

  let s1: string, s2: string;
  if (!type) {
    [s1, s2] = twoDistinctSuits();
  } else if (type === 's') {
    s1 = s2 = pickSuit();
  } else {
    [s1, s2] = twoDistinctSuits();
  }

  return [
    { rank: r1, suit: s1, symbol: SUIT_SYMBOLS[s1], isRed: SUIT_IS_RED[s1] },
    { rank: r2, suit: s2, symbol: SUIT_SYMBOLS[s2], isRed: SUIT_IS_RED[s2] },
  ];
}
