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
      return pc && freq > 0 ? { hex: pc.hex, freq: Math.min(100, freq) } : null;
    })
    .filter(Boolean) as { hex: string; freq: number }[];

  // Fond de base : légèrement plus clair pour les paires (diagonale)
  const baseBg = isPair ? '#252d40' : '#1e2433';

  if (entries.length === 0) return baseBg;

  // Coloriage au prorata du % réel (sur 100), le reste de la case garde le fond de base
  let stops = '';
  let acc = 0;
  for (const e of entries) {
    stops += `${e.hex} ${acc.toFixed(1)}% ${(acc + e.freq).toFixed(1)}%,`;
    acc += e.freq;
  }
  if (acc < 100) {
    stops += `${baseBg} ${acc.toFixed(1)}% 100%`;
  } else {
    stops = stops.slice(0, -1);
  }
  return `linear-gradient(90deg, ${stops})`;
}

export default function HandMatrix({ hands, palette, activeColorId, frequency, onHandsChange, fontSizeClass = 'md' }: Props) {
  const isPainting = useRef(false);
  // Mémorise si le premier clic de la session de peinture était un "effacement"
  // (pour que le drag reste cohérent : si on commence en effaçant, on efface partout)
  const paintMode = useRef<'apply' | 'remove'>('apply');

  const applyToHand = useCallback((hand: string, mode: 'apply' | 'remove') => {
    if (!activeColorId) return;
    const current = hands[hand] || {};
    let updated: HandAssignment = { ...current };

    if (mode === 'remove' || frequency === 0) {
      delete updated[activeColorId];
    } else {
      const otherIds = Object.keys(updated).filter(id => id !== activeColorId && updated[id] > 0);
      const isNewColor = !(activeColorId in updated) || updated[activeColorId] <= 0;

      if (isNewColor && otherIds.length > 0) {
        // Plusieurs actions sur la même main → équirépartition par défaut entre toutes les couleurs
        const allIds = [...otherIds, activeColorId];
        const n = allIds.length;
        const base = Math.floor(100 / n);
        const remainder = 100 - base * n;
        updated = {};
        allIds.forEach((id, idx) => {
          updated[id] = base + (idx < remainder ? 1 : 0);
        });
      } else {
        // Ajustement d'une couleur déjà présente (ou première couleur sur la main)
        const newFreq = Math.min(100, frequency);
        const sumOthers = otherIds.reduce((s, id) => s + updated[id], 0);
        if (newFreq + sumOthers > 100) {
          // La somme ne doit jamais dépasser 100% → on réduit les autres au prorata
          const allowed = 100 - newFreq;
          const scale = sumOthers > 0 ? allowed / sumOthers : 0;
          otherIds.forEach(id => { updated[id] = Math.round(updated[id] * scale); });
        }
        updated[activeColorId] = newFreq;
      }
    }

    Object.keys(updated).forEach(k => { if (updated[k] <= 0) delete updated[k]; });
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
