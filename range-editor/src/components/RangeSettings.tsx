import type { Range, Position, VillainAction, VillainStep, PaletteColor } from '../types';
import { POSITIONS_BY_PLAYERS } from '../types';

interface Props {
  range: Range;
  onChange: (updates: Partial<Range>) => void;
}

// ── Palettes par défaut selon le contexte ──────────────────────────────────

function makeId() { return crypto.randomUUID(); }

const PALETTE_OPEN: PaletteColor[] = [
  { id: makeId(), hex: '#22c55e', label: 'Open' },
  { id: makeId(), hex: '#f59e0b', label: 'Limp' },
];
const PALETTE_FACING_STANDARD: PaletteColor[] = [
  { id: makeId(), hex: '#3b82f6', label: 'Call' },
  { id: makeId(), hex: '#39ff14', label: '3-bet' },
];
const PALETTE_FACING_FIRST: PaletteColor[] = [
  { id: makeId(), hex: '#3b82f6', label: 'Call' },
  { id: makeId(), hex: '#f97316', label: '4-bet' },
  { id: makeId(), hex: '#ef4444', label: '4-bet shove' },
];

/** Palettes considérées comme "par défaut" (labels canoniques) */
const DEFAULT_LABEL_SETS = [
  ['Open', 'Limp'],
  ['Call', '3-bet'],
  ['Call', '4-bet', '4-bet shove'],
];
function isDefaultPalette(palette: PaletteColor[]): boolean {
  const labels = palette.map(p => p.label);
  return DEFAULT_LABEL_SETS.some(
    set => set.length === labels.length && set.every((l, i) => l === labels[i])
  );
}

// ── Helpers position ───────────────────────────────────────────────────────

function heroIndex(players: number, heroPos: Position): number {
  return (POSITIONS_BY_PLAYERS[players] ?? []).indexOf(heroPos);
}

/** Le héros est le premier à parler (UTG / LJ selon le nombre de joueurs) */
function isHeroFirst(players: number, heroPos: Position): boolean {
  return heroIndex(players, heroPos) === 0;
}

/** Positions qui parlent AVANT le héros */
function positionsBefore(players: number, heroPos: Position): Position[] {
  const all = POSITIONS_BY_PLAYERS[players] ?? [];
  const idx = all.indexOf(heroPos);
  return idx <= 0 ? [] : all.slice(0, idx);
}

/** Positions qui parlent APRÈS le héros (cas hero en 1ère parole face à 3-bet) */
function positionsAfter(players: number, heroPos: Position): Position[] {
  const all = POSITIONS_BY_PLAYERS[players] ?? [];
  const idx = all.indexOf(heroPos);
  return idx === -1 || idx >= all.length - 1 ? [] : all.slice(idx + 1);
}

function rebuildSequence(
  positions: Position[],
  prev: VillainStep[],
): VillainStep[] {
  return positions.map(pos => {
    const existing = prev.find(s => s.position === pos);
    return { position: pos, action: existing?.action ?? null };
  });
}

// ── Labels des actions villain selon le contexte ───────────────────────────

const ACTIONS_STANDARD: { value: VillainAction; label: string }[] = [
  { value: 'open',  label: 'Open' },
  { value: 'call',  label: 'Call' },
  { value: '3bet',  label: '3-bet' },
  { value: 'xbet',  label: 'X-bet (4-bet+)' },
];

// Quand le héros a déjà ouvert, les autres ont pu call l'open, 3-bet, ou x-bet
const ACTIONS_AFTER_HERO_OPEN: { value: VillainAction; label: string }[] = [
  { value: 'call',  label: 'Call (appel de l\'open)' },
  { value: '3bet',  label: '3-bet' },
  { value: 'xbet',  label: 'X-bet (4-bet+)' },
];

// ── Composant ──────────────────────────────────────────────────────────────

