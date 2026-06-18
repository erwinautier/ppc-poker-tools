import type { AppState, Range } from '../types';

const STORAGE_KEY = 'range-editor-v1';

/** Normalize a hand assignment so the sum never exceeds 100 */
function normalizeAssignment(a: Record<string, number>): Record<string, number> {
  const entries = Object.entries(a).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0 || total <= 100) return a;
  const scale = 100 / total;
  return Object.fromEntries(entries.map(([k, v]) => [k, Math.round(v * scale)]));
}

/** Returns only hands that are actually played (non-empty assignment, sum > 0) */
function cleanHands(hands: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [hand, assignment] of Object.entries(hands)) {
    const normalized = normalizeAssignment(assignment);
    const sum = Object.values(normalized).reduce((s, v) => s + v, 0);
    if (sum > 0) result[hand] = normalized;
  }
  return result;
}

export function loadRanges(): Range[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const state: AppState = JSON.parse(raw);
    return (state.ranges ?? []).map(r => ({
      ...r,
      hands: cleanHands(r.hands ?? {}),
    }));
  } catch {
    return [];
  }
}

/** Ranges that have at least some playable hands */
export function getPlayableRanges(): Range[] {
  return loadRanges().filter(r => Object.keys(r.hands).length > 0);
}
