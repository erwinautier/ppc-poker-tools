import type { RangeContext, Scenario, StackDepth, GameFormat } from '../engine/types';
import { STACK_DEPTHS, SCENARIOS, SCENARIO_LABELS, POSITION_COLORS } from '../engine/types';
import { getPositions, needsVillain, validVillains, sanitizeCtx } from '../engine/context';

interface Props {
  ctx:      RangeContext;
  onChange: (ctx: RangeContext) => void;
  compact?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#64748b', fontSize: 11, marginBottom: 5 }}>{children}</div>;
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

function PosBtn({ pos, active, onClick }: { pos: string; active: boolean; onClick: () => void }) {
  const c = POSITION_COLORS[pos] ?? { active: '#6b7280', inactive: '#1e293b' };
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? c.active : c.inactive,
        color: '#fff',
        border: `1px solid ${active ? c.active : 'transparent'}`,
        borderRadius: 6,
        padding: '3px 8px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {pos}
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
  color,
}: {
  label:    string;
  active:   boolean;
  onClick:  () => void;
  color?:   string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (color ?? '#16a34a') : 'rgba(255,255,255,0.06)',
        color: '#fff',
        border: `1px solid ${active ? (color ?? '#16a34a') : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ContextSelector({ ctx, onChange, compact = false }: Props) {
  const positions  = getPositions(ctx.format);
  const reqVillain = needsVillain(ctx.scenario);
  const villains   = validVillains(ctx);

  function update(patch: Partial<RangeContext>) {
    onChange(sanitizeCtx({ ...ctx, ...patch }));
  }

  const gap = compact ? 'space-y-2' : 'space-y-3';

  return (
    <div className={gap}>
      {/* Format */}
      <div>
        <Label>Format</Label>
        <ToggleGroup>
          {(['6max', '8max'] as GameFormat[]).map(f => (
            <Chip key={f} label={f === '6max' ? '6-max' : '8-max'} active={ctx.format === f}
              onClick={() => update({ format: f })} color="#16a34a" />
          ))}
        </ToggleGroup>
      </div>

      {/* Stack */}
      <div>
        <Label>Profondeur de tapis</Label>
        <div className="flex items-center gap-2">
          <select
            value={ctx.stack}
            onChange={e => update({ stack: Number(e.target.value) as StackDepth })}
            style={{
              background: 'rgba(255,255,255,0.07)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {STACK_DEPTHS.map(s => (
              <option key={s} value={s} style={{ background: '#0f172a' }}>{s} bb</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenario */}
      <div>
        <Label>Scénario</Label>
        <ToggleGroup>
          {SCENARIOS.map(s => (
            <Chip key={s} label={SCENARIO_LABELS[s]} active={ctx.scenario === s}
              onClick={() => update({ scenario: s as Scenario })} color="#7c3aed" />
          ))}
        </ToggleGroup>
      </div>

      {/* Hero position */}
      <div>
        <Label>Votre position</Label>
        <ToggleGroup>
          {positions.map(p => (
            <PosBtn key={p} pos={p} active={ctx.position === p} onClick={() => update({ position: p })} />
          ))}
        </ToggleGroup>
      </div>

      {/* Villain position */}
      {reqVillain && (
        <div>
          <Label>Position de l'ouvreur</Label>
          {villains.length === 0 ? (
            <p style={{ color: '#ef4444', fontSize: 11 }}>
              Aucune position valide — l'ouvreur doit agir avant vous.
            </p>
          ) : (
            <ToggleGroup>
              {villains.map(p => (
                <PosBtn key={p} pos={p} active={ctx.villainPosition === p}
                  onClick={() => update({ villainPosition: p })} />
              ))}
            </ToggleGroup>
          )}
        </div>
      )}
    </div>
  );
}
