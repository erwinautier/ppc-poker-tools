import type { HandActions, AppStats, Action } from './types';
import type { SizingRules, SizingOption } from './sizing';
import { DEFAULT_RANGES } from './defaultRanges';

const RANGES_KEY = 'ptrainer-ranges-v2';   // v2 = multi-action format
const STATS_KEY  = 'ptrainer-stats-v1';
const SIZING_KEY = 'ptrainer-sizing-v1';

// ── Migration helper ───────────────────────────────────────────────────────────

const VALID_ACTIONS = new Set<string>(['fold', 'open', 'call', '3bet', 'open-shove', '3bet-shove']);

/** Migrate old single-string format → new Action[] format */
function migrateHands(raw: Record<string, unknown>): HandActions {
  const result: HandActions = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'string') {
      // Old format: single action string
      if (val !== 'fold' && VALID_ACTIONS.has(val)) result[key] = [val as Action];
    } else if (Array.isArray(val)) {
      // New format: Action[]
      const filtered = val.filter((a): a is Action => typeof a === 'string' && a !== 'fold' && VALID_ACTIONS.has(a));
      if (filtered.length > 0) result[key] = filtered;
    }
  }
  return result;
}

// ── Ranges ─────────────────────────────────────────────────────────────────────

export function loadRanges(): Record<string, HandActions> {
  try {
    // Try v2 first
    const raw2 = localStorage.getItem(RANGES_KEY);
    if (raw2) {
      const parsed = JSON.parse(raw2);
      if (typeof parsed === 'object' && parsed !== null) {
        const result: Record<string, HandActions> = {};
        for (const [ctxKey, handsRaw] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof handsRaw === 'object' && handsRaw !== null) {
            result[ctxKey] = migrateHands(handsRaw as Record<string, unknown>);
          }
        }
        return result;
      }
    }

    // Migrate from v1 if present
    const raw1 = localStorage.getItem('ptrainer-ranges-v1');
    if (raw1) {
      const parsed = JSON.parse(raw1);
      if (typeof parsed === 'object' && parsed !== null) {
        const result: Record<string, HandActions> = {};
        for (const [ctxKey, handsRaw] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof handsRaw === 'object' && handsRaw !== null) {
            result[ctxKey] = migrateHands(handsRaw as Record<string, unknown>);
          }
        }
        return result;
      }
    }

    // First launch — pre-populate with GTO defaults
    return { ...DEFAULT_RANGES };
  } catch {
    return { ...DEFAULT_RANGES };
  }
}

export function saveRanges(ranges: Record<string, HandActions>): void {
  try {
    localStorage.setItem(RANGES_KEY, JSON.stringify(ranges));
  } catch {
    console.error('[ptrainer] Failed to save ranges');
  }
}

// ── Sizing rules ───────────────────────────────────────────────────────────────

const VALID_SIZINGS = new Set<string>(['check', '25', '33', '50', '66', '75', 'pot', 'overbet']);

export function loadSizing(): SizingRules {
  try {
    const raw = localStorage.getItem(SIZING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: SizingRules = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        const filtered = val.filter((s): s is SizingOption =>
          typeof s === 'string' && VALID_SIZINGS.has(s),
        );
        if (filtered.length > 0) result[key] = filtered;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveSizing(rules: SizingRules): void {
  try {
    localStorage.setItem(SIZING_KEY, JSON.stringify(rules));
  } catch {
    console.error('[ptrainer] Failed to save sizing');
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────────

const EMPTY_STATS: AppStats = { data: {}, totalAttempts: 0, totalCorrect: 0 };

export function loadStats(): AppStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as AppStats;
    return {
      data:          parsed.data          ?? {},
      totalAttempts: parsed.totalAttempts ?? 0,
      totalCorrect:  parsed.totalCorrect  ?? 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: AppStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    console.error('[ptrainer] Failed to save stats');
  }
}

// ── Import / Export ────────────────────────────────────────────────────────────

export function exportData(ranges: Record<string, HandActions>, sizing: SizingRules): string {
  return JSON.stringify({ version: '2.0', ranges, sizing }, null, 2);
}

export interface ImportResult {
  ok:             boolean;
  ranges?:        Record<string, HandActions>;
  sizing?:        SizingRules;
  error?:         string;
  contextCount?:  number;
}

export function parseImport(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Fichier JSON invalide.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Structure de fichier invalide.' };
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.version !== 'string') {
    return { ok: false, error: 'Version manquante dans le fichier.' };
  }

  // Parse ranges
  const ranges: Record<string, HandActions> = {};
  let contextCount = 0;

  if (typeof obj.ranges === 'object' && obj.ranges !== null) {
    for (const [ctxKey, value] of Object.entries(obj.ranges as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      ranges[ctxKey] = migrateHands(value as Record<string, unknown>);
      contextCount++;
    }
  }

  // Parse sizing rules
  const sizing: SizingRules = {};
  if (typeof obj.sizing === 'object' && obj.sizing !== null) {
    for (const [key, val] of Object.entries(obj.sizing as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        const filtered = val.filter((s): s is SizingOption =>
          typeof s === 'string' && VALID_SIZINGS.has(s),
        );
        if (filtered.length > 0) sizing[key] = filtered;
      }
    }
  }

  if (contextCount === 0 && Object.keys(sizing).length === 0) {
    return { ok: false, error: 'Aucune donnée valide trouvée dans le fichier.' };
  }

  return { ok: true, ranges, sizing, contextCount };
}
