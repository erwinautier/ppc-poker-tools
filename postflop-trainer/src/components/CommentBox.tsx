interface CommentBoxProps {
  comment: string;
  onContinue: () => void;
  continueLabel?: string;
}

export default function CommentBox({ comment, onContinue, continueLabel = 'Continuer →' }: CommentBoxProps) {
  return (
    <div style={{
      background: '#0f1827',
      border: '1px solid #1e3a5f',
      borderRadius: 12,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 800, letterSpacing: '0.08em' }}>
          🧠 ANALYSE GTO
        </span>
      </div>
      <p style={{ fontSize: '0.88rem', color: '#c8d6f0', lineHeight: 1.65, margin: 0 }}>{comment}</p>

      <button
        onClick={onContinue}
        style={{
          padding: '9px 20px',
          background: '#1d3557',
          border: '1px solid #3b82f6',
          borderRadius: 8,
          color: '#93c5fd',
          fontSize: '0.88rem',
          fontWeight: 700,
          cursor: 'pointer',
          alignSelf: 'flex-end',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e4080')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1d3557')}
      >
        {continueLabel}
      </button>
    </div>
  );
}
