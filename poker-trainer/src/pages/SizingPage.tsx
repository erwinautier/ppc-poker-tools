import { useState, useMemo } from 'react';
import type { AppStats, HandStats } from '../engine/types';
import {
  STREETS, REL_POSITIONS, POSTFLOP_SCENARIOS, SIZING_TEXTURES,
  SIZING_OPTIONS, SIZING_LABELS, SIZING_COLORS, STREET_LABELS,
  POSTFLOP_SCENARIO_LABELS, SIZING_TEXTURE_LABELS,
  sizingCtxKey, sizingCtxLabel, sizingStatKey, generateBoard,
} from '../engine/sizing';
import type { SizingContext, SizingOption, SizingRules, BoardCard } from '../engine/sizing';
import { recordAttempt } from '../engine/smartTrainer';

// ── Sub-page type ──────────────────────────────────────────────────────────────

type SubPage = 'rules' | 'train';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Chip({
  label, active, onClick, color,
}: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? (color ?? '#16a34a') : 'rgba(255,255,255,0.06)',
        color:        '#fff',
        border:       `1px solid ${active ? (color ?? '#16a34a') : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 6,
        padding:      '3px 10px',
        fontSize:     11,
        fontWeight:   600,
        cursor:       'pointer',
        whiteSpace:   'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#64748b', fontSize: 11, marginBottom: 5 }}>{children}</div>;
}

// ── Context selector for sizing ────────────────────────────────────────────────

function SizingContextSelector({
  ctx,
  onChange,
}: {
  ctx: SizingContext;
  onChange: (c: SizingContext) => void;
}) {
  function set<K extends keyof SizingContext>(k: K, v: SizingContext[K]) {
    onChange({ ...ctx, [k]: v });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Street</Label>
        <div className="flex flex-wrap gap-1">
          {STREETS.map(s => (
            <Chip key={s} label={STREET_LABELS[s]} active={ctx.street === s}
              onClick={() => set('street', s)} color="#16a34a" />
          ))}
        </div>
      </div>

      <div>
        <Label>Position</Label>
        <div className="flex flex-wrap gap-1">
          {REL_POSITIONS.map(p => (
            <Chip key={p} label={p.toUpperCase()} active={ctx.position === p}
              onClick={() => set('position', p)} color="#3b82f6" />
          ))}
        </div>
      </div>

      <div>
        <Label>Scénario</Label>
        <div className="flex flex-wrap gap-1">
          {POSTFLOP_SCENARIOS.map(s => (
            <Chip key={s} label={POSTFLOP_SCENARIO_LABELS[s]} active={ctx.scenario === s}
              onClick={() => set('scenario', s)} color="#7c3aed" />
          ))}
        </div>
      </div>

      <div>
        <Label>Texture du board</Label>
        <div className="flex flex-wrap gap-1">
          {SIZING_TEXTURES.map(t => (
            <Chip key={t} label={SIZING_TEXTURE_LABELS[t]} active={ctx.texture === t}
              onClick={() => set('texture', t)} color="#f59e0b" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sizing multi-select palette ────────────────────────────────────────────────

function SizingPalette({
  selected,
  onToggle,
}: {
  selected: SizingOption[];
  onToggle: (s: SizingOption) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SIZING_OPTIONS.map(s => {
        const col   = SIZING_COLORS[s];
        const isOn  = selected.includes(s);
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            style={{
              background:   isOn ? col.bg : col.inactive,
              color:        isOn ? col.text : '#94a3b8',
              border:       `2px solid ${isOn ? col.bg : 'transparent'}`,
              borderRadius: 6,
              padding:      '5px 12px',
              fontSize:     12,
              fontWeight:   700,
              cursor:       'pointer',
              boxShadow:    isOn ? `0 0 8px ${col.bg}55` : 'none',
              transition:   'all 0.1s',
            }}
          >
            {SIZING_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

// ── Board display ──────────────────────────────────────────────────────────────

function BoardDisplay({ cards }: { cards: BoardCard[] }) {
  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            background:    '#fff',
            borderRadius:  8,
            width:         48,
            height:        64,
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            justifyContent:'center',
            boxShadow:     '0 3px 10px rgba(0,0,0,0.35)',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 800, color: c.isRed ? '#dc2626' : '#0f172a', lineHeight: 1 }}>
            {c.rank}
          </span>
          <span style={{ fontSize: 16, color: c.isRed ? '#dc2626' : '#0f172a', lineHeight: 1 }}>
            {c.symbol}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Rules editor page ──────────────────────────────────────────────────────────

function RulesEditor({
  rules,
  onSave,
  onDelete,
}: {
  rules:    SizingRules;
  onSave:   (key: string, sizings: SizingOption[]) => void;
  onDelete: (key: string) => void;
}) {
  const [ctx, setCtx] = useState<SizingContext>({
    street:   'flop',
    position: 'ip',
    scenario: 'cbet',
    texture:  'dry',
  });
  const [selected, setSelected] = useState<SizingOption[]>([]);
  const [saveMsg,  setSaveMsg]  = useState('');

  const key     = sizingCtxKey(ctx);
  const existing = rules[key] ?? [];

  // Sync palette when context changes
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setSelected(existing);
    setPrevKey(key);
  }

  function toggleSizing(s: SizingOption) {
    setSelected(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
    );
    setSaveMsg('');
  }

  function handleSave() {
    if (selected.length === 0) {
      onDelete(key);
      setSaveMsg('Règle supprimée (aucun sizing sélectionné)');
    } else {
      onSave(key, selected);
      setSaveMsg('✓ Règle sauvegardée');
    }
    setTimeout(() => setSaveMsg(''), 2000);
  }

  const rulesCount = Object.keys(rules).length;

  return (
    <div className="space-y-4">
      {/* Context picker */}
      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SizingContextSelector ctx={ctx} onChange={c => { setCtx(c); setSelected(rules[sizingCtxKey(c)] ?? []); }} />
      </div>

      {/* Context label */}
      <div className="flex items-center justify-between">
        <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{sizingCtxLabel(ctx)}</h2>
        {saveMsg && <span style={{ color: '#22c55e', fontSize: 11 }}>{saveMsg}</span>}
      </div>

      {/* Sizing multi-select */}
      <div>
        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>
          Sizings valides pour ce contexte (plusieurs = toutes acceptées)
        </div>
        <SizingPalette selected={selected} onToggle={toggleSizing} />
      </div>

      {/* Sample board preview */}
      <div
        className="rounded-xl p-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div style={{ color: '#475569', fontSize: 11, marginBottom: 8 }}>
          Exemple de board correspondant à la texture
        </div>
        <BoardDisplay cards={generateBoard(ctx.texture, ctx.street)} />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        style={{
          background:   selected.length > 0 ? '#16a34a' : 'rgba(239,68,68,0.1)',
          color:        '#fff',
          border:       'none',
          borderRadius: 8,
          padding:      '8px 18px',
          fontSize:     13,
          fontWeight:   700,
          cursor:       'pointer',
        }}
      >
        {selected.length > 0 ? 'Sauvegarder la règle' : 'Supprimer la règle'}
      </button>

      {/* All rules list */}
      {rulesCount > 0 && (
        <div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>
            Règles définies ({rulesCount})
          </div>
          <div className="space-y-1.5">
            {Object.entries(rules).map(([k, sizings]) => (
              <div
                key={k}
                className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
                    {k.split('|').map((part, i) => {
                      const labels = [
                        STREET_LABELS,
                        { ip: 'IP', oop: 'OOP' },
                        POSTFLOP_SCENARIO_LABELS,
                        SIZING_TEXTURE_LABELS,
                      ];
                      const map = labels[i] as Record<string, string>;
                      return (i > 0 ? ' · ' : '') + (map?.[part] ?? part);
                    })}
                  </div>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {sizings.map(s => (
                      <span
                        key={s}
                        style={{
                          background:   SIZING_COLORS[s].bg,
                          color:        SIZING_COLORS[s].text,
                          borderRadius: 4,
                          padding:      '1px 6px',
                          fontSize:     10,
                          fontWeight:   700,
                        }}
                      >
                        {SIZING_LABELS[s]}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(k)}
                  style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rulesCount === 0 && (
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          <p style={{ color: '#475569', fontSize: 13 }}>
            Aucune règle définie — sélectionnez un contexte et des sizings, puis sauvegardez.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Smart sizing trainer ───────────────────────────────────────────────────────

function getWeight(hs: HandStats | undefined): number {
  if (!hs || hs.attempts === 0) return 2.5;
  const err = 1 - hs.correct / hs.attempts;
  let w = 1 + err * 3;
  if (hs.streak >= 5)      w *= 0.2;
  else if (hs.streak >= 3) w *= 0.45;
  else if (hs.streak >= 1) w *= 0.75;
  return Math.max(w, 0.05);
}

function pickSizingCtx(
  rules:      SizingRules,
  statsData:  AppStats['data'],
): SizingContext | null {
  const keys = Object.keys(rules);
  if (keys.length === 0) return null;

  const weights = keys.map(k => getWeight(statsData[sizingStatKey(k)]));
  const total   = weights.reduce((a, b) => a + b, 0);
  let rand      = Math.random() * total;

  for (let i = 0; i < keys.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      const [street, position, scenario, texture] = keys[i].split('|');
      return { street, position, scenario, texture } as SizingContext;
    }
  }

  const [street, position, scenario, texture] = keys[keys.length - 1].split('|');
  return { street, position, scenario, texture } as SizingContext;
}

// ── Trainer ────────────────────────────────────────────────────────────────────

type TrainPhase = 'setup' | 'question' | 'feedback';

function SizingTrainer({
  rules,
  stats,
  onStats,
}: {
  rules:   SizingRules;
  stats:   AppStats;
  onStats: (s: AppStats) => void;
}) {
  const [phase,       setPhase]     = useState<TrainPhase>('setup');
  const [ctx,         setCtx]       = useState<SizingContext | null>(null);
  const [board,       setBoard]     = useState<BoardCard[]>([]);
  const [answer,      setAnswer]    = useState<SizingOption | null>(null);
  const [sessionAtt,  setSessAtt]   = useState(0);
  const [sessionCor,  setSessCor]   = useState(0);

  const hasRules = Object.keys(rules).length > 0;

  function startNext(fromStats = stats) {
    const picked = pickSizingCtx(rules, fromStats.data);
    if (!picked) return;
    setCtx(picked);
    setBoard(generateBoard(picked.texture, picked.street));
    setAnswer(null);
    setPhase('question');
  }

  function handleAnswer(s: SizingOption) {
    if (!ctx) return;
    const key         = sizingCtxKey(ctx);
    const validSizings = rules[key] ?? [];
    const correct      = validSizings.includes(s);
    const newStats     = recordAttempt(stats, `sizing::${key}`, 'sizing', correct);
    onStats(newStats);
    setAnswer(s);
    setSessAtt(a => a + 1);
    if (correct) setSessCor(c => c + 1);
    setPhase('feedback');
  }

  const sessionPct = sessionAtt > 0 ? Math.round(sessionCor / sessionAtt * 100) : null;

  if (phase === 'setup') {
    return (
      <div className="space-y-4">
        {!hasRules && (
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p style={{ color: '#f87171', fontSize: 13 }}>
              Aucune règle de sizing définie.
              <br />Créez-en dans l'onglet Règles.
            </p>
          </div>
        )}
        <button
          onClick={() => startNext()}
          disabled={!hasRules}
          style={{
            width:        '100%',
            background:   hasRules ? '#16a34a' : 'rgba(22,163,74,0.2)',
            color:        '#fff',
            border:       'none',
            borderRadius: 12,
            padding:      '14px',
            fontSize:     15,
            fontWeight:   700,
            cursor:       hasRules ? 'pointer' : 'not-allowed',
            opacity:      hasRules ? 1 : 0.5,
          }}
        >
          Commencer l'entraînement sizing
        </button>
      </div>
    );
  }

  if (phase === 'question' && ctx) {
    const label = sizingCtxLabel(ctx);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
          <button onClick={() => setPhase('setup')} style={{ color: '#64748b', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
            Quitter
          </button>
        </div>

        {sessionAtt > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="rounded-lg px-3 py-1"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{sessionCor}</span>
              <span style={{ color: '#64748b' }}>/{sessionAtt} </span>
              {sessionPct !== null && (
                <span style={{ color: sessionPct >= 80 ? '#22c55e' : sessionPct >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                  {sessionPct}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Board */}
        <div className="py-3">
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
            {STREET_LABELS[ctx.street]}
          </div>
          <BoardDisplay cards={board} />
        </div>

        {/* Context info */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [STREET_LABELS[ctx.street],                        '🃏'],
              [ctx.position.toUpperCase(),                       ctx.position === 'ip' ? '✅' : '⬅️'],
              [POSTFLOP_SCENARIO_LABELS[ctx.scenario],           '🎯'],
            ].map(([label, icon]) => (
              <div key={label}>
                <div style={{ fontSize: 18 }}>{icon}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>
          Quelle taille de mise choisissez-vous ?
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SIZING_OPTIONS.map(s => {
            const col = SIZING_COLORS[s];
            return (
              <button
                key={s}
                onClick={() => handleAnswer(s)}
                style={{
                  background:   col.bg,
                  color:        col.text,
                  border:       'none',
                  borderRadius: 10,
                  padding:      '11px',
                  fontSize:     14,
                  fontWeight:   700,
                  cursor:       'pointer',
                }}
              >
                {SIZING_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === 'feedback' && ctx && answer) {
    const key          = sizingCtxKey(ctx);
    const validSizings = rules[key] ?? [];
    const isCorrect    = validSizings.includes(answer);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div style={{ color: '#64748b', fontSize: 12 }}>{sizingCtxLabel(ctx)}</div>
          <button onClick={() => setPhase('setup')} style={{ color: '#64748b', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
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
            {!isCorrect && (
              <>
                Votre réponse :{' '}
                <span style={{ color: SIZING_COLORS[answer].bg, fontWeight: 700 }}>
                  {SIZING_LABELS[answer]}
                </span>
                {'  ·  '}
              </>
            )}
            Sizing{validSizings.length > 1 ? 's' : ''} valide{validSizings.length > 1 ? 's' : ''} :{' '}
            {validSizings.map((s, i) => (
              <span key={s}>
                {i > 0 && <span style={{ color: '#475569' }}> ou </span>}
                <span style={{ color: SIZING_COLORS[s].bg, fontWeight: 700 }}>{SIZING_LABELS[s]}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Board recap */}
        <BoardDisplay cards={board} />

        {/* Session score */}
        <div
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Session sizing</span>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>
            {sessionCor}/{sessionAtt}{sessionPct !== null && ` = ${sessionPct}%`}
          </span>
        </div>

        <button
          onClick={() => startNext(stats)}
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

// ── Main SizingPage ────────────────────────────────────────────────────────────

interface Props {
  rules:    SizingRules;
  stats:    AppStats;
  onStats:  (s: AppStats) => void;
  onSave:   (key: string, sizings: SizingOption[]) => void;
  onDelete: (key: string) => void;
}

export default function SizingPage({ rules, stats, onStats, onSave, onDelete }: Props) {
  const [sub, setSub] = useState<SubPage>('rules');
  const rulesCount = useMemo(() => Object.keys(rules).length, [rules]);

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div
        className="flex rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {([
          { id: 'rules' as SubPage, label: '📋 Règles' },
          { id: 'train' as SubPage, label: '🎯 Entraîner' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            style={{
              flex:       1,
              padding:    '9px',
              fontSize:   13,
              fontWeight: 700,
              background: sub === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color:      sub === t.id ? '#e2e8f0' : '#64748b',
              border:     'none',
              cursor:     'pointer',
            }}
          >
            {t.label}
            {t.id === 'rules' && rulesCount > 0 && (
              <span
                style={{
                  background:   '#16a34a',
                  color:        '#fff',
                  borderRadius: 10,
                  padding:      '1px 6px',
                  fontSize:     10,
                  marginLeft:   6,
                }}
              >
                {rulesCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {sub === 'rules' && (
        <RulesEditor rules={rules} onSave={onSave} onDelete={onDelete} />
      )}

      {sub === 'train' && (
        <SizingTrainer rules={rules} stats={stats} onStats={onStats} />
      )}
    </div>
  );
}
