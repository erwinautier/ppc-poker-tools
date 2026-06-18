import type { ActionType, StreetAction } from '../types';
import { actionLabel } from '../lib/game';

interface CommentBoxProps {
  comment: string;
  heroAction: StreetAction;
  gtoAction: ActionType;
  gtoAmount?: number;
  onContinue: () => void;
  continueLabel?: string;
}

const ACTION_COLORS: Record<ActionType, string> = {
  check: '#6b7280', bet: '#f59e0b', call: '#22c55e',
  fold: '#ef4444', raise: '#f97316', all_in: '#a855f7',
};

function gtoLabel(action: ActionType, amount?: number): string {
  if (amount != null) return actionLabel({ player: 'hero', type: action, amount });
  return actionLabel({ player: 'hero', type: action });
}

export default function CommentBox({
  comment, heroAction, gtoAction, gtoAmount, onContinue, continueLabel = 'Continuer →',
}: CommentBoxProps) {
  const isCorrect = heroAction.type === gtoAction;
  const heroLabel = actionLabel(heroAction);
  const gtoLbl = gtoLabel(gtoAction, gtoAmount);

  return (
    <div style={{
      background: '#0f1827', border: '1px solid #1e3a5f', borderRadius: 12,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 800, letterSpacing: '0.08em' }}>
        🧠 ANALYSE GTO
      </div>

      {/* Hero action vs GTO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0a1020', borderRadius: 8, padding: '7px 10px',
        }}>
          <span style={{ fontSize: '0.7rem', color: '#7a8299', fontWeight: 700, minWidth: 110 }}>
            Ce que tu as fait :
          </span>
          <span style={{
            fontSize: '0.82rem', fontWeight: 700,
            color: ACTION_COLORS[heroAction.type] ?? '#e8eaf0',
          }}>
            {heroLabel}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '1rem' }}>
            {isCorrect ? '✅' : '❌'}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0a1020', borderRadius: 8, padding: '7px 10px',
        }}>
          <span style={{ fontSize: '0.7rem', color: '#7a8299', fontWeight: 700, minWidth: 110 }}>
            GTO recommande :
          </span>
          <span style={{
            fontSize: '0.82rem', fontWeight: 700,
            color: ACTION_COLORS[gtoAction] ?? '#e8eaf0',
          }}>
            {gtoLbl}
          </span>
        </div>
      </div>

      {/* Explanation */}
      <p style={{ fontSize: '0.85rem', color: '#c8d6f0', lineHeight: 1.65, margin: 0 }}>
        {comment}
      </p>

      <button
        onClick={onContinue}
        style={{
          padding: '9px 20px', background: '#1d3557', border: '1px solid #3b82f6',
          borderRadius: 8, color: '#93c5fd', fontSize: '0.88rem',
          fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e4080')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1d3557')}
      >
        {continueLabel}
      </button>
    </div>
  );
}
