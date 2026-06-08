// Bridge to read data produced by the range-editor app.
// The range-editor stores everything under localStorage key 'range-editor-v1'.

export interface REPaletteColor {
  id: string;
  hex: string;
  label: string;
}

export interface RERange {
  id: string;
  title: string;
  players: number;
  stackBB: number;
  position: string;
  palette: REPaletteColor[];
  /** handKey → { colorId: frequency (0–100) } */
  hands: Record<string, Record<string, number>>;
  rangeType: 'open' | 'facing_action';
  actionSequence: { position: string; action: string | null }[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface RECollection {
  id: string;
  title: string;
  description: string;
  rangeIds: string[];
  createdAt: number;
}

export interface REState {
  ranges: RERange[];
  collections: RECollection[];
}

const RE_STORAGE_KEY = 'range-editor-v1';

function migrateRange(r: RERange): RERange {
  return {
    ...r,
    rangeType: r.rangeType ?? 'open',
    actionSequence: r.actionSequence ?? [],
    notes: r.notes ?? '',
    hands: r.hands ?? {},
    palette: r.palette ?? [],
  };
}

export function loadREState(): REState | null {
  try {
    const raw = localStorage.getItem(RE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: REState = JSON.parse(raw);
    if (!Array.isArray(parsed.ranges)) return null;
    return {
      ranges: parsed.ranges.map(migrateRange),
      collections: parsed.collections ?? [],
    };
  } catch {
    return null;
  }
}

export function importREStateFromJSON(file: File): Promise<REState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: REState = JSON.parse(e.target!.result as string);
        if (!Array.isArray(parsed.ranges)) {
          reject(new Error('Format de fichier invalide (ranges manquantes).'));
          return;
        }
        resolve({
          ranges: parsed.ranges.map(migrateRange),
          collections: parsed.collections ?? [],
        });
      } catch {
        reject(new Error('Fichier JSON invalide.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsText(file);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Total assigned frequency for a hand (sum of all color frequencies, capped at 100). */
export function handTotalFreq(assignment: Record<string, number>): number {
  return Math.min(100, Object.values(assignment).reduce((a, b) => a + b, 0));
}

/** True if a hand is in the range with any non-zero frequency. */
export function handInRange(range: RERange, handKey: string): boolean {
  return handTotalFreq(range.hands[handKey] ?? {}) > 0;
}

/** Color IDs that appear for a given hand (freq > 0). */
export function handColors(range: RERange, handKey: string): string[] {
  const assignment = range.hands[handKey] ?? {};
  return Object.entries(assignment)
    .filter(([, freq]) => freq > 0)
    .map(([id]) => id);
}

/** Human-readable description of the scenario context. */
export function scenarioDescription(range: RERange): string {
  const nMax = `${range.players}-max`;
  if (range.rangeType === 'open') {
    return `Partie ${nMax}, ${range.stackBB} BB effectifs. Action à vous depuis ${range.position} — personne n'a encore ouvert.`;
  }

  const seqParts = range.actionSequence
    .filter(s => s.action !== null)
    .map(s => {
      const actLabels: Record<string, string> = {
        open: 'ouvre',
        call: 'call',
        '3bet': '3-bet',
        xbet: 'check-raise',
      };
      return `${s.position} ${actLabels[s.action!] ?? s.action}`;
    });

  const seqStr = seqParts.length > 0 ? seqParts.join(' → ') : 'action devant';
  return `Partie ${nMax}, ${range.stackBB} BB effectifs. ${seqStr}. À vous depuis ${range.position}.`;
}
