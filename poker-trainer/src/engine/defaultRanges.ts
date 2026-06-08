/**
 * Default GTO-approximation ranges for 6-max NLHE.
 * These are starting points — edit them freely in the Range Editor.
 * Based on solver output approximations at 100 bb deep.
 */

import type { Action, HandActions } from './types';

// ── Rank helpers ──────────────────────────────────────────────────────────────

const RANKS = 'AKQJT98765432';
const RI: Record<string, number> = {};
for (let i = 0; i < RANKS.length; i++) RI[RANKS[i]] = i;

// ── Token expander ────────────────────────────────────────────────────────────

function parseHand(s: string): { r1: string; r2: string; suit: string } | null {
  if (s.length === 2 && RI[s[0]] !== undefined && RI[s[1]] !== undefined)
    return { r1: s[0], r2: s[1], suit: '' };
  if (s.length === 3 && RI[s[0]] !== undefined && RI[s[1]] !== undefined && (s[2] === 's' || s[2] === 'o'))
    return { r1: s[0], r2: s[1], suit: s[2] };
  return null;
}

function expandToken(token: string): string[] {
  const keys: string[] = [];

  // Dash range: "JJ-88", "A5s-A2s", "ATo-A7o"
  const dashIdx = token.indexOf('-', 1);
  if (dashIdx > 0 && dashIdx < token.length - 1) {
    const left  = parseHand(token.slice(0, dashIdx));
    const right = parseHand(token.slice(dashIdx + 1));
    if (left && right) {
      // Pair range: both are pairs
      if (left.r1 === left.r2 && right.r1 === right.r2) {
        const lo = Math.min(RI[left.r1], RI[right.r1]);
        const hi = Math.max(RI[left.r1], RI[right.r1]);
        for (let i = lo; i <= hi; i++) keys.push(RANKS[i] + RANKS[i]);
        return keys;
      }
      // Same first rank + same suit: "A5s-A2s"
      if (left.r1 === right.r1 && left.suit === right.suit && left.suit !== '') {
        const lo = Math.min(RI[left.r2], RI[right.r2]);
        const hi = Math.max(RI[left.r2], RI[right.r2]);
        const r1idx = RI[left.r1];
        for (let i = lo; i <= hi; i++) {
          if (i !== r1idx) keys.push(left.r1 + RANKS[i] + left.suit);
        }
        return keys;
      }
    }
  }

  // Plus notation: "77+", "ATs+", "AQo+"
  const isPlus = token.endsWith('+');
  const base   = isPlus ? token.slice(0, -1) : token;
  const h      = parseHand(base);
  if (!h) return keys;

  const { r1, r2, suit } = h;
  const r1i = RI[r1];
  const r2i = RI[r2];

  if (r1 === r2) {
    // Pair
    if (isPlus) {
      for (let i = r1i; i >= 0; i--) keys.push(RANKS[i] + RANKS[i]);
    } else {
      keys.push(r1 + r2);
    }
  } else if (r1i < r2i) {
    // r1 is higher rank
    if (suit === 's' || suit === 'o') {
      if (isPlus) {
        for (let i = r2i; i > r1i; i--) keys.push(r1 + RANKS[i] + suit);
      } else {
        keys.push(r1 + r2 + suit);
      }
    } else {
      // No suit: both s and o
      if (isPlus) {
        for (let i = r2i; i > r1i; i--) {
          keys.push(r1 + RANKS[i] + 's');
          keys.push(r1 + RANKS[i] + 'o');
        }
      } else {
        keys.push(r1 + r2 + 's');
        keys.push(r1 + r2 + 'o');
      }
    }
  }

  return keys;
}

// ── Build HandActions from notation ──────────────────────────────────────────

function hands(notation: string, action: Action): HandActions {
  const result: HandActions = {};
  for (const token of notation.split(',').map(t => t.trim()).filter(Boolean)) {
    for (const key of expandToken(token)) {
      if (!result[key]) result[key] = [action];
      else if (!result[key].includes(action)) result[key].push(action);
    }
  }
  return result;
}

function merge(...sets: HandActions[]): HandActions {
  const r: HandActions = {};
  for (const s of sets) {
    for (const [k, actions] of Object.entries(s)) {
      if (!r[k]) r[k] = [];
      for (const a of actions) if (!r[k].includes(a)) r[k].push(a);
    }
  }
  return r;
}

// ── 6-max 100 bb opens ────────────────────────────────────────────────────────

