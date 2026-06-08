import { useState } from 'react';
import { loadREStats, saveREStats, diagByPosition, diagByStack, diagByScenarioType, diagWorstHands } from '../engine/reStats';
import { loadREState } from '../engine/rangeEditorBridge';

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: '0.7rem', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="section-label">{title}</p>
      {children}
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState(loadREStats);
  const reState = loadREState();
  const ranges = reState?.ranges ?? [];

  const globalPct = stats.totalAttempts > 0
    ? Math.round(stats.totalCorrect / stats.totalAttempts * 100)
    : null;

  const byPos   = diagByPosition(stats, ranges);
  const byStack = diagByStack(stats, ranges);
  const byType  = diagByScenarioType(stats, ranges);
  const byHand  = diagWorstHands(stats, ranges.map(r => r.id));

  function handleReset() {
    if (!confirm('Supprimer toutes les statistiques ? Cette action est irréversible.')) return;
    const empty = { data: {}, totalAttempts: 0, totalCorrect: 0 };
    saveREStats(empty);
    setStats(empty);
  }

  if (stats.totalAttempts === 0) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ fontSize: 38 }}>📊</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 12, lineHeight: 1.6 }}>
          Aucune statistique pour l'instant.
          <br />Lancez une session d'entraînement pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Global */}
      <Section title="Bilan global">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            ['Mains',     stats.totalAttempts.toString()],
            ['Correctes', stats.totalCorrect.toString()],
            ['Taux',      globalPct !== null ? `${globalPct}%` : '—'],
          ].map(([label, val]) => (
            <div key={label} className="panel" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>{val}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* By position */}
      {byPos.length > 0 && (
        <Section title="Par position">
          <div className="panel space-y-3">
            {byPos.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{s.label}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.attempts} mains</span>
                </div>
                <PctBar pct={s.pct} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* By stack */}
      {byStack.length > 0 && (
        <Section title="Par profondeur de tapis">
          <div className="panel space-y-3">
            {byStack.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{s.label}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.attempts} mains</span>
                </div>
                <PctBar pct={s.pct} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Open vs facing */}
      {byType.length > 0 && (
        <Section title="Open vs Facing action">
          <div className="panel space-y-3">
            {byType.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{s.label}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.attempts} mains</span>
                </div>
                <PctBar pct={s.pct} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Worst hands */}
      {byHand.length > 0 && (
        <Section title="Mains les plus souvent ratées">
          <div className="panel">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
              {byHand.map(h => (
                <div key={h.handKey}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>{h.handKey}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.attempts}×</span>
                  </div>
                  <PctBar pct={h.pct} />
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Reset */}
      <button className="btn btn-danger" onClick={handleReset}>
        Réinitialiser les statistiques
      </button>

    </div>
  );
}