export default function RangeSettings({ range, onChange }: Props) {
  const allPositions = POSITIONS_BY_PLAYERS[range.players] ?? [];
  const heroFirst = isHeroFirst(range.players, range.position);
  const isFacing  = (range.rangeType ?? 'open') === 'facing_action';

  // Positions à afficher dans la séquence
  const sequencePositions = isFacing
    ? (heroFirst ? positionsAfter(range.players, range.position)
                 : positionsBefore(range.players, range.position))
    : [];

  // Recalcule la séquence et la palette correcte lors d'un changement de config
  function computeUpdates(
    players: number,
    position: Position,
    rangeType: Range['rangeType'],
    currentPalette: PaletteColor[],
    prevSequence: VillainStep[],
  ): Partial<Range> {
    const first = isHeroFirst(players, position);
    const positions = rangeType === 'facing_action'
      ? (first ? positionsAfter(players, position) : positionsBefore(players, position))
      : [];
    const actionSequence = rebuildSequence(positions, prevSequence);

    // Change la palette uniquement si elle est encore "par défaut"
    let palette = currentPalette;
    if (isDefaultPalette(currentPalette)) {
      if (rangeType === 'open') palette = PALETTE_OPEN.map(c => ({ ...c, id: makeId() }));
      else if (first)           palette = PALETTE_FACING_FIRST.map(c => ({ ...c, id: makeId() }));
      else                      palette = PALETTE_FACING_STANDARD.map(c => ({ ...c, id: makeId() }));
    }

    return { players, position, rangeType, actionSequence, palette };
  }

  const handlePlayersChange = (players: number) => {
    const newPositions = POSITIONS_BY_PLAYERS[players] ?? [];
    const position = newPositions.includes(range.position) ? range.position : newPositions[0];
    onChange(computeUpdates(players, position, range.rangeType ?? 'open', range.palette, range.actionSequence ?? []));
  };

  const handlePositionChange = (position: Position) => {
    onChange(computeUpdates(range.players, position, range.rangeType ?? 'open', range.palette, range.actionSequence ?? []));
  };

  const handleRangeTypeChange = (rangeType: Range['rangeType']) => {
    onChange(computeUpdates(range.players, range.position, rangeType, range.palette, range.actionSequence ?? []));
  };

  const handleVillainAction = (position: Position, action: VillainAction | null) => {
    const actionSequence = (range.actionSequence ?? []).map(step =>
      step.position === position ? { ...step, action } : step,
    );
    onChange({ actionSequence });
  };

  // Résumé lisible du scénario
  const contextSummary = (): string => {
    if (!isFacing) return '';
    const active = (range.actionSequence ?? []).filter(s => s.action !== null);
    if (active.length === 0) return '';

    if (heroFirst) {
      // "Héros (UTG) Open → CO 3-bet → ?"
      const tail = active.map(s => {
        const lbl = ACTIONS_AFTER_HERO_OPEN.find(a => a.value === s.action)?.label ?? s.action;
        return `${s.position} ${lbl}`;
      }).join(' → ');
      return `Héros (${range.position}) Open → ${tail}`;
    } else {
      // "LJ Open → BTN 3-bet → Héros (CO)"
      const head = active.map(s => {
        const lbl = ACTIONS_STANDARD.find(a => a.value === s.action)?.label ?? s.action;
        return `${s.position} ${lbl}`;
      }).join(' → ');
      return `${head} → Héros (${range.position})`;
    }
  };

  const summary = contextSummary();
  const villainActionList = heroFirst ? ACTIONS_AFTER_HERO_OPEN : ACTIONS_STANDARD;

  return (
    <div className="range-settings">

      {/* Ligne 1 : Titre */}
      <div className="settings-row">
        <div className="field field--wide">
          <label>Titre</label>
          <input
            type="text"
            value={range.title}
            onChange={e => onChange({ title: e.target.value })}
            className="input-text"
            placeholder="Ex : Open UTG 100BB"
          />
        </div>
      </div>

      {/* Ligne 2 : Paramètres de table */}
      <div className="settings-row">
        <div className="field">
          <label>Joueurs à table</label>
          <select
            value={range.players}
            onChange={e => handlePlayersChange(Number(e.target.value))}
            className="select"
          >
            {[2,3,4,5,6,7,8,9].map(n => (
              <option key={n} value={n}>
                {n} joueurs ({n === 2 ? 'HU' : n === 6 ? 'SH' : n === 9 ? 'FR' : `${n}max`})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Position du héros</label>
          <select
            value={range.position}
            onChange={e => handlePositionChange(e.target.value as Position)}
            className="select"
          >
            {allPositions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Stack (BB)</label>
          <input
            type="number"
            value={range.stackBB}
            min={1} max={500}
            onChange={e => onChange({ stackBB: Number(e.target.value) })}
            className="input-number"
          />
        </div>
      </div>

      {/* Ligne 3 : Type de range */}
      <div className="settings-row">
        <div className="field">
          <label>Type de range</label>
          <div className="range-type-toggle">
            <button
              className={`toggle-btn ${!isFacing ? 'active' : ''}`}
              onClick={() => handleRangeTypeChange('open')}
            >
              Open
            </button>
            <button
              className={`toggle-btn ${isFacing ? 'active' : ''}`}
              onClick={() => handleRangeTypeChange('facing_action')}
            >
              Face à une action
            </button>
          </div>
        </div>
      </div>

      {/* Ligne 4 : Séquence d'actions */}
      {isFacing && (
        <div className="action-sequence">

          {/* Titre contextuel */}
          <div className="sequence-title">
            {heroFirst
              ? <>Tu as <strong>open-raise</strong>. Actions des joueurs après toi :</>
              : <>Actions des joueurs avant le héros</>
            }
            <span className="sequence-hint">
              Laisse vide si le joueur a fold / n'a pas agi
            </span>
          </div>

          {/* Badge explicatif pour hero en 1ère parole */}
          {heroFirst && (
            <div className="sequence-info">
              <span className="info-icon">ℹ</span>
              En tant que premier à parler, tu as nécessairement open-raise.
              Tu fais face à un 3-bet (ou plus) d'un joueur derrière toi.
              Ta range ici décrit ta <strong>réponse au 3-bet</strong>.
            </div>
          )}

          {/* Étapes */}
          {sequencePositions.length === 0 ? (
            <p className="sequence-hint" style={{ fontStyle: 'italic' }}>
              Aucun joueur ne précède / suit le héros à cette position.
            </p>
          ) : (
            <div className="sequence-steps">
              {(range.actionSequence ?? []).map((step, i) => (
                <div key={step.position} className="sequence-step">
                  <span className="step-index">{i + 1}</span>
                  <span className="step-position">{step.position}</span>
                  <select
                    className="select select--action"
                    value={step.action ?? ''}
                    onChange={e =>
                      handleVillainAction(
                        step.position,
                        e.target.value === '' ? null : e.target.value as VillainAction,
                      )
                    }
                  >
                    <option value="">— Fold / aucune action</option>
                    {villainActionList.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Résumé du scénario */}
          {summary && (
            <div className="sequence-summary">
              <span className="summary-label">Scénario :</span>
              <span className="summary-text">{summary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
