import { useState, useMemo } from 'react';
import RangeGrid from '../components/RangeGrid';
import ContextSelector from '../components/ContextSelector';
import type { Action, HandActions, RangeContext, AppStats } from '../engine/types';
import { ACTIONS, ACTION_LABELS, ACTION_COLORS } from '../engine/types';
import { contextKey, contextLabel, needsVillain, validVillains } from '../engine/context';
import {
  pickHandKey, getActions, recordAttempt, handKeyToCards,
  contextHandStats,
} from '../engine/smartTrainer';

// ── Hand card display ──────────────────────────────────────────────────────────

function HandCard({ rank, symbol, isRed }: { rank: string; symbol: string; isRed: boolean }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        width: 64,
        height: 88,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ fontSize: 26, fontWeight: 800, color: isRed ? '#dc2626' : '#0f172a', lineHeight: 1 }}>
        {rank}
      </span>
      <span style={{ fontSize: 22, color: isRed ? '#dc2626' : '#0f172a', lineHeight: 1 }}>
        {symbol}
      </span>
    </div>
  );
}

// ── Phase types ────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'training' | 'feedback';

interface SessionState {
  handKey:   string;
  cards:     ReturnType<typeof handKeyToCards>;
  attempts:  number;
  correct:   number;
}

// ── Focus leak config ──────────────────────────────────────────────────────────

const MIN_HANDS_FOR_GOAL = 20;

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ctx:        RangeContext;
  onCtxChange:(ctx: RangeContext) => void;
  ranges:     Record<string, HandActions>;
  stats:      AppStats;
  onStats:    (s: AppStats) => void;
}

