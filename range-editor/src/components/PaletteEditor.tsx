import { useState, useRef, useEffect } from 'react';
import type { PaletteColor } from '../types';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';

interface Props {
  palette: PaletteColor[];
  activeColorId: string | null;
  frequency: number;
  onPaletteChange: (palette: PaletteColor[]) => void;
  onActiveColorChange: (id: string) => void;
  onFrequencyChange: (f: number) => void;
}

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#ec4899',
];

export default function PaletteEditor({
  palette, activeColorId, frequency,
  onPaletteChange, onActiveColorChange, onFrequencyChange
}: Props) {
  // Id de la couleur dont on édite le nom (null = aucune)
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus automatique quand on entre en mode édition
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const addColor = () => {
    const used = palette.map(p => p.hex);
    const hex = PRESET_COLORS.find(c => !used.includes(c)) || '#888888';
    const newColor: PaletteColor = { id: crypto.randomUUID(), hex, label: 'Nouvelle action' };
    onPaletteChange([...palette, newColor]);
    onActiveColorChange(newColor.id);
    setEditingId(newColor.id); // → édition du nom immédiatement
  };

  const removeColor = (id: string) => {
    onPaletteChange(palette.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateColor = (id: string, field: 'hex' | 'label', value: string) => {
    onPaletteChange(palette.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const stopEditing = () => setEditingId(null);

  const handleItemClick = (id: string) => {
    // Clic sur l'item (hors crayon / corbeille / color picker) → sélectionne uniquement
    if (editingId === id) return; // on est déjà en mode édition, ne pas interférer
    onActiveColorChange(id);
  };

  return (
    <div className="palette-editor">
      <div className="section-title">Palette de couleurs</div>
      <div className="palette-list">
        {palette.map(color => {
          const isEditing = editingId === color.id;
          const isActive  = activeColorId === color.id;

          return (
            <div
              key={color.id}
              className={`palette-item ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
              onClick={() => handleItemClick(color.id)}
            >
              {/* Swatch couleur */}
              <input
                type="color"
                value={color.hex}
                onChange={e => updateColor(color.id, 'hex', e.target.value)}
                onClick={e => e.stopPropagation()}
                className="color-swatch-input"
                title="Changer la couleur"
              />

              {/* Nom : affichage statique ou champ d'édition */}
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={color.label}
                  onChange={e => updateColor(color.id, 'label', e.target.value)}
                  onBlur={stopEditing}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') stopEditing(); }}
                  onClick={e => e.stopPropagation()}
                  className="color-label-input color-label-input--editing"
                  placeholder="Nom de l'action…"
                />
              ) : (
                <span className="color-label-text">{color.label}</span>
              )}

              {/* Bouton crayon / valider */}
              {isEditing ? (
                <button
                  className="btn-icon"
                  title="Valider"
                  onClick={e => { e.stopPropagation(); stopEditing(); }}
                >
                  <Check size={14} />
                </button>
              ) : (
                <button
                  className="btn-icon"
                  title="Renommer"
                  onClick={e => {
                    e.stopPropagation();
                    onActiveColorChange(color.id); // sélectionne aussi
                    setEditingId(color.id);
                  }}
                >
                  <Pencil size={13} />
                </button>
              )}

              {/* Corbeille */}
              <button
                className="btn-icon danger"
                onClick={e => { e.stopPropagation(); removeColor(color.id); }}
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        <button className="btn-add" onClick={addColor}>
          <Plus size={14} /> Ajouter une couleur
        </button>
      </div>

      <div className="frequency-section">
        <label className="section-title">
          Fréquence : <strong>{frequency === 100 ? 'Toujours' : `${frequency}%`}</strong>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={frequency}
          onChange={e => onFrequencyChange(Number(e.target.value))}
          className="freq-slider"
        />
        <div className="freq-presets">
          {[0, 25, 33, 50, 67, 75, 100].map(v => (
            <button
              key={v}
              className={`freq-btn ${frequency === v ? 'active' : ''}`}
              onClick={() => onFrequencyChange(v)}
            >
              {v === 0 ? 'Effacer' : v === 100 ? '100%' : `${v}%`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
