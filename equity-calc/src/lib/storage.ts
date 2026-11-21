/** Saved ranges: local to this tool, plus read-only import of the Range Editor's ranges. */

const LS_KEY = 'equity-calc-ranges-v1';
const RE_KEY = 'range-editor-v1';   // written by the Range Editor / Poker Trainer

export interface SavedRange {
  id: string;
  name: string;
  /** Compact range string. */
  text: string;
  source: 'local' | 'editor';
}

export function loadSavedRanges(): SavedRange[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? (JSON.parse(raw) as SavedRange[]) : [];
    return arr.map(r => ({ ...r, source: 'local' }));
  } catch { return []; }
}

export function saveRange(name: string, text: string): SavedRange[] {
  const list = loadSavedRanges().filter(r => r.name !== name);
  list.push({ id: `${Date.now()}`, name, text, source: 'local' });
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}

export function deleteRange(id: string): SavedRange[] {
  const list = loadSavedRanges().filter(r => r.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}

interface RERange {
  id: string; title: string; position: string; players: number; stackBB: number;
  palette?: { id: string }[];
  hands: Record<string, Record<string, number>>;
}

/** Ranges from the Range Editor (any hand with a non-zero frequency is included). */
export function loadEditorRanges(): SavedRange[] {
  try {
    const raw = localStorage.getItem(RE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ranges?: RERange[] };
    if (!Array.isArray(parsed.ranges)) return [];
    return parsed.ranges.map(r => {
      // Only colors still in the palette count (a deleted action leaves orphan frequencies).
      const ids = new Set((r.palette ?? []).map(p => p.id));
      const hands = Object.entries(r.hands ?? {})
        .filter(([, a]) => Object.entries(a).some(([id, f]) => ids.has(id) && f > 0))
        .map(([h]) => h);
      return {
        id: `re-${r.id}`,
        name: `${r.title} (${r.position}, ${r.stackBB}bb)`,
        text: hands.join(', '),
        source: 'editor' as const,
      };
    });
  } catch { return []; }
}