const OPEN_LJ = hands(
  '66+, A2s+, KTs+, QTs+, JTs, T9s, AJo+, KQo',
  'open',
);

const OPEN_HJ = hands(
  '44+, A2s+, K9s+, QTs+, J9s+, T9s, T8s, 98s, 87s, ATo+, KJo+, QJo',
  'open',
);

const OPEN_CO = hands(
  '33+, A2s+, K8s+, Q8s+, J8s+, T8s+, 97s+, 87s, 86s, 76s, 75s, 65s, ATo+, KTo+, QTo+, JTo',
  'open',
);

const OPEN_BTN = hands(
  '22+, A2s+, K4s+, Q5s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, ATo+, K9o+, Q9o+, J9o+, T9o',
  'open',
);

const OPEN_SB = hands(
  '22+, A2s+, K3s+, Q4s+, J5s+, T5s+, 95s+, 84s+, 74s+, 63s+, 53s+, 43s, 42s, 32s, ATo+, K8o+, Q9o+, J9o+, T9o, 98o, 87o',
  'open',
);

// ── 6-max 100 bb BB defense (call + 3-bet merged) ────────────────────────────

// vs LJ (~14%): tight polarised 3-bet, medium call
const BB_CALL_LJ = merge(
  hands('QQ+, AKs, AQs, A5s-A3s, KQs, AKo', '3bet'),
  hands('55-22, AJs-A6s, KJs-K8s, QJs-Q9s, JTs-J9s, T9s-T8s, 98s, 97s, 87s, 76s, 65s, ATo-A9o, KQo-KJo, QJo', 'call'),
);

// vs HJ (~20%)
const BB_CALL_HJ = merge(
  hands('QQ+, AKs, AQs, A5s-A3s, KQs, QJs, AKo, AQo', '3bet'),
  hands('66-22, AJs-A2s, KTs-K7s, QTs-Q8s, JTs-J8s, T9s-T7s, 98s, 97s, 86s, 76s, 65s, ATo-A8o, KQo-KTo, QJo, JTo, T9o', 'call'),
);

// vs CO (~27%): wider 3-bet (more bluffs), call wider too
const BB_CALL_CO = merge(
  hands('JJ+, AKs-AQs, A5s-A2s, KQs, QJs, JTs, AKo, AQo, AJo', '3bet'),
  hands('99-22, AJs-A6s, KJs-K6s, QTs-Q7s, JTs-J7s, T9s-T6s, 98s-96s, 87s-85s, 76s-74s, 65s-64s, 54s, A9o-A6o, KQo-K9o, QJo-Q9o, JTo-J9o, T9o-T8o, 98o', 'call'),
);

// vs BTN (~42%): wide 3-bet, very wide call
const BB_CALL_BTN = merge(
  hands('JJ+, AKs-AJs, A5s-A2s, KQs-KJs, QJs, T9s, 98s, AKo, AQo, AJo, ATo', '3bet'),
  hands('99-22, ATs-A6s, KTs-K4s, QTs-Q4s, JTs-J5s, T9s-T5s, 98s-94s, 87s-84s, 76s-73s, 65s-63s, 54s-52s, 43s, A9o-A5o, KQo-K8o, QJo-Q8o, JTo-J8o, T9o-T7o, 98o-96o, 87o, 76o', 'call'),
);

// vs SB (~47%): SB opens very wide, BB defends very wide
const BB_CALL_SB = merge(
  hands('TT+, AKs-AJs, A5s-A2s, KQs-KTs, QJs, JTs, AKo, AQo, AJo', '3bet'),
  hands('99-22, ATs-A3s, KJs-K3s, QTs-Q3s, JTs-J4s, T9s-T4s, 98s-93s, 87s-83s, 76s-73s, 65s-63s, 54s-52s, 43s-42s, 32s, ATo-A3o, KQo-K6o, QJo-Q7o, JTo-J7o, T9o-T7o, 98o-96o, 87o, 76o, 65o', 'call'),
);

// ── 6-max 100 bb BTN/SB 3-bet ranges ─────────────────────────────────────────

// BTN 3-bet vs CO
const BTN_3BET_CO = merge(
  hands('QQ+, AKs, AQs, A5s-A3s, KQs, AKo, AQo', '3bet'),
  hands('JJ-88, AJs-ATs, KQs-KJs, QJs, JTs, T9s, AJo-ATo, KQo', 'call'),
);

// BTN 3-bet vs HJ
const BTN_3BET_HJ = merge(
  hands('QQ+, AKs, AQs, A5s-A2s, KQs, AKo, AQo', '3bet'),
  hands('JJ-66, AJs-ATs, KJs+, QJs, JTs, T9s, AJo, KQo-KJo', 'call'),
);

