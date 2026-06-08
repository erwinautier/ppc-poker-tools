import { RANKS } from './cards';
import type { RERange } from './rangeEditorBridge';
import type { REHandStats } from './reStats';

// ── 13×13 matrix helpers ──────────────────────────────────────────────────────
// Row = index of higher-rank card (A=0 … 2=12)
// Col = index of lower-rank card
// row < col → suited (above diagonal)
// row > col → offsuit (below diagonal)
// row == col → pair

function handToMatrix(key: string): [number, number] {
  if (key.length === 2) {
    const i = RANKS.indexOf(key[0] as typeof RANKS[number]);
    return [i, i];
  }
  const r1 = RANKS.indexOf(key[0] as typeof RANKS[number]);
  const r2 = RANKS.indexOf(key[1] as typeof RANKS[number]);
  if (key[2] === 's') return [r1, r2];
  return [r2, r1]; // offsuit: swap so row > col
}

function matrixToHand(row: number, col: number): string | null {
  if (row < 0 || row > 12 || col < 0 || col > 12) return null;
  if (row === col) return RANKS[row] + RANKS[row];
  if (row < col) return RANKS[row] + RANKS[col] + 's';
  return RANKS[col] + RANKS[row] + 'o';
}

// ── All 169 canonical keys ─────────────────────────────────────────────────────

const ALL_HAND_KEYS: string[] = [];
for (let r = 0; r < 13; r++) {
  ALL_HAND_KEYS.push(RANKS[r] + RANKS[r]); // pair
  for (let c = r + 1; c < 13; c++) {
    ALL_HAND_KEYS.push(RANKS[r] + RANKS[c] + 's'); // suited
    ALL_HAND_KEYS.push(RANKS[r] + RANKS[c] + 'o'); // offsuit
  }
}

// ── Adjacency ─────────────────────────────────────────────────────────────────

function nearbyHands(key: string, radius: number): string[] {
  const [row, col] = handToMatrix(key);
  const seen = new Set<string>();
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr === 0 && dc === 0) continue;
      const h = matrixToHand(row + dr, col + dc);
      if (h && h !== key) seen.add(h);
    }
  }
  return [...seen];
}

// ── Proximity mode ────────────────────────────────────────────────────────────

/**
 * Controls how far outside the range hands can be sampled.
 * - 'range'  : only hands in the range (totalFreq > 0)
 * - 'close'  : range + ≤1 cell away
 * - 'medium' : range + ≤3 cells (default)
 * - 'full'   : all 169 hands (light weighting still applied)
 */
export type ProximityMode = 'range' | 'close' | 'medium' | 'full';

// Max distance allowed per mode (Infinity = no limit)
const PROXIMITY_MAX_DIST: Record<ProximityMode, number> = {
  range:  0,
  close:  1,
  medium: 3,
  full:   Infinity,
};

// Out-of-range base weight per distance bucket
function outOfRangeBase(minDist: number, mode: ProximityMode): number {
  const maxDist = PROXIMITY_MAX_DIST[mode];
  if (minDist > maxDist) return 0; // excluded
  if (mode === 'full') {
    // Gentle decay: far hands still get small weight
    if (minDist <= 1) return 0.5;
    if (minDist <= 3) return 0.2;
    return 0.06;
  }
  if (minDist <= 1) return 0.55;
  if (minDist <= 2) return 0.3;
  return 0.12;
}

function handWeightWithMode(
  key: string,
  range: RERange,
  handStats: REHandStats | undefined,
  mode: ProximityMode,
): number {
  const assignment = range.hands[key] ?? {};
  const totalFreq = Math.min(100, Object.values(assignment).reduce((a, b) => a + b, 0));
  const inRange = totalFreq > 0;

  let base: number;
  if (inRange) {
    base = 1 + (totalFreq / 100) * 4; // 1–5
  } else {
    const [row, col] = handToMatrix(key);
    let minDist = Infinity;
    for (const [rk, ass] of Object.entries(range.hands)) {
      if (Object.values(ass).reduce((a, b) => a + b, 0) <= 0) continue;
      const [rr, rc] = handToMatrix(rk);
      const dist = Math.max(Math.abs(rr - row), Math.abs(rc - col));
      if (dist < minDist) minDist = dist;
    }
    base = outOfRangeBase(minDist, mode);
    if (base === 0) return 0; // outside allowed zone
  }

  if (!handStats || handStats.attempts === 0) return base * 1.3;
  const errorRate = 1 - handStats.correct / handStats.attempts;
  let perfMult = 1 + errorRate * 2;
  if (handStats.streak >= 5) perfMult *= 0.2;
  else if (handStats.streak >= 3) perfMult *= 0.5;
  else if (handStats.streak >= 1 && errorRate < 0.2) perfMult *= 0.75;

  return Math.max(base * perfMult, 0.01);
}

// ── Main picker ───────────────────────────────────────────────────────────────

export function pickHandForRange(
  range: RERange,
  handStats: Record<string, REHandStats>,
  mode: ProximityMode = 'medium',
): string {
  const weights = ALL_HAND_KEYS.map(key => handWeightWithMode(key, range, handStats[key], mode));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // Fallback: pick a random in-range hand
    const inRange = ALL_HAND_KEYS.filter(k => {
      const a = range.hands[k] ?? {};
      return Object.values(a).reduce((s, v) => s + v, 0) > 0;
    });
    return inRange[Math.floor(Math.random() * inRange.length)] ?? ALL_HAND_KEYS[0];
  }
  let rand = Math.random() * total;
  for (let i = 0; i < ALL_HAND_KEYS.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return ALL_HAND_KEYS[i];
  }
  return ALL_HAND_KEYS[ALL_HAND_KEYS.length - 1];
}

// ── Near-range preview (used in feedback grid) ────────────────────────────────

export function getNearHands(key: string): string[] {
  return nearbyHands(key, 2);
}

export { ALL_HAND_KEYS };
