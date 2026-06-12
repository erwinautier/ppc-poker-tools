import type { AppState, Range } from '../types';
import { newRange, newCollection } from '../store';
import { Plus, FolderPlus, Trash2, ChevronRight, ChevronDown, FolderOpen, Copy } from 'lucide-react';
import { useState } from 'react';

interface Props {
  state: AppState;
  selectedRangeId: string | null;
  onSelectRange: (id: string) => void;
  onStateChange: (state: AppState) => void;
  isOpen: boolean;
}

export default function Sidebar({ state, selectedRangeId, onSelectRange, onStateChange, isOpen }: Props) {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  const addRange = () => {
    const r = newRange();
    onStateChange({ ...state, ranges: [...state.ranges, r] });
    onSelectRange(r.id);
  };

  const duplicateRange = (r: Range) => {
    const copy: Range = {
      ...r,
      id: crypto.randomUUID(),
      title: `Copie de ${r.title}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const idx = state.ranges.findIndex(x => x.id === r.id);
    const ranges = [...state.ranges];
    ranges.splice(idx + 1, 0, copy);
    onStateChange({ ...state, ranges });
    onSelectRange(copy.id);
  };

  const deleteRange = (id: string) => {
    const range = state.ranges.find(r => r.id === id);
    if (!confirm(`Supprimer la range "${range?.title ?? ''}" ? Cette action est irréversible.`)) return;
    onStateChange({
      ...state,
      ranges: state.ranges.filter(r => r.id !== id),
      collections: state.collections.map(c => ({
        ...c,
        rangeIds: c.rangeIds.filter(rid => rid !== id),
      })),
    });
  };

  const addCollection = () => {
    const c = newCollection();
    onStateChange({ ...state, collections: [...state.collections, c] });
    setExpandedCollections(prev => new Set([...prev, c.id]));
  };

  const deleteCollection = (id: string) => {
    if (!confirm('Supprimer ce dossier ? Les ranges qu\'il contient ne seront pas supprimées.')) return;
    onStateChange({ ...state, collections: state.collections.filter(c => c.id !== id) });
  };

  const duplicateCollection = (col: typeof state.collections[number]) => {
    // Duplicate all ranges in the collection with new ids
    const idMap = new Map<string, string>(); // old id → new id
    const newRanges = col.rangeIds.map(rid => {
      const original = state.ranges.find(r => r.id === rid);
      if (!original) return null;
      const newId = crypto.randomUUID();
      idMap.set(rid, newId);
      return { ...original, id: newId, title: `Copie de ${original.title}`, createdAt: Date.now(), updatedAt: Date.now() };
    }).filter(Boolean) as typeof state.ranges;

    const newCol = {
      ...col,
      id: crypto.randomUUID(),
      title: `Copie de ${col.title}`,
      rangeIds: col.rangeIds.map(rid => idMap.get(rid) ?? rid),
      createdAt: Date.now(),
    };

    onStateChange({
      ...state,
      ranges: [...state.ranges, ...newRanges],
      collections: [...state.collections, newCol],
    });
  };

  const updateCollectionTitle = (id: string, title: string) => {
    onStateChange({
      ...state,
      collections: state.collections.map(c => c.id === id ? { ...c, title } : c),
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addRangeToCollection = (collectionId: string, rangeId: string) => {
    onStateChange({
      ...state,
      collections: state.collections.map(c =>
        c.id === collectionId && !c.rangeIds.includes(rangeId)
          ? { ...c, rangeIds: [...c.rangeIds, rangeId] }
          : c
      ),
    });
  };

  const removeRangeFromCollection = (collectionId: string, rangeId: string) => {
    onStateChange({
      ...state,
      collections: state.collections.map(c =>
        c.id === collectionId
          ? { ...c, rangeIds: c.rangeIds.filter(id => id !== rangeId) }
          : c
      ),
    });
  };

  const rangesInCollections = new Set(state.collections.flatMap(c => c.rangeIds));
  const uncategorized = state.ranges.filter(r => !rangesInCollections.has(r.id));

  const renderRange = (r: Range, collectionId?: string) => (
    <div
      key={r.id}
      className={`sidebar-range ${selectedRangeId === r.id ? 'active' : ''}`}
      onClick={() => onSelectRange(r.id)}
    >
      <span className="range-title-text">{r.title}</span>
      <span className="range-meta">{r.position} · {r.stackBB}BB</span>
      <div className="range-actions">
        {collectionId && (
          <button
            className="btn-icon"
            title="Retirer de la collection"
            onClick={e => { e.stopPropagation(); removeRangeFromCollection(collectionId, r.id); }}
          >×</button>
        )}
        <button
          className="btn-icon"
          title="Dupliquer"
          onClick={e => { e.stopPropagation(); duplicateRange(r); }}
        >
          <Copy size={12} />
        </button>
        <button
          className="btn-icon danger"
          title="Supprimer"
          onClick={e => { e.stopPropagation(); deleteRange(r.id); }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );

  return (
    <div className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-title">Ranges</span>
        <div className="sidebar-actions">
          <button className="btn-icon" title="Nouvelle range" onClick={addRange}><Plus size={16} /></button>
          <button className="btn-icon" title="Nouvelle collection" onClick={addCollection}><FolderPlus size={16} /></button>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Collections */}
        {state.collections.map(col => (
          <div key={col.id} className="collection">
            <div className="collection-header" onClick={() => toggleExpand(col.id)}>
              {expandedCollections.has(col.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderOpen size={14} />
              <input
                className="collection-title-input"
                value={col.title}
                onChange={e => updateCollectionTitle(col.id, e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              <button
                className="btn-icon"
                title="Dupliquer le dossier"
                onClick={e => { e.stopPropagation(); duplicateCollection(col); }}
              ><Copy size={12} /></button>
              <button
                className="btn-icon danger"
                title="Supprimer le dossier"
                onClick={e => { e.stopPropagation(); deleteCollection(col.id); }}
              ><Trash2 size={12} /></button>
            </div>
            {expandedCollections.has(col.id) && (
              <div className="collection-ranges">
                {col.rangeIds.map(rid => {
                  const r = state.ranges.find(r => r.id === rid);
                  return r ? renderRange(r, col.id) : null;
                })}
                <select
                  className="add-to-collection-select"
                  value=""
                  onChange={e => { if (e.target.value) addRangeToCollection(col.id, e.target.value); }}
                >
                  <option value="">+ Ajouter une range…</option>
                  {state.ranges
                    .filter(r => !col.rangeIds.includes(r.id))
                    .map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}

        {/* Uncategorized */}
        {uncategorized.length > 0 && (
          <div className="uncategorized">
            {state.collections.length > 0 && (
              <div className="section-label">Sans collection</div>
            )}
            {uncategorized.map(r => renderRange(r))}
          </div>
        )}

        {state.ranges.length === 0 && (
          <div className="empty-state">
            Créez votre première range avec le bouton +
          </div>
        )}
      </div>
    </div>
  );
}
