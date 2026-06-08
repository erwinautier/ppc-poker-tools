import type { AppState, Range, Collection } from './types';

const STORAGE_KEY = 'range-editor-v1';

/** Migration des ranges créées avant l'ajout de nouveaux champs */
function migrateRange(r: Range): Range {
  return {
    ...r,
    rangeType: r.rangeType ?? 'open',
    actionSequence: r.actionSequence ?? [],
    notes: r.notes ?? '',
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: AppState = JSON.parse(raw);
      return { ...parsed, ranges: parsed.ranges.map(migrateRange) };
    }
  } catch {}
  return { ranges: [], collections: [] };
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportStateJSON(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranges-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importStateJSON(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target!.result as string));
      } catch {
        reject(new Error('Fichier JSON invalide'));
      }
    };
    reader.readAsText(file);
  });
}

export function newRange(): Range {
  return {
    id: crypto.randomUUID(),
    title: 'Nouvelle range',
    players: 6,
    stackBB: 100,
    position: 'BTN',
    palette: [
      { id: crypto.randomUUID(), hex: '#22c55e', label: 'Open' },
      { id: crypto.randomUUID(), hex: '#f59e0b', label: 'Limp' },
    ],
    hands: {},
    rangeType: 'open',
    actionSequence: [],
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function newCollection(): Collection {
  return {
    id: crypto.randomUUID(),
    title: 'Nouvelle collection',
    description: '',
    rangeIds: [],
    createdAt: Date.now(),
  };
}
