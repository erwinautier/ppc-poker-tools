import { useState, useRef, useEffect } from 'react';
import type { PaletteColor } from '../types';
import { Plus, Trash2, Pencil, Check, ChevronDown } from 'lucide-react';

interface Props {
  palette: PaletteColor[];
  activeColorId: string | null;
  frequency: number;
  onPaletteChange: (palette: PaletteColor[]) => void;
  onActiveColorChange: (id: string) => void;
  onFrequencyChange: (f: number) => void;
}

const PRESET_ACTIONS: { label: string; hex: string }[] = [
  { label: 'Open / Raise',   hex: '#5ec26a' },
  { label: 'Limp',           hex: '#eea143' },
  { label: 'Open-Shove',     hex: '#ea4025' },
  { label: '3-bet',          hex: '#893df6' },
  { label: '3-bet Shove',    hex: '#882111' },
  { label: '3-bet light',    hex: '#ef8af9' },
  { label: '4-bet',          hex: '#1331f5' },
  { label: 'Loosifie',       hex: '#73f8fd' },
];

const FALLBACK_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#ec4899',
];

export default function PaletteEditor({
  palette, activeColorId, frequency,
  onPaletteChange, onActiveColorChange, onFrequencyChange
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showPresets) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPresets]);

  const addPreset = (preset: { label: string; hex: string } | null) => {
    const used = palette.map(p => p.hex);
    const hex = preset?.hex ?? FALLBACK_COLORS.find(c => !used.includes(c)) ?? '#888888';
    const label = preset?.label ?? 'Nouvelle action';
    const newColor: PaletteColor = { id: crypto.randomUUID(), hex, label };
    onPaletteChange([...palette, newColor]);
    onActiveColorChange(newColor.id);
    if (!preset) setEditingId(newColor.id); // "Autre" → édition immédiate
    setShowPresets(false);
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

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button className="btn-add" onClick={() => setShowPresets(v => !v)}>
            <Plus size={14} /> Ajouter une action <ChevronDown size={13} style={{ marginLeft: 2 }} />
          </button>

          {showPresets && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, marginTop: 4, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {PRESET_ACTIONS.map(preset => {
                const alreadyUsed = palette.some(p => p.label === preset.label);
                return (
                  <button
                    key={preset.label}
                    onClick={() => addPreset(preset)}
                    disabled={alreadyUsed}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 12px', background: 'none',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      cursor: alreadyUsed ? 'not-allowed' : 'pointer',
                      opacity: alreadyUsed ? 0.4 : 1,
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!alreadyUsed) e.currentTarget.style.background = 'var(--surface2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      background: preset.hex, border: '1px solid rgba(255,255,255,0.15)',
                    }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>
                      {preset.label}
                    </span>
                    {alreadyUsed && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        déjà ajouté
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => addPreset(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 12px', background: 'none',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  background: 'var(--surface2)', border: '1px dashed var(--border)',
                }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Autre (personnalisé)
                </span>
              </button>
            </div>
          )}
        </div>
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