export default function TrainerPage({ ctx, onCtxChange, ranges, stats, onStats }: Props) {
  const [phase, setPhase]           = useState<Phase>('setup');
  const [session, setSession]       = useState<SessionState | null>(null);
  const [userAnswer, setUserAnswer] = useState<Action | null>(null);
  const [focusMode, setFocusMode]   = useState(false);
  const [targetPct, setTargetPct]   = useState(85);

  const ctxKey  = contextKey(ctx);
  const hands   = ranges[ctxKey];
  const hasRange = !!hands && Object.keys(hands).length > 0;

  // Validate villain if needed
  const reqVillain = needsVillain(ctx.scenario);
  const villains   = validVillains(ctx);
  const villainOk  = !reqVillain || (villains.length > 0 && !!ctx.villainPosition);

  // Context stats for smart selection
  const ctxStats = useMemo(
    () => contextHandStats(stats, ctxKey),
    [stats, ctxKey],
  );

  // Session success rate
  const sessionPct = session && session.attempts > 0
    ? Math.round(session.correct / session.attempts * 100)
    : null;

  const goalReached = focusMode
    && session !== null
    && session.attempts >= MIN_HANDS_FOR_GOAL
    && sessionPct !== null
    && sessionPct >= targetPct;

  function startTraining() {
    if (!hasRange || !villainOk) return;
    const hk    = pickHandKey(ctxStats);
    const cards = handKeyToCards(hk);
    setSession({ handKey: hk, cards, attempts: 0, correct: 0 });
    setUserAnswer(null);
    setPhase('training');
  }

  function handleAnswer(answer: Action) {
    if (!session || !hands) return;
    const validActions = getActions(hands, session.handKey);
    const correct      = validActions.includes(answer);
    const newStats     = recordAttempt(stats, ctxKey, session.handKey, correct);
    onStats(newStats);
    setUserAnswer(answer);
    setSession(prev => prev ? {
      ...prev,
      attempts: prev.attempts + 1,
      correct:  prev.correct + (correct ? 1 : 0),
    } : null);
    setPhase('feedback');
  }

  function nextHand() {
    if (!hands) return;
    const updatedCtxStats = contextHandStats(stats, ctxKey);
    const hk    = pickHandKey(updatedCtxStats);
    const cards = handKeyToCards(hk);
    setSession(prev => prev ? { ...prev, handKey: hk, cards } : null);
    setUserAnswer(null);
    setPhase('training');
  }

  function endSession() {
    setPhase('setup');
    setSession(null);
    setUserAnswer(null);
  }

  // ── Render: setup ────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="space-y-4">
        {/* Context selector */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ContextSelector ctx={ctx} onChange={onCtxChange} />
        </div>

        {/* Focus leak toggle */}
        <div
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Mode Focus Leak</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>
              Travailler un contexte jusqu'à atteindre un objectif
            </div>
          </div>
          <button
            onClick={() => setFocusMode(f => !f)}
            style={{
              background: focusMode ? '#7c3aed' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid ' + (focusMode ? '#7c3aed' : 'rgba(255,255,255,0.15)'),
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {focusMode ? 'Activé' : 'Désactivé'}
          </button>
        </div>

        {focusMode && (
          <div className="flex items-center gap-3">
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Objectif :</span>
            {[70, 75, 80, 85, 90, 95].map(v => (
              <button
                key={v}
                onClick={() => setTargetPct(v)}
                style={{
                  background:  targetPct === v ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                  color:       '#fff',
                  border:      `1px solid ${targetPct === v ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 6,
                  padding:     '3px 9px',
                  fontSize:    12,
                  cursor:      'pointer',
                }}
              >
                {v}%
              </button>
            ))}
          </div>
        )}

        {/* Errors */}
        {!hasRange && (
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p style={{ color: '#f87171', fontSize: 13 }}>
              Aucune range définie pour ce contexte.
              <br />Créez-la dans l'onglet Édition.
            </p>
          </div>
        )}

        {hasRange && !villainOk && (
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p style={{ color: '#f87171', fontSize: 13 }}>
              Sélectionnez la position de l'ouvreur pour continuer.
            </p>
          </div>
        )}

        <button
          onClick={startTraining}
          disabled={!hasRange || !villainOk}
          style={{
            width: '100%',
            background: hasRange && villainOk ? '#16a34a' : 'rgba(22,163,74,0.2)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px',
            fontSize: 15,
            fontWeight: 700,
            cursor: hasRange && villainOk ? 'pointer' : 'not-allowed',
            opacity: hasRange && villainOk ? 1 : 0.5,
          }}
        >
          {focusMode ? `Lancer le focus (objectif ${targetPct}%)` : 'Commencer l\'entraînement'}
        </button>
      </div>
    );
  }

  // ── Render: training ─────────────────────────────────────────────────────────

  if (phase === 'training' && session) {
    const [c1, c2] = session.cards;
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div style={{ color: '#64748b', fontSize: 12 }}>{contextLabel(ctx)}</div>
          <button onClick={endSession} style={{ color: '#64748b', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
            Quitter
          </button>
        </div>

        {/* Session score */}
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg px-3 py-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{session.correct}</span>
            <span style={{ color: '#64748b' }}>/{session.attempts} </span>
            {sessionPct !== null && (
              <span style={{ color: sessionPct >= 80 ? '#22c55e' : sessionPct >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                {sessionPct}%
              </span>
            )}
          </div>
          {focusMode && (
            <div style={{ color: '#7c3aed', fontSize: 11 }}>
              Objectif : {targetPct}% sur ≥{MIN_HANDS_FOR_GOAL} mains
            </div>
          )}
        </div>

        {/* Goal reached banner */}
        {goalReached && (
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid #7c3aed' }}
          >
            <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 700 }}>
              🎯 Objectif atteint ! {sessionPct}% sur {session.attempts} mains.
            </div>
            <div style={{ color: '#7c3aed', fontSize: 11 }}>Continuez pour consolider.</div>
          </div>
        )}

        {/* Hand display */}
        <div className="flex justify-center gap-4 py-4">
          <HandCard {...c1} />
          <HandCard {...c2} />
        </div>
        <div className="text-center" style={{ color: '#94a3b8', fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{session.handKey}</span>
          {' — '}
          {session.handKey.length === 2 ? 'Paire' : session.handKey[2] === 's' ? 'Suited' : 'Offsuit'}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

        {/* Action buttons */}
        <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>Quelle est l'action correcte ?</div>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map(a => {
            const col = ACTION_COLORS[a];
            return (
              <button
                key={a}
                onClick={() => handleAnswer(a)}
                style={{
                  background:   col.bg,
                  color:        '#fff',
                  border:       'none',
                  borderRadius: 10,
                  padding:      '11px',
                  fontSize:     14,
                  fontWeight:   700,
                  cursor:       'pointer',
                  transition:   'opacity 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {ACTION_LABELS[a]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render: feedback ─────────────────────────────────────────────────────────

  if (phase === 'feedback' && session && hands) {
    const validActions  = getActions(hands, session.handKey);
    const isCorrect     = userAnswer !== null && validActions.includes(userAnswer);
    const [c1, c2]      = session.cards;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div style={{ color: '#64748b', fontSize: 12 }}>{contextLabel(ctx)}</div>
          <button onClick={endSession} style={{ color: '#64748b', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
            Quitter
          </button>
        </div>

        {/* Result banner */}
        <div
          className="rounded-xl p-4"
          style={{
            background: isCorrect ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
            border:     `1px solid ${isCorrect ? '#16a34a' : '#ef4444'}`,
          }}
        >
          <div style={{ color: isCorrect ? '#22c55e' : '#f87171', fontSize: 16, fontWeight: 800 }}>
            {isCorrect ? '✓ Correct !' : '✗ Incorrect'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            {!isCorrect && userAnswer && (
              <>
                Votre réponse :{' '}
                <span style={{ color: ACTION_COLORS[userAnswer].bg, fontWeight: 700 }}>
                  {ACTION_LABELS[userAnswer]}
                </span>
                {'  ·  '}
              </>
            )}
            Réponse{validActions.length > 1 ? 's' : ''} valide{validActions.length > 1 ? 's' : ''} :{' '}
            {validActions.map((a, i) => (
              <span key={a}>
                {i > 0 && <span style={{ color: '#475569' }}> ou </span>}
                <span style={{ color: ACTION_COLORS[a].bg, fontWeight: 700 }}>
                  {ACTION_LABELS[a]}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Hand recap */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <HandCard {...c1} />
            <HandCard {...c2} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{session.handKey}</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>
              {session.handKey.length === 2 ? 'Paire' : session.handKey[2] === 's' ? 'Suited' : 'Offsuit'}
            </div>
          </div>
        </div>

        {/* Full range grid */}
        <div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>Range complète du contexte</div>
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <RangeGrid hands={hands} mode="view" highlightKey={session.handKey} />
          </div>
        </div>

        {/* Score */}
        <div
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Session</span>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>
            {session.correct}/{session.attempts}
            {sessionPct !== null && ` = ${sessionPct}%`}
          </span>
        </div>

        {/* Next button */}
        <button
          onClick={nextHand}
          style={{
            width:        '100%',
            background:   '#16a34a',
            color:        '#fff',
            border:       'none',
            borderRadius: 12,
            padding:      '13px',
            fontSize:     15,
            fontWeight:   700,
            cursor:       'pointer',
          }}
        >
          Main suivante →
        </button>
      </div>
    );
  }

  return null;
}
