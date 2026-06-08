import type { RERange } from './rangeEditorBridge';

const RE_STATS_KEY = 'ptrainer-re-stats-v1';

export interface REHandStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  lastCorrect: boolean | null;
}

export interface REStats {
  /** key: `re::{rangeId}::{handKey}` */
  data: Record<string, REHandStats>;
  totalAttempts: number;
  totalCorrect: number;
}

const EMPTY: REStats = { data: {}, totalAttempts: 0, totalCorrect: 0 };

export function loadREStats(): REStats {
  try {
    const raw = localStorage.getItem(RE_STATS_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as REStats;
    return { data: parsed.data ?? {}, totalAttempts: parsed.totalAttempts ?? 0, totalCorrect: parsed.totalCorrect ?? 0 };
  } catch {
    return EMPTY;
  }
}

export function saveREStats(stats: REStats): void {
  try { localStorage.setItem(RE_STATS_KEY, JSON.stringify(stats)); } catch { /* noop */ }
}

function statKey(rangeId: string, handKey: string): string {
  return `re::${rangeId}::${handKey}`;
}

export function recordREAttempt(
  stats: REStats,
  rangeId: string,
  handKey: string,
  correct: boolean,
): REStats {
  const key = statKey(rangeId, handKey);
  const prev = stats.data[key];
  const next: REHandStats = {
    attempts:    (prev?.attempts    ?? 0) + 1,
    correct:     (prev?.correct     ?? 0) + (correct ? 1 : 0),
    streak:      correct ? (prev?.streak ?? 0) + 1 : 0,
    lastSeen:    Date.now(),
    lastCorrect: correct,
  };
  return {
    data: { ...stats.data, [key]: next },
    totalAttempts: stats.totalAttempts + 1,
    totalCorrect:  stats.totalCorrect + (correct ? 1 : 0),
  };
}

export function getRangeStats(stats: REStats, rangeId: string): Record<string, REHandStats> {
  const prefix = `re::${rangeId}::`;
  const result: Record<string, REHandStats> = {};
  for (const [key, hs] of Object.entries(stats.data)) {
    if (key.startsWith(prefix)) result[key.slice(prefix.length)] = hs;
  }
  return result;
}

// ── Diagnostic aggregations ────────────────────────────────────────────────────

export interface DiagSummary {
  label: string;
  attempts: number;
  correct: number;
  pct: number;
}

function summary(label: string, attempts: number, correct: number): DiagSummary {
  return { label, attempts, correct, pct: attempts > 0 ? Math.round(correct / attempts * 100) : 0 };
}

export function diagByPosition(stats: REStats, ranges: RERange[]): DiagSummary[] {
  const map: Record<string, { a: number; c: number }> = {};
  for (const range of ranges) {
    const prefix = `re::${range.id}::`;
    const pos = range.position;
    if (!map[pos]) map[pos] = { a: 0, c: 0 };
    for (const [key, hs] of Object.entries(stats.data)) {
      if (key.startsWith(prefix)) {
        map[pos].a += hs.attempts;
        map[pos].c += hs.correct;
      }
    }
  }
  return Object.entries(map)
    .map(([pos, { a, c }]) => summary(pos, a, c))
    .filter(s => s.attempts >= 5)
    .sort((a, b) => a.pct - b.pct);
}

export function diagByStack(stats: REStats, ranges: RERange[]): DiagSummary[] {
  const map: Record<number, { a: number; c: number }> = {};
  for (const range of ranges) {
    const prefix = `re::${range.id}::`;
    const stack = range.stackBB;
    if (!map[stack]) map[stack] = { a: 0, c: 0 };
    for (const [key, hs] of Object.entries(stats.data)) {
      if (key.startsWith(prefix)) {
        map[stack].a += hs.attempts;
        map[stack].c += hs.correct;
      }
    }
  }
  return Object.entries(map)
    .map(([stack, { a, c }]) => summary(`${stack} BB`, a, c))
    .filter(s => s.attempts >= 5)
    .sort((a, b) => a.pct - b.pct);
}

export function diagByScenarioType(stats: REStats, ranges: RERange[]): DiagSummary[] {
  const map: Record<string, { a: number; c: number }> = {
    open: { a: 0, c: 0 },
    facing_action: { a: 0, c: 0 },
  };
  for (const range of ranges) {
    const prefix = `re::${range.id}::`;
    const type = range.rangeType;
    for (const [key, hs] of Object.entries(stats.data)) {
      if (key.startsWith(prefix)) {
        map[type].a += hs.attempts;
        map[type].c += hs.correct;
      }
    }
  }
  const labels: Record<string, string> = { open: 'Open (premier à parler)', facing_action: 'Facing action (relance devant)' };
  return Object.entries(map)
    .map(([type, { a, c }]) => summary(labels[type] ?? type, a, c))
    .filter(s => s.attempts >= 5)
    .sort((a, b) => a.pct - b.pct);
}

export function diagWorstHands(stats: REStats, rangeIds: string[]): { handKey: string; attempts: number; pct: number }[] {
  const prefixes = new Set(rangeIds.map(id => `re::${id}::`));
  const map: Record<string, { a: number; c: number }> = {};
  for (const [key, hs] of Object.entries(stats.data)) {
    const matchedPrefix = [...prefixes].find(p => key.startsWith(p));
    if (!matchedPrefix) continue;
    const handKey = key.slice(matchedPrefix.length);
    if (!map[handKey]) map[handKey] = { a: 0, c: 0 };
    map[handKey].a += hs.attempts;
    map[handKey].c += hs.correct;
  }
  return Object.entries(map)
    .map(([handKey, { a, c }]) => ({ handKey, attempts: a, pct: a > 0 ? Math.round(c / a * 100) : 0 }))
    .filter(s => s.attempts >= 3)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 15);
}
