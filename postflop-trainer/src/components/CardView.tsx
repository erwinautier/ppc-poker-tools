import { cardLabel } from '../lib/cards';
import type { Card } from '../types';

interface CardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

const SIZE = {
  sm: { w: 36, h: 50, rankSize: 14, suitSize: 16 },
  md: { w: 48, h: 66, rankSize: 18, suitSize: 22 },
  lg: { w: 60, h: 84, rankSize: 22, suitSize: 28 },
};

export default function CardView({ card, size = 'md', faceDown = false }: CardProps) {
  const { w, h, rankSize, suitSize } = SIZE[size];

  if (faceDown) {
    return (
      <div style={{
        width: w, height: h,
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f35 100%)',
        borderRadius: 6, border: '1px solid #2e4a6e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: suitSize, color: '#2e4a6e',
      }}>
        🂠
      </div>
    );
  }

  const { rank, suit, color } = cardLabel(card);
  const isRed = color === '#f87171';

  return (
    <div style={{
      width: w, height: h,
      background: '#f8f9fa',
      borderRadius: 6,
      border: '1px solid #ddd',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      color: isRed ? '#dc2626' : '#1e293b',
      userSelect: 'none',
    }}>
      <span style={{ fontSize: rankSize, fontWeight: 800, lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: suitSize, lineHeight: 1 }}>{suit}</span>
    </div>
  );
}

/** Horizontal row of cards */
export function CardRow({ cards, size = 'md', gap = 6 }: { cards: Card[]; size?: CardProps['size']; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap, alignItems: 'center' }}>
      {cards.map((c, i) => <CardView key={i} card={c} size={size} />)}
    </div>
  );
}
