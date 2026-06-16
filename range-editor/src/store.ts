import type { AppState, Range, Collection, HandAssignment } from './types';

const STORAGE_KEY = 'range-editor-v1';

/** Si la somme des fréquences d'une main dépasse 100%, on la ramène à 100% au prorata. */
function normalizeAssignment(assignment: HandAssignment): HandAssignment {
  const entries = Object.entries(assignment).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 100 || total === 0) return assignment;
  const scale = 100 / total;
  const result: HandAssignment = {};
  entries.forEach(([k, v]) => { result[k] = Math.round(v * scale); });
  return result;
}

/** Migration des ranges créées avant l'ajout de nouveaux champs */
function migrateRange(r: Range): Range {
  const hands: Record<string, HandAssignment> = {};
  for (const [k, v] of Object.entries(r.hands ?? {})) {
    hands[k] = normalizeAssignment(v);
  }
  return {
    ...r,
    hands,
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

export interface ExportedState extends AppState {
  exportedBy?: string;
  exportedAt?: string;
}

export function exportStateJSON(state: AppState, username?: string): void {
  const payload: ExportedState = {
    ...state,
    exportedBy: username,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = username ? `${username}-ranges-${date}.json` : `ranges-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAndMergeStateJSON(
  file: File,
  current: AppState,
): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported: ExportedState = JSON.parse(e.target!.result as string);
        if (!Array.isArray(imported.ranges)) throw new Error('Format invalide');

        const author = imported.exportedBy ?? 'inconnu';

        // Merge ranges — deduplicate by id, keep most recent updatedAt
        const existingById = new Map(current.ranges.map(r => [r.id, r]));
        for (const r of imported.ranges) {
          const existing = existingById.get(r.id);
          if (!existing || (r.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
            existingById.set(r.id, migrateRange(r));
          }
        }
        const mergedRanges = [...existingById.values()];

        // Create a collection grouping all imported range ids
        const importedIds = imported.ranges.map(r => r.id);
        const collectionTitle = `Ranges de ${author}`;

        // If a collection with same title already exists, update its rangeIds
        const existingCol = current.collections.find(c => c.title === collectionTitle);
        let mergedCollections: AppState['collections'];
        if (existingCol) {
          const merged = [...new Set([...existingCol.rangeIds, ...importedIds])];
          mergedCollections = current.collections.map(c =>
            c.id === existingCol.id ? { ...c, rangeIds: merged } : c
          );
        } else {
          const newCol = {
            id: crypto.randomUUID(),
            title: collectionTitle,
            description: `Importé le ${new Date().toLocaleDateString('fr-FR')}`,
            rangeIds: importedIds,
            createdAt: Date.now(),
          };
          mergedCollections = [...current.collections, newCol];
        }

        // Also merge existing collections from the imported file
        for (const col of (imported.collections ?? [])) {
          if (!mergedCollections.find(c => c.id === col.id) && col.title !== collectionTitle) {
            mergedCollections = [...mergedCollections, col];
          }
        }

        resolve({ ranges: mergedRanges, collections: mergedCollections });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Fichier JSON invalide'));
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
