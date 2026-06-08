import { useState, useEffect, useMemo } from 'react';
import RangeGrid from '../components/RangeGrid';
import ContextSelector from '../components/ContextSelector';
import type { Action, HandActions, RangeContext } from '../engine/types';
import { ACTIONS, ACTION_LABELS, ACTION_COLORS } from '../engine/types';
import { contextKey, contextLabel, rangeStats } from '../engine/context';
import { getDefaultRange } from '../engine/defaultRanges';

// ── Action palette ─────────────────────────────────────────────────────────────

function ActionPalette({
  selected,
  onSelect,
}: {
  selected: Action;
  onSelect: (a: Action) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIONS.map(a => {
        const col   = ACTION_COLORS[a];
        const isOn  = selected === a;
        return (
          <button
            key={a}
            onClick={() => onSelect(a)}
            style={{
              background:  isOn ? col.bg : col.inactive,
              color:       '#fff',
              border:      `2px solid ${isOn ? col.bg : 'transparent'}`,
              borderRadius: 6,
              padding:     '4px 10px',
              fontSize:    12,
              fontWeight:  700,
              cursor:      'pointer',
              boxShadow:   isOn ? `0 0 8px ${col.bg}66` : 'none',
              transition:  'all 0.1s',
            }}
          >
            {ACTION_LABELS[a]}
          </button>
        );
      })}
    </div>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ fontSize: 10 }}>
      {ACTIONS.filter(a => a !== 'fold').map(a => {
        const col = ACTION_COLORS[a];
        return (
          <span key={a} className="flex items-center gap-1" style={{ color: '#94a3b8' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: col.bg, borderRadius: 2 }} />
            {ACTION_LABELS[a]}
          </span>
        );
      })}
      <span className="flex items-center gap-1" style={{ color: '#94a3b8' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, background: ACTION_COLORS.fold.bg, borderRadius: 2 }} />
        Fold
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

interface Props {
  ctx:          RangeContext;
  onCtxChange:  (ctx: RangeContext) => void;
  ranges:       Record<string, HandActions>;
  onSave:       (ctx: RangeContext, hands: HandActions) => void;
  onDelete:     (ctx: RangeContext) => void;
}

export default function EditorPage({ ctx, onCtxChange, ranges, onSave, onDelete }: Props) {
  const key          = contextKey(ctx);
  const savedHands   = ranges[key] ?? {};
  const [hands, setHands]       = useState<HandActions>(savedHands);
  const [selected, setSelected] = useState<Action>('open');
  const [saveMsg, setSaveMsg]   = useState('');
  const [isDirty, setIsDirty]   = useState(false);

  // Default range for current context (if any)
  const defaultRange = useMemo(() => getDefaultRange(key), [key]);

  // When context changes, load hands from saved ranges
  useEffect(() => {
    setHands(ranges[contextKey(ctx)] ?? {});
    setIsDirty(false);
    setSaveMsg('');
  }, [ctx, ranges]);

  function handleHandsChange(updated: HandActions) {
    setHands(updated);
    setIsDirty(true);
    setSaveMsg('');
  }

  function handleSave() {
    onSave(ctx, hands);
    setIsDirty(false);
    setSaveMsg('✓ Range sauvegardée');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  function handleResetToDefault() {
    if (!defaultRange) return;
    if (!confirm('Remettre cette range aux valeurs GTO par défaut ?')) return;
    setHands({ ...defaultRange });
    onSave(ctx, { ...defaultRange });
    setIsDirty(false);
    setSaveMsg('✓ Range GTO restaurée');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  function handleReset() {
    if (!confirm('Vider cette range ? Toutes les mains passeront en fold.')) return;
    const empty: HandActions = {};
    setHands(empty);
    onSave(ctx, empty);
    setIsDirty(false);
    setSaveMsg('Range vidée');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  function handleDelete() {
    if (!confirm('Supprimer cette range ? Cette action est irréversible.')) return;
    onDelete(ctx);
    setHands({});
    setIsDirty(false);
    setSaveMsg('Range supprimée');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  function handleSelectAll(action: Action) {
    if (action === 'fold') {
      setHands({});
      setIsDirty(true);
      return;
    }
    const updated: HandActions = {};
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const k = r === c
          ? 'AKQJT98765432'[r] + 'AKQJT98765432'[r]
          : c > r
          ? 'AKQJT98765432'[r] + 'AKQJT98765432'[c] + 's'
          : 'AKQJT98765432'[c] + 'AKQJT98765432'[r] + 'o';
        updated[k] = [action];
      }
    }
    setHands(updated);
    setIsDirty(true);
  }

  const stats    = rangeStats(hands);
  const hasRange = Object.keys(hands).length > 0;

  return (
    <div className="space-y-4">
      {/* Context */}
      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <ContextSelector ctx={ctx} onChange={onCtxChange} />
      </div>

      {/* Context label */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{contextLabel(ctx)}</h2>
          {defaultRange && !isDirty && (
            <span
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 4, padding: '1px 5px',
              }}
            >
              GTO
            </span>
          )}
        </div>
        {isDirty && (
          <span style={{ color: '#f59e0b', fontSize: 11 }}>● Non sauvegardé</span>
        )}
        {saveMsg && !isDirty && (
          <span style={{ color: '#22c55e', fontSize: 11 }}>{saveMsg}</span>
        )}
      </div>

      {/* Action palette */}
      <div>
        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>
          Clic = ajouter/retirer · Glisser = ajouter · Plusieurs actions = toutes valides
        </div>
        <ActionPalette selected={selected} onSelect={setSelected} />
      </div>

      {/* Quick-fill buttons */}
      <div className="flex flex-wrap gap-1.5">
        <span style={{ color: '#64748b', fontSize: 11, alignSelf: 'center' }}>Remplir :</span>
        {ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => handleSelectAll(a)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Tout {ACTION_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <RangeGrid
          hands={hands}
          mode="edit"
          selectedAction={selected}
          onHandsChange={handleHandsChange}
        />
        <div className="mt-2">
          <Legend />
        </div>
      </div>

      {/* Stats */}
      {hasRange && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Mains', stats.count.toString()],
            ['Combos', stats.combos.toString()],
            ['% jeu', `${stats.pct} %`],
          ].map(([label, val]) => (
            <div
              key={label}
              className="rounded-xl p-2 text-center"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{val}</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          style={{
            background: isDirty ? '#16a34a' : 'rgba(22,163,74,0.2)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: isDirty ? 'pointer' : 'not-allowed',
            opacity: isDirty ? 1 : 0.5,
          }}
        >
          Sauvegarder
        </button>

        {defaultRange && (
          <button
            onClick={handleResetToDefault}
            style={{
              background: 'rgba(59,130,246,0.1)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ↺ Défauts GTO
          </button>
        )}

        <button
          onClick={handleReset}
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: '#94a3b8',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Tout vider
        </button>

        {hasRange && (
          <button
            onClick={handleDelete}
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Supprimer
          </button>
        )}
      </div>

      {!hasRange && (
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          <p style={{ color: '#475569', fontSize: 13 }}>
            Aucune range définie — peindre sur la grille pour commencer.
          </p>
        </div>
      )}
    </div>
  );
}
