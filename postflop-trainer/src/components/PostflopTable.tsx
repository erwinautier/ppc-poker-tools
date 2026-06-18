import type { Card, Street, StreetAction, ActionType } from '../types';

interface Props {
  heroHand: [Card, Card];
  heroHandType: string;
  heroPos: string;
  heroStack: number;
  heroIsIP: boolean;
  villainPos: string;
  villainStack: number;
  villainHand?: string | null; // revealed at end of hand
  board: Card[];
  street: Street;
  pot: number;
  streetActions: StreetAction[];
  loading?: boolean;
}

const SUIT_COLOR: Record<string, string> = { h: '#dc2626', d: '#dc2626', s: '#1e293b', c: '#1e293b' };
const SUIT_SYM: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

const ACTION_COLOR: Record<ActionType, string> = {
  check: '#6b7280', bet: '#f59e0b', call: '#22c55e',
  fold: '#ef4444', raise: '#f97316', all_in: '#a855f7',
};
const ACTION_LABEL: Record<ActionType, string> = {
  check: 'CHECK', bet: 'BET', call: 'CALL',
  fold: 'FOLD', raise: 'RAISE', all_in: 'ALL-IN',
};

function CardSvg({ card, x, y, w = 32, h = 44 }: { card: Card; x: number; y: number; w?: number; h?: number }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const color = SUIT_COLOR[suit] ?? '#1e293b';
  const sym = SUIT_SYM[suit] ?? suit;
  return (
    <g filter="url(#card-shadow)">
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#f8f9fa" stroke="#d1d5db" strokeWidth={0.8} />
      <text x={x + w / 2} y={y + h * 0.44} textAnchor="middle" fill={color}
        fontSize={h * 0.38} fontWeight={800} fontFamily="Inter, system-ui, sans-serif">{rank}</text>
      <text x={x + w / 2} y={y + h * 0.82} textAnchor="middle" fill={color}
        fontSize={h * 0.30} fontFamily="Inter, system-ui, sans-serif">{sym}</text>
    </g>
  );
}

function HiddenCard({ x, y, w = 32, h = 44 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.8} />
      <text x={x + w / 2} y={y + h * 0.65} textAnchor="middle" fill="#3b82f6"
        fontSize={h * 0.45} fontFamily="Inter, system-ui, sans-serif">?</text>
    </g>
  );
}

function ActionTag({ action, amount, x, y }: { action: ActionType; amount?: number; x: number; y: number }) {
  const color = ACTION_COLOR[action] ?? '#6b7280';
  const label = amount != null ? `${ACTION_LABEL[action]} ${amount.toFixed(1)}` : ACTION_LABEL[action];
  const w = Math.max(52, label.length * 6.5 + 12);
  return (
    <g transform={`translate(${x - w / 2}, ${y - 10})`}>
      <rect width={w} height={18} rx={9} fill={color} opacity={0.2} />
      <rect width={w} height={18} rx={9} fill="none" stroke={color} strokeWidth={1} />
      <text x={w / 2} y={12.5} textAnchor="middle" fill={color}
        fontSize={9} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">{label}</text>
    </g>
  );
}

const STREET_COLOR: Record<Street, string> = { flop: '#22c55e', turn: '#f59e0b', river: '#ef4444' };