// SB 3-bet vs BTN
const SB_3BET_BTN = merge(
  hands('QQ+, AKs-AQs, A5s-A2s, KQs, QJs, JTs, T9s, AKo, AQo', '3bet'),
  hands('JJ-44, AJs-ATs, KQs-KTs, JTs, 98s, AJo-ATo, KQo-KJo', 'call'),
);

// ── 6-max 50 bb opens (shorter stack adjustments) ────────────────────────────

const OPEN_LJ_50 = hands(
  '55+, A2s+, KTs+, QTs+, JTs, T9s, AJo+, KQo',
  'open',
);

const OPEN_BTN_50 = hands(
  '22+, A2s+, K3s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, ATo+, K9o+, Q9o+, J9o+, T9o, 98o',
  'open',
);

// ── 6-max shove ranges (20 bb) ────────────────────────────────────────────────

const SHOVE_LJ_20 = hands(
  '77+, A8s+, A5s-A3s, KQs, ATo+, KQo',
  'open-shove',
);

const SHOVE_BTN_20 = hands(
  '22+, A2s+, K7s+, Q9s+, J9s+, T9s, A7o+, K9o+, Q9o+, J9o+',
  'open-shove',
);

const SHOVE_SB_20 = hands(
  '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, A4o+, K8o+, Q9o+, J9o+, T9o',
  'open-shove',
);

// ── 8-max 100 bb opens ────────────────────────────────────────────────────────

const OPEN_UTG_8MAX = hands(
  '99+, ATs+, KQs, AJo+, KQo',
  'open',
);

const OPEN_UTG1_8MAX = hands(
  '77+, ATs+, KJs+, QJs, JTs, AJo+, KQo',
  'open',
);

const OPEN_LJ_8MAX = hands(
  '55+, A2s+, KTs+, QTs+, JTs, T9s, 98s, ATo+, KJo+, QJo',
  'open',
);

const OPEN_CO_8MAX = hands(
  '33+, A2s+, K8s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, ATo+, KTo+, QJo, JTo',
  'open',
);

const OPEN_BTN_8MAX = hands(
  '22+, A2s+, K4s+, Q5s+, J6s+, T7s+, 97s+, 86s+, 76s, 75s, 65s, ATo+, K9o+, Q9o+, J9o+, T9o',
  'open',
);

// ── Export ────────────────────────────────────────────────────────────────────

export const DEFAULT_RANGES: Record<string, HandActions> = {
  // 6-max 100bb opens
  '6max|LJ|100|open':  OPEN_LJ,
  '6max|HJ|100|open':  OPEN_HJ,
  '6max|CO|100|open':  OPEN_CO,
  '6max|BTN|100|open': OPEN_BTN,
  '6max|SB|100|open':  OPEN_SB,

  // 6-max 100bb BB defense
  '6max|BB|100|call|LJ':  BB_CALL_LJ,
  '6max|BB|100|call|HJ':  BB_CALL_HJ,
  '6max|BB|100|call|CO':  BB_CALL_CO,
  '6max|BB|100|call|BTN': BB_CALL_BTN,
  '6max|BB|100|call|SB':  BB_CALL_SB,

  // 6-max 100bb BTN/SB responses
  '6max|BTN|100|call|CO':  BTN_3BET_CO,
  '6max|BTN|100|call|HJ':  BTN_3BET_HJ,
  '6max|SB|100|call|BTN':  SB_3BET_BTN,

  // 6-max 50bb opens
  '6max|LJ|50|open':  OPEN_LJ_50,
  '6max|BTN|50|open': OPEN_BTN_50,

  // 6-max 20bb shoves
  '6max|LJ|20|open-shove':  SHOVE_LJ_20,
  '6max|BTN|20|open-shove': SHOVE_BTN_20,
  '6max|SB|20|open-shove':  SHOVE_SB_20,

  // 8-max 100bb opens
  '8max|UTG|100|open':  OPEN_UTG_8MAX,
  '8max|UTG1|100|open': OPEN_UTG1_8MAX,
  '8max|LJ|100|open':   OPEN_LJ_8MAX,
  '8max|CO|100|open':   OPEN_CO_8MAX,
  '8max|BTN|100|open':  OPEN_BTN_8MAX,
};

export function getDefaultRange(ctxKey: string): HandActions | undefined {
  return DEFAULT_RANGES[ctxKey];
}
