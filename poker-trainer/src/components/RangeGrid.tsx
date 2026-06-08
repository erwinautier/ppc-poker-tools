import { useState, useCallback, useEffect } from 'react';
import { RANKS } from '../engine/cards';
import type { Action, HandActions } from '../engine/types';
import { ACTION_COLORS } from '../engine/types';

// ── Multi-action background gradient ──────────────────────────────────────────

function cellBg(actions: Action[]): string {
  if (actions.length === 0) return ACTION_COLORS.fold.bg;
  if (actions.length === 1) return ACTION_COLORS[actions[0]].bg;

  const colors = actions.slice(0, 4).map(a => ACTION_COLORS[a].bg);
  const n      = colors.length;
  const stops: string[] = [];

  for (let i = 0; i < n; i++) {
    const p1 = Math.round((i / n) * 100);
    const p2 = Math.round(((i + 1) / n) * 100);
    if (i === 0) stops.push(`${colors[i]} ${p2}%`);
    else         stops.push(`${colors[i]} ${p1}% ${p2}%`);
  }

  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

// ── Cell key helpers ───────────────────────────────────────────────────────────

function cellKey(r: number, c: number): string {
  if (r === c)  return RANKS[r] + RANKS[r];
  if (c > r)    return RANKS[r] + RANKS[c] + 's';
  return RANKS[c] + RANKS[r] + 'o';
}

function shortLabel(r: number, c: number): string {
  if (r === c)  return RANKS[r] + RANKS[r];
  if (c > r)    return RANKS[r] + RANKS[c];
  return RANKS[c] + RANKS[r];
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface RangeGridProps {
  hands:           HandActions;
  mode:            'view' | 'edit';
  selectedAction?: Action;
  onHandsChange?:  (updated: HandActions) => void;
  highlightKey?:   string;
  paintMode?:      'toggle' | 'add';  // 'toggle' = click toggles; 'add' = always adds (drag)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RangeGrid({
  hands,
  mode,
  selectedAction = 'open',
  onHandsChange,
  highlightKey,
}: RangeGridProps) {
  const [isPainting, setIsPainting] = useState(false);

  /**
   * Paint behaviour:
   * - Fold selected → clears all actions for the cell
   * - Other action, isToggle=true → add if absent, remove if present
   * - Other action, isToggle=false → always add (drag mode)
   */
  const paint = useCallback(
    (key: string, toggle = false) => {
      if (mode !== 'edit' || !onHandsChange) return;
      const updated = { ...hands };

      if (selectedAction === 'fold') {
        delete updated[key];
      } else {
        const current: Action[] = updated[key] ?? [];
        const has = current.includes(selectedAction);
        if (toggle && has) {
          const next = current.filter(a => a !== selectedAction);
          if (next.length === 0) delete updated[key];
          else updated[key] = next;
        } else if (!has) {
          updated[key] = [...current, selectedAction];
        }
      }
      onHandsChange(updated);
    },
    [mode, hands, selectedAction, onHandsChange],
  );

  useEffect(() => {
    const stop = () => setIsPainting(false);
    window.addEventListener('mouseup',  stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mouseup',  stop);
      window.removeEventListener('touchend', stop);
    };
  }, []);

  return (
    <div
      className="select-none touch-none"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 1 }}
    >
      {RANKS.map((_: string, r: number) =>
        RANKS.map((__: string, c: number) => {
          const key     = cellKey(r, c);
          const actions: Action[] = (hands[key] as Action[] | undefined) ?? [];
          const isHigh  = key === highlightKey;
          const bg      = isHigh ? ACTION_COLORS.fold.bg : cellBg(actions);
          const textCol = isHigh ? '#fbbf24' : '#fff';

          return (
            <div
              key={`${r}-${c}`}
              data-handkey={key}
              title={key + (actions.length > 0 ? ': ' + actions.join(', ') : ': fold')}
              style={{
                background:     bg,
                border:         isHigh ? '2px solid #fbbf24' : '1px solid #0f172a',
                borderRadius:   2,
                aspectRatio:    '1',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       7,
                fontWeight:     600,
                color:          textCol,
                cursor:         mode === 'edit' ? 'crosshair' : 'default',
                boxSizing:      'border-box',
                userSelect:     'none',
              }}
              onMouseDown={() => {
                if (mode !== 'edit') return;
                setIsPainting(true);
                paint(key, true); // single click = toggle
              }}
              onMouseEnter={() => { if (isPainting) paint(key, false); }} // drag = add
              onTouchStart={e => {
                if (mode !== 'edit') return;
                e.preventDefault();
                setIsPainting(true);
                paint(key, true);
              }}
              onTouchMove={e => {
                if (!isPainting || mode !== 'edit') return;
                e.preventDefault();
                const t  = e.touches[0];
                const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
                const hk = el?.dataset.handkey;
                if (hk) paint(hk);
              }}
            >
              {shortLabel(r, c)}
            </div>
          );
        }),
      )}
    </div>
  );
}
