import { RANKS_DESC, RANK_CHARS, SUIT_CHARS, SUIT_SYMBOL, SUIT_COLOR } from '../lib/cards';

interface Props {
  title: string;
  used: Set<number>;
  current: number | null;
  onPick: (card: number | null) => void;
  onClose: () => void;
}

export function CardPicker({ title, used, current, onPick, onClose }: Props) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{title}</strong>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>
        <div className="picker-grid">
          {SUIT_CHARS.split('').map(suit =>
            RANKS_DESC.map(rank => {
              const n = RANK_CHARS.indexOf(rank) * 4 + SUIT_CHARS.indexOf(suit);
              const dead = used.has(n) && n !== current;
              const color = SUIT_COLOR[suit] === '#c8d6f0' ? '#1a1f2e' : SUIT_COLOR[suit];
              return (
                <button key={n} className="pick" disabled={dead} style={{ color }} onClick={() => onPick(n)}>
                  <span>{rank}</span><span>{SUIT_SYMBOL[suit]}</span>
                </button>
              );
            }),
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {current !== null && <button className="btn danger sm" onClick={() => onPick(null)}>Retirer la carte</button>}
        </div>
      </div>
    </div>
  );
}
