import type { ActionType } from '../types';
import { betAmounts, raiseAmounts } from '../lib/game';

interface ActionButtonsProps {
  pot: number;
  stack: number;
  facingBet: number;   // 0 = no bet to face (open action)
  onAction: (type: ActionType, amount?: number) => void;
}

interface BtnProps {
  label: string;
  onClick: () => void;
  variant?: 'neutral' | 'red' | 'green' | 'blue' | 'orange';
}

function Btn({ label, onClick, variant = 'neutral' }: BtnProps) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    neutral: { bg: '#242b3d', border: '#3a4560', color: '#c8d6f0' },
    red:     { bg: '#3b1515', border: '#7f1d1d', color: '#fca5a5' },
    green:   { bg: '#14301a', border: '#15803d', color: '#86efac' },
    blue:    { bg: '#172040', border: '#1d4ed8', color: '#93c5fd' },
    orange:  { bg: '#301a0a', border: '#c2410c', color: '#fdba74' },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 14px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        color: c.color,
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'filter 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.3)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
    >
      {label}
    </button>
  );
}

export default function ActionButtons({ pot, stack, facingBet, onAction }: ActionButtonsProps) {
  const openAction = facingBet === 0;

  if (openAction) {
    const bets = betAmounts(pot, stack);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Btn label="Check" onClick={() => onAction('check')} variant="neutral" />
        {bets.map(({ label, amount }) => (
          <Btn key={label} label={`Bet ${label} (${amount.toFixed(1)}bb)`}
            onClick={() => onAction('bet', amount)} variant="blue" />
        ))}
        {stack > 0 && <Btn label={`All-in (${stack.toFixed(1)}bb)`}
          onClick={() => onAction('all_in', stack)} variant="orange" />}
      </div>
    );
  }

  // Facing a bet
  const raises = raiseAmounts(facingBet, pot, stack);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Btn label="Fold" onClick={() => onAction('fold')} variant="red" />
      <Btn label={`Call ${facingBet.toFixed(1)}bb`}
        onClick={() => onAction('call', facingBet)} variant="green" />
      {raises.map(({ label, amount }) => (
        <Btn key={label} label={`Raise ${label} (${amount.toFixed(1)}bb)`}
          onClick={() => onAction('raise', amount)} variant="orange" />
      ))}
    </div>
  );
}
