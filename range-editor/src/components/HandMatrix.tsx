import { useRef, useCallback } from 'react';
import { RANKS, cellToHand } from '../hands';
import type { PaletteColor, HandAssignment } from '../types';

interface Props {
  hands: Record<string, HandAssignment>;
  palette: PaletteColor[];
  activeColorId: string | null;
  frequency: number; // 0–100
  onHandsChange: (hands: Record<string, HandAssignment>) => void;
  fontSizeClass?: 'sm' | 'md' | 'lg';
}

function cellBackground(assignment: HandAssignment, palette: PaletteColor[], isPair: boolean): string {
  const entries = Object.entries(assignment)
    .map(([cid, freq]) => {
      const pc = palette.find(p => p.id === cid);
      return pc && freq > 0 ? { hex: pc.hex, freq } : null;
    })
    .filter(Boolean) as { hex: string; freq: number }[];

  // Fond de base : légèrement plus clair pour les paires (diagonale)
  const baseBg = isPair ? '#252d40' : '#1e2433';

  if (entries.length === 0) return baseBg;
  if (entries.length === 1) return entries[0].hex;

  const total = entries.reduce((s, e) => s + e.freq, 0);
  let stops = '';
  let acc = 0;
  for (const e of entries) {
    const pct = (e.freq / total) * 100;
    stops += `${e.hex} ${acc.toFixed(1)}% ${(acc + pct).toFixed(1)}%,`;
    acc += pct;
  }
  return `linear-gradient(90deg, ${stops.slice(0, -1)})`;
}

export default function HandMatrix({ hands, palette, activeColorId, frequency, onHandsChange, fontSizeClass = 'md' }: Props) {
  const isPainting = useRef(false);
  // Mémorise si le premier clic de la session de peinture était un "effacement"
  // (pour que le drag reste cohérent : si on commence en effaçant, on efface partout)
  const paintMode = useRef<'apply' | 'remove'>('apply');

  const applyToHand = useCallback((hand: string, mode: 'apply' | 'remove') => {
    if (!activeColorId) return;
    const current = hands[hand] || {};
    const updated = { ...current };

    if (mode === 'remove' || frequency === 0) {
      delete updated[activeColorId];
    } else {
      updated[activeColorId] = frequency;
    }

    Object.keys(updated).forEach(k => { if (updated[k] === 0) delete updated[k]; });
    onHandsChange({ ...hands, [hand]: updated });
  }, [hands, activeColorId, frequency, onHandsChange]);

  const handleMouseDown = (hand: string) => {
    if (!activeColorId) return;
    isPainting.current = true;

    // Toggle : si la cellule a déjà exactement cette couleur → on efface, sinon on applique
    const current = hands[hand] || {};
    const alreadyHasColor = activeColorId in current && current[activeColorId] > 0;
    paintMode.current = alreadyHasColor ? 'remove' : 'apply';

    applyToHand(hand, paintMode.current);
  };

  const handleMouseEnter = (hand: string) => {
    if (isPainting.current) applyToHand(hand, paintMode.current);
  };

  const handleMouseUp = () => { isPainting.current = false; };

  return (
    <div
      className={`hand-matrix matrix-font-${fontSizeClass}`}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ userSelect: 'none' }}
    >
      <div className="matrix-grid">
        <div className="matrix-corner" />
        {RANKS.map(r => (
          <div key={r} className="matrix-header">{r}</div>
        ))}
        {RANKS.map((rowRank, ri) => (
          <>
            <div key={`h-${ri}`} className="matrix-header">{rowRank}</div>
            {RANKS.map((_, ci) => {
              const hand = cellToHand(ri, ci);
              const assignment = hands[hand] || {};
              const isSuited = ri < ci;
              const isPair   = ri === ci;
              const bg = cellBackground(assignment, palette, isPair);
              const hasColor = Object.values(assignment).some(v => v > 0);
              return (
                <div
                  key={`${ri}-${ci}`}
                  className={`matrix-cell ${isSuited ? 'suited' : isPair ? 'pair' : 'offsuit'} ${hasColor ? 'colored' : ''}`}
                  style={{ background: bg }}
                  onMouseDown={() => handleMouseDown(hand)}
                  onMouseEnter={() => handleMouseEnter(hand)}
                >
                  <span className="hand-label">{hand}</span>
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