export default function PostflopTable({
  heroHand, heroHandType, heroPos, heroStack,
  villainPos, villainStack, villainHand,
  board, street, pot, streetActions, loading,
}: Props) {

  // Last action per player this street
  const lastHeroAction = [...streetActions].reverse().find(a => a.player === 'hero');
  const lastVillainAction = [...streetActions].reverse().find(a => a.player === 'villain');

  const cx = 240, cy = 178;
  const W = 480, H = 356;
  const cardW = 34, cardH = 47;
  const gap = 6;

  // Board cards positions (centered)
  const boardCount = board.length;
  const boardTotalW = boardCount * cardW + (boardCount - 1) * gap;
  const boardStartX = cx - boardTotalW / 2;
  const boardY = cy - cardH / 2 - 8;

  // Hero hand positions
  const heroStartX = cx - cardW - gap / 2;
  const heroY = H - cardH - 12;

  // Villain hand positions
  const villainStartX = cx - cardW - gap / 2;
  const villainY = 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 480, display: 'block', margin: '0 auto' }}>
      <defs>
        <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Felt */}
      <ellipse cx={cx} cy={cy} rx={210} ry={140}
        fill="#0d2a0d" stroke="#1a4a1a" strokeWidth={6} />
      <ellipse cx={cx} cy={cy} rx={204} ry={134}
        fill="none" stroke="#0f3a0f" strokeWidth={2} />

      {/* Street label */}
      <text x={cx} y={cy - 112} textAnchor="middle" fill={STREET_COLOR[street]}
        fontSize={10} fontWeight={800} fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.1em">
        {street.toUpperCase()}
      </text>

      {/* Pot */}
      <text x={cx} y={boardY - 18} textAnchor="middle" fill="#fbbf24"
        fontSize={13} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        🪙 {pot.toFixed(1)}bb
      </text>

      {/* Board cards */}
      {board.map((c, i) => (
        <CardSvg key={i} card={c} x={boardStartX + i * (cardW + gap)} y={boardY} w={cardW} h={cardH} />
      ))}

      {/* Loading spinner overlay */}
      {loading && (
        <text x={cx} y={cy + 50} textAnchor="middle" fill="#60a5fa"
          fontSize={11} fontFamily="Inter, system-ui, sans-serif">⏳ IA…</text>
      )}

      {/* ── Villain seat (top) ── */}
      <rect x={cx - 72} y={villainY - 2} width={144} height={48} rx={10}
        fill="#1a1f2e" stroke="#2e3650" strokeWidth={1.5} />
      <text x={cx} y={villainY + 14} textAnchor="middle" fill="#e8eaf0"
        fontSize={11} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        {villainPos}
      </text>
      <text x={cx} y={villainY + 28} textAnchor="middle" fill="#7a8299"
        fontSize={10} fontFamily="Inter, system-ui, sans-serif">
        {villainStack.toFixed(1)}bb
      </text>
      {/* Villain cards — revealed or hidden */}
      {villainHand ? (
        <>
          <CardSvg card={villainHand.slice(0, 2) as Card} x={cx - cardW - gap / 2} y={villainY + 52} w={cardW} h={cardH} />
          <CardSvg card={villainHand.slice(2) as Card} x={cx + gap / 2} y={villainY + 52} w={cardW} h={cardH} />
        </>
      ) : (
        <>
          <HiddenCard x={cx - cardW - gap / 2} y={villainY + 52} w={cardW} h={cardH} />
          <HiddenCard x={cx + gap / 2} y={villainY + 52} w={cardW} h={cardH} />
        </>
      )}
      {/* Villain last action tag */}
      {lastVillainAction && (
        <ActionTag
          action={lastVillainAction.type}
          amount={lastVillainAction.amount}
          x={cx + 90}
          y={villainY + 76}
        />
      )}

      {/* ── Hero seat (bottom) ── */}
      <rect x={cx - 72} y={heroY - 50} width={144} height={48} rx={10}
        fill="#172040" stroke="#1d4ed8" strokeWidth={1.5} />
      <text x={cx} y={heroY - 34} textAnchor="middle" fill="#93c5fd"
        fontSize={11} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
        {heroPos} (vous)
      </text>
      <text x={cx} y={heroY - 20} textAnchor="middle" fill="#4b77c8"
        fontSize={10} fontFamily="Inter, system-ui, sans-serif">
        {heroStack.toFixed(1)}bb · {heroHandType}
      </text>
      {/* Hero cards */}
      <CardSvg card={heroHand[0]} x={heroStartX} y={heroY} w={cardW} h={cardH} />
      <CardSvg card={heroHand[1]} x={heroStartX + cardW + gap} y={heroY} w={cardW} h={cardH} />
      {/* Hero last action tag */}
      {lastHeroAction && (
        <ActionTag
          action={lastHeroAction.type}
          amount={lastHeroAction.amount}
          x={cx + 90}
          y={heroY + 24}
        />
      )}
    </svg>
  );
}
