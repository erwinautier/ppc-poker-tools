import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadREState, importREStateFromJSON,
  handInRange, handColors, scenarioDescription,
  type REState, type RERange,
} from '../engine/rangeEditorBridge';
import {
  loadREStats, saveREStats, recordREAttempt, getRangeStats,
  diagByPosition, diagByStack, diagByScenarioType, diagWorstHands,
  type REStats,
} from '../engine/reStats';
import { pickHandForRange, type ProximityMode } from '../engine/reHandPicker';
import { handKeyToCards } from '../engine/smartTrainer';
import { useSyncContext } from '../lib/SyncContext';
import PokerTableView from '../components/PokerTableView';

// ── Proximity config ──────────────────────────────────────────────────────────

const PROXIMITY_OPTIONS: { value: ProximityMode; label: string; desc: string }[] = [
  { value: 'range',  label: 'Dans la range',    desc: 'Uniquement les mains définies dans la range' },
  { value: 'close',  label: '±1 case',           desc: 'Range + mains immédiatement adjacentes' },
  { value: 'medium', label: '±3 cases',          desc: 'Range + mains proches — réglage par défaut' },
  { value: 'full',   label: 'Toute la matrice',  desc: 'Les 169 mains, weighting léger vers la range' },
];

function loadProximity(): ProximityMode {
  return (localStorage.getItem('re-proximity') as ProximityMode) ?? 'medium';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function HandCard({ rank, symbol, isRed }: { rank: string; symbol: string; isRed: boolean }) {
  const color = isRed ? '#ef4444' : '#0f172a';
  return (
    <div style={{
      background: '#fff', borderRadius: 10, width: 62, height: 84,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: 22, color, lineHeight: 1 }}>{symbol}</span>
    </div>
  );
}

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

// ── Mini range matrix ─────────────────────────────────────────────────────────

const RANKS_ORDER = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

function MiniMatrix({ range, highlightKey }: { range: RERange; highlightKey: string }) {
  const cell = 17;
  const size = 13;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={size * cell} height={size * cell} style={{ display: 'block' }}>
        {RANKS_ORDER.map((r1, row) =>
          RANKS_ORDER.map((r2, col) => {
            let key: string;
            if (row === col) key = r1 + r1;
            else if (row < col) key = r1 + r2 + 's';
            else key = r2 + r1 + 'o';

            const assignment = range.hands[key] ?? {};
            const totalFreq = Math.min(100, Object.values(assignment).reduce((a, b) => a + b, 0));
            const isHL = key === highlightKey;

            let fill = 'rgba(255,255,255,0.04)';
            if (totalFreq > 0) {
              const best = Object.entries(assignment).sort((a, b) => b[1] - a[1])[0];
              const color = range.palette.find(p => p.id === best[0]);
              if (color) fill = color.hex + (totalFreq < 100 ? '99' : 'ff');
              else fill = '#334155';
            }

            return (
              <rect
                key={key}
                x={col * cell} y={row * cell}
                width={cell - 1} height={cell - 1}
                fill={fill}
                stroke={isHL ? '#f59e0b' : 'none'}
                strokeWidth={isHL ? 2 : 0}
                rx={1}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ── Diagnostic ────────────────────────────────────────────────────────────────

function DiagRow({ label, attempts, pct }: { label: string; attempts: number; pct: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{attempts} mains</span>
      </div>
      <PctBar pct={pct} />
    </div>
  );
}

function DiagSection({ title, rows }: { title: string; rows: { label: string; attempts: number; pct: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="section-label">{title}</p>
      <div className="panel space-y-3">
        {rows.map(r => <DiagRow key={r.label} {...r} />)}
      </div>
    </div>
  );
}

function DiagnosticView({ stats, ranges, rangeIds }: { stats: REStats; ranges: RERange[]; rangeIds: string[] }) {
  const activeRanges = ranges.filter(r => rangeIds.includes(r.id));
  const byPos   = diagByPosition(stats, activeRanges);
  const byStack = diagByStack(stats, activeRanges);
  const byType  = diagByScenarioType(stats, activeRanges);
  const byHand  = diagWorstHands(stats, rangeIds);

  const totalAttempts = rangeIds.reduce((acc, id) => {
    const prefix = `re::${id}::`;
    return acc + Object.entries(stats.data)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((s, [, hs]) => s + hs.attempts, 0);
  }, 0);

  if (totalAttempts < 10) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 36 }}>📊</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 10, lineHeight: 1.6 }}>
          Jouez au moins 10 mains pour voir le diagnostic.
          <br /><span style={{ color: 'var(--border)' }}>{totalAttempts} main{totalAttempts !== 1 ? 's' : ''} jouée{totalAttempts !== 1 ? 's' : ''} pour l'instant.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DiagSection title="Par position" rows={byPos} />
      <DiagSection title="Par stack" rows={byStack} />
      <DiagSection title="Open vs Facing action" rows={byType} />
      {byHand.length > 0 && (
        <div>
          <p className="section-label">Mains les plus ratées</p>
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
        </div>
      )}
    </div>
  );
}

// ── Source step ───────────────────────────────────────────────────────────────

function SourceStep({ onLoaded }: { onLoaded: (s: REState) => void }) {
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tryAuto = useCallback(() => {
    const s = loadREState();
    if (s && s.ranges.length > 0) { onLoaded(s); return; }
    setError('Aucune range trouvée dans ce navigateur. Importez un fichier JSON depuis le Range Editor, ou rendez-vous dans l\'onglet Données.');
  }, [onLoaded]);

  useEffect(() => { tryAuto(); }, [tryAuto]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onLoaded(await importREStateFromJSON(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  return (
    <div className="space-y-3">
      <div className="panel" style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 36 }}>📁</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 10, lineHeight: 1.6 }}>
          {error ?? 'Chargement des ranges…'}
        </p>
      </div>
      {error && (
        <>
          <button className="btn btn-primary btn-full" onClick={() => fileRef.current?.click()}>
            Importer un fichier JSON
          </button>
          <button className="btn btn-full" onClick={tryAuto}>
            Réessayer (localStorage)
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
        </>
      )}
    </div>
  );
}

// ── Scenario / proximity selection ────────────────────────────────────────────

/** Sorted unique values from an array */
function uniq<T>(arr: T[], sort?: (a: T, b: T) => number): T[] {
  return [...new Set(arr)].sort(sort);
}

function SelectStep({
  state, proximity, onProximityChange, onStart,
}: {
  state: REState;
  proximity: ProximityMode;
  onProximityChange: (m: ProximityMode) => void;
  onStart: (ids: string[]) => void;
}) {
  // ── Scenario check state ──────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(() => new Set(state.ranges.map(r => r.id)));
  const [viewMode, setViewMode] = useState<'col' | 'all'>(state.collections.length > 0 ? 'col' : 'all');

  // ── Position / stack filters ──────────────────────────────────────────────
  const allPositions = uniq(state.ranges.map(r => r.position));
  const allStacks    = uniq(state.ranges.map(r => r.stackBB), (a, b) => a - b);
  const [filterPos,   setFilterPos]   = useState<Set<string>>(() => new Set()); // empty = all
  const [filterStack, setFilterStack] = useState<Set<number>>(() => new Set()); // empty = all

  function togglePos(pos: string) {
    setFilterPos(prev => { const n = new Set(prev); n.has(pos) ? n.delete(pos) : n.add(pos); return n; });
  }
  function toggleStack(s: number) {
    setFilterStack(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  // ── Derived: ranges visible after filters ─────────────────────────────────
  const byId = Object.fromEntries(state.ranges.map(r => [r.id, r]));

  const visibleRanges = state.ranges.filter(r =>
    (filterPos.size   === 0 || filterPos.has(r.position)) &&
    (filterStack.size === 0 || filterStack.has(r.stackBB))
  );
  const visibleIds = new Set(visibleRanges.map(r => r.id));

  // Effective selection = checked ∩ visible
  const effectiveIds = [...selected].filter(id => visibleIds.has(id));
  const effectiveRanges = effectiveIds.map(id => byId[id]).filter(Boolean);

  // ── Proximity options: hide "Dans la range" if no facing_action in selection ─
  const hasFacingAction = effectiveRanges.some(r => r.rangeType === 'facing_action');
  const proximityOptions = hasFacingAction
    ? PROXIMITY_OPTIONS
    : PROXIMITY_OPTIONS.filter(o => o.value !== 'range');

  // If current proximity is 'range' but no longer available, auto-correct
  const effectiveProximity = (!hasFacingAction && proximity === 'range') ? 'close' : proximity;
  if (effectiveProximity !== proximity) onProximityChange(effectiveProximity);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toggle(id: string) {
    if (!visibleIds.has(id)) return;
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleCol(rangeIds: string[]) {
    const visRanges = rangeIds.filter(id => visibleIds.has(id));
    const allSel = visRanges.every(id => selected.has(id));
    setSelected(prev => { const n = new Set(prev); visRanges.forEach(id => allSel ? n.delete(id) : n.add(id)); return n; });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Position filter ── */}
      {allPositions.length > 1 && (
        <div>
          <p className="section-label">Positions</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`pill${filterPos.size === 0 ? ' active' : ''}`}
              onClick={() => setFilterPos(new Set())}
            >
              Toutes
            </button>
            {allPositions.map(pos => (
              <button
                key={pos}
                className={`pill${filterPos.has(pos) ? ' active' : ''}`}
                onClick={() => togglePos(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stack filter ── */}
      {allStacks.length > 1 && (
        <div>
          <p className="section-label">Stack</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`pill${filterStack.size === 0 ? ' active' : ''}`}
              onClick={() => setFilterStack(new Set())}
            >
              Tous
            </button>
            {allStacks.map(s => (
              <button
                key={s}
                className={`pill${filterStack.has(s) ? ' active' : ''}`}
                onClick={() => toggleStack(s)}
              >
                {s} BB
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Proximity ── */}
      <div>
        <p className="section-label">Proximité des mains interrogées</p>
        <div className="panel-inset space-y-2">
          {proximityOptions.map(opt => {
            const active = effectiveProximity === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onProximityChange(opt.value)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  background: active ? 'rgba(79,126,248,0.12)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(79,126,248,0.4)' : 'transparent'}`,
                  borderRadius: 7, padding: '8px 10px', cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'transparent',
                }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </div>
              </button>
            );
          })}
          {!hasFacingAction && effectiveIds.length > 0 && (
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '2px 10px', lineHeight: 1.4 }}>
              💡 "Dans la range" est disponible uniquement pour les scénarios avec action devant.
            </p>
          )}
        </div>
      </div>

      {/* ── Scenario list ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p className="section-label" style={{ marginBottom: 0 }}>
            Scénarios
            {(filterPos.size > 0 || filterStack.size > 0) && (
              <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
                ({visibleRanges.length}/{state.ranges.length})
              </span>
            )}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.7rem' }}
              onClick={() => setSelected(new Set(visibleRanges.map(r => r.id)))}>Tout</button>
            <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.7rem' }}
              onClick={() => setSelected(new Set())}>Aucune</button>
          </div>
        </div>

        {state.collections.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['col', 'all'] as const).map(v => (
              <button key={v} className={`pill${viewMode === v ? ' active' : ''}`} onClick={() => setViewMode(v)}>
                {v === 'col' ? 'Par collection' : 'Toutes les ranges'}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {viewMode === 'col' && state.collections.length > 0
            ? state.collections.map(col => {
                const colRanges = col.rangeIds.map(id => byId[id]).filter(r => r && visibleIds.has(r.id));
                if (colRanges.length === 0) return null;
                const allSel = colRanges.every(r => selected.has(r.id));
                const someSel = colRanges.some(r => selected.has(r.id));
                return (
                  <div key={col.id}>
                    <button
                      onClick={() => toggleCol(col.rangeIds)}
                      className="range-row"
                      style={{
                        background: allSel ? 'rgba(79,126,248,0.07)' : 'var(--surface)',
                        borderColor: allSel ? 'rgba(79,126,248,0.35)' : someSel ? 'rgba(245,158,11,0.3)' : 'var(--border)',
                      }}
                    >
                      <Checkbox checked={allSel} indeterminate={!allSel && someSel} />
                      <div className="range-info">
                        <div className="range-name">{col.title}</div>
                        {col.description && <div className="range-meta">{col.description}</div>}
                        <div className="range-meta">{colRanges.length} range{colRanges.length !== 1 ? 's' : ''}</div>
                      </div>
                    </button>
                    <div style={{ marginLeft: 12, marginTop: 4, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}
                      className="space-y-1">
                      {colRanges.map(r => (
                        <RangeRow key={r.id} range={r} checked={selected.has(r.id)} onToggle={() => toggle(r.id)} compact />
                      ))}
                    </div>
                  </div>
                );
              })
            : visibleRanges.map(r => (
                <RangeRow key={r.id} range={r} checked={selected.has(r.id)} onToggle={() => toggle(r.id)} />
              ))
          }
          {visibleRanges.length === 0 && (
            <div className="panel" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Aucune range ne correspond aux filtres sélectionnés.
            </div>
          )}
        </div>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={() => onStart(effectiveIds)}
        disabled={effectiveIds.length === 0}
        style={{ padding: '12px', fontSize: '0.9rem' }}
      >
        Commencer ({effectiveIds.length} range{effectiveIds.length !== 1 ? 's' : ''})
      </button>
    </div>
  );
}

function Checkbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `2px solid ${checked || indeterminate ? 'var(--accent)' : 'var(--border)'}`,
      background: checked ? 'var(--accent)' : indeterminate ? 'rgba(79,126,248,0.3)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: '#fff', fontWeight: 700,
    }}>
      {checked ? '✓' : indeterminate ? '–' : ''}
    </span>
  );
}

function RangeRow({ range, checked, onToggle, compact = false }: { range: RERange; checked: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <button onClick={onToggle} className={`range-row${checked ? ' checked' : ''}`} style={{ alignItems: 'flex-start' }}>
      <Checkbox checked={checked} />
      <div className="range-info" style={{ minWidth: 0 }}>
        <div className="range-name" style={{ fontSize: compact ? '0.78rem' : '0.82rem', whiteSpace: 'normal' }}>{range.title}</div>
        <div className="range-meta" style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
          {range.position} · {range.players}-max · {range.stackBB} BB · {range.rangeType === 'open' ? 'Open' : 'Facing action'} · {Object.keys(range.hands).length} mains
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexWrap: 'wrap', marginTop: 2 }}>
        {range.palette.map(p => (
          <span key={p.id} style={{ width: 10, height: 10, borderRadius: 3, background: p.hex, display: 'inline-block' }} title={p.label} />
        ))}
      </div>
    </button>
  );
}

// ── Training session ──────────────────────────────────────────────────────────

type Phase = 'question' | 'feedback';

interface SessionHand {
  range: RERange;
  handKey: string;
  cards: ReturnType<typeof handKeyToCards>;
}

function TrainingSession({
  state, rangeIds, stats, onStats, proximity, onEnd,
}: {
  state: REState;
  rangeIds: string[];
  stats: REStats;
  onStats: (s: REStats) => void;
  proximity: ProximityMode;
  onEnd: () => void;
}) {
  const { scheduleSync } = useSyncContext();
  const ranges = state.ranges.filter(r => rangeIds.includes(r.id));
  const [phase, setPhase]   = useState<Phase>('question');
  const [hand, setHand]     = useState<SessionHand | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect]   = useState(0);

  const pickNext = useCallback(() => {
    if (!ranges.length) return;
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const rStats = getRangeStats(stats, range.id);
    const handKey = pickHandForRange(range, rStats, proximity);
    setHand({ range, handKey, cards: handKeyToCards(handKey) });
    setAnswered(null);
    setPhase('question');
  }, [ranges, stats, proximity]); // eslint-disable-line

  useEffect(() => { pickNext(); }, []); // eslint-disable-line

  if (!hand) return null;

  const { range, handKey, cards } = hand;
  const inRange = handInRange(range, handKey);
  const validColorIds = handColors(range, handKey);

  function handleAnswer(colorId: string) {
    if (phase !== 'question') return;
    const isCorrect = inRange ? validColorIds.includes(colorId) : colorId === 'fold';
    onStats(recordREAttempt(stats, range.id, handKey, isCorrect));
    scheduleSync();
    setAnswered(colorId);
    setAttempts(a => a + 1);
    if (isCorrect) setCorrect(c => c + 1);
    setPhase('feedback');
  }

  const [c1, c2] = cards;
  const sessionPct = attempts > 0 ? Math.round(correct / attempts * 100) : null;
  const isCorrect = answered !== null && (inRange ? validColorIds.includes(answered) : answered === 'fold');

  const handType = handKey.length === 2 ? 'Paire' : handKey[2] === 's' ? 'Suited' : 'Offsuit';

  if (phase === 'question') {
    return (
      <div className="space-y-3">
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{range.title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sessionPct !== null && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                color: sessionPct >= 80 ? '#22c55e' : sessionPct >= 60 ? '#f59e0b' : '#ef4444',
              }}>{correct}/{attempts} — {sessionPct}%</span>
            )}
            <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={onEnd}>
              Quitter
            </button>
          </div>
        </div>

        {/* Table visuelle */}
        <PokerTableView range={range} />

        {/* Cards — sous la table, à la place du siège héros */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, padding: '4px 0 10px' }}>
          <HandCard {...c1} />
          <HandCard {...c2} />
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <strong style={{ color: 'var(--text)' }}>{handKey}</strong> — {handType}
        </div>

        {/* Context */}
        <div className="panel-inset">
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Contexte</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.4 }}>{scenarioDescription(range)}</div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Actions */}
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>Quelle est votre action ?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => handleAnswer('fold')}
            style={{ background: 'var(--surface2)', color: '#94a3b8', border: '1px solid var(--border)', borderRadius: 10, padding: '11px', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Fold
          </button>
          {range.palette.map(color => (
            <button
              key={color.id}
              onClick={() => handleAnswer(color.id)}
              style={{ background: color.hex, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              {color.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Feedback ──────────────────────────────────────────────────────────────

  const validLabels = inRange
    ? validColorIds.map(id => range.palette.find(p => p.id === id)?.label ?? id)
    : ['Fold'];
  const validColors = inRange
    ? validColorIds.map(id => range.palette.find(p => p.id === id)?.hex ?? '#334155')
    : ['#475569'];
  const answeredLabel = answered === 'fold' ? 'Fold' : range.palette.find(p => p.id === answered)?.label ?? answered ?? '';
  const answeredHex   = answered === 'fold' ? '#475569' : range.palette.find(p => p.id === answered)?.hex ?? '#334155';

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{range.title}</span>
        <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={onEnd}>
          Quitter
        </button>
      </div>

      {/* Result banner */}
      <div style={{
        borderRadius: 10, padding: '12px 14px',
        background: isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
      }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: isCorrect ? '#22c55e' : '#f87171' }}>
          {isCorrect ? '✓ Correct !' : '✗ Incorrect'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
          {!isCorrect && (
            <>Votre réponse : <strong style={{ color: answeredHex }}>{answeredLabel}</strong> · </>
          )}
          Action{validLabels.length > 1 ? 's' : ''} valide{validLabels.length > 1 ? 's' : ''} :{' '}
          {validLabels.map((lbl, i) => (
            <span key={lbl}>
              {i > 0 && <span style={{ color: 'var(--border)' }}> ou </span>}
              <strong style={{ color: validColors[i] }}>{lbl}</strong>
            </span>
          ))}
        </div>
        {/* Frequency breakdown */}
        {inRange && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {range.palette.map(p => {
              const freq = range.hands[handKey]?.[p.id] ?? 0;
              if (!freq) return null;
              return (
                <span key={p.id} style={{ background: p.hex + '22', color: p.hex, border: `1px solid ${p.hex}44`, borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {p.label} {freq}%
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Hand + matrix */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <HandCard {...c1} />
            <HandCard {...c2} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>{handKey}</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Range complète</div>
          <MiniMatrix range={range} highlightKey={handKey} />
        </div>
      </div>

      {/* Notes */}
      {range.notes && (
        <div className="panel-inset">
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3 }}>Note</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{range.notes}</div>
        </div>
      )}

      {/* Score + next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Session : <strong style={{ color: sessionPct !== null && sessionPct >= 80 ? '#22c55e' : sessionPct !== null && sessionPct >= 60 ? '#f59e0b' : '#ef4444' }}>
            {correct}/{attempts}{sessionPct !== null ? ` = ${sessionPct}%` : ''}
          </strong>
        </span>
        <button
          className="btn btn-primary"
          style={{ flex: 1, padding: '11px' }}
          onClick={pickNext}
        >
          Main suivante →
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Step = 'source' | 'select' | 'train';
type SubTab = 'train' | 'diag';

export default function ReTrainerPage() {
  const [step, setStep]   = useState<Step>('source');
  const [reState, setREState] = useState<REState | null>(null);
  const [rangeIds, setRangeIds] = useState<string[]>([]);
  const [stats, setStats]     = useState<REStats>(() => loadREStats());
  const [proximity, setProximity] = useState<ProximityMode>(loadProximity);
  const [subTab, setSubTab]   = useState<SubTab>('train');

  useEffect(() => { saveREStats(stats); }, [stats]);
  useEffect(() => { localStorage.setItem('re-proximity', proximity); }, [proximity]);

  function scrollTop() {
    document.querySelector('main')?.scrollTo({ top: 0 });
  }
  function handleLoaded(s: REState) { setREState(s); setStep('select'); scrollTop(); }
  function handleStart(ids: string[]) { setRangeIds(ids); setStep('train'); setSubTab('train'); scrollTop(); }
  function handleEnd() { setStep('select'); scrollTop(); }

  if (step === 'source') return <SourceStep onLoaded={handleLoaded} />;

  if (step === 'select' && reState) {
    return (
      <SelectStep
        state={reState}
        proximity={proximity}
        onProximityChange={setProximity}
        onStart={handleStart}
      />
    );
  }

  if (step === 'train' && reState) {
    return (
      <div className="space-y-4">
        {/* Sub-tab bar */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([['train', '🎯 Entraînement'], ['diag', '📊 Diagnostic']] as [SubTab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`pill${subTab === t ? ' active' : ''}`}
              style={{ flex: 1, textAlign: 'center', padding: '7px' }}
            >
              {label}
            </button>
          ))}
        </div>

        {subTab === 'train' ? (
          <TrainingSession
            state={reState}
            rangeIds={rangeIds}
            stats={stats}
            onStats={setStats}
            proximity={proximity}
            onEnd={handleEnd}
          />
        ) : (
          <div className="space-y-4">
            <DiagnosticView stats={stats} ranges={reState.ranges} rangeIds={rangeIds} />
            <button className="btn btn-full" onClick={handleEnd}>← Changer de scénarios</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
