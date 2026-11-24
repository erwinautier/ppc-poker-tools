import type { RERange } from '../engine/rangeEditorBridge';

// Ordre de jeu standard, dans le sens horaire (UTG agit en premier)
const POSITIONS_BY_PLAYERS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

const ACTION_LABELS: Record<string, string> = {
  open: 'OPEN',
  call: 'CALL',
  '3bet': '3BET',
  xbet: 'X-R',
};

const ACTION_COLORS: Record<string, string> = {
  open: '#f59e0b',
  call: '#22c55e',
  '3bet': '#ef4444',
  xbet: '#a855f7',
};

// ── Pot et mises ───────────────────────────────────────────────────────────────
// Tailles standard (aucune ante) : open 2,5 BB (2 BB à 25 BB ou moins), 3-bet ×3
// (×4 depuis les blindes), 4-bet et plus ×2,3, plafonnées au stack.

const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtBB = (n: number) => round1(n).toLocaleString('fr-FR');

export interface PotInfo {
  /** Jetons mis au pot par position (blindes comprises) */
  contrib: Record<string, number>;
  pot: number;
  /** Mise la plus haute à suivre */
  currentBet: number;
}

export function computePot(range: RERange): PotInfo {
  const order = POSITIONS_BY_PLAYERS[range.players] ?? POSITIONS_BY_PLAYERS[6];
  const stack = range.stackBB;
  const contrib: Record<string, number> = {};
  // Blindes (en heads-up, le bouton paie la petite blinde)
  const sbPos = order.length === 2 ? order[0] : 'SB';
  if (order.includes(sbPos)) contrib[sbPos] = 0.5;
  if (order.includes('BB')) contrib.BB = 1;
  let currentBet = 1;
  const isBlind = (pos: string) => pos === 'SB' || pos === 'BB';

  const apply = (pos: string, action: string | null) => {
    if (!action) return;
    let put: number;
    if (action === 'open') put = Math.max(currentBet, stack <= 25 ? 2 : 2.5);
    else if (action === 'call') put = currentBet;
    else if (action === '3bet') put = currentBet * (isBlind(pos) ? 4 : 3);
    else if (action === 'xbet') put = currentBet * 2.3;
    else return;
    put = Math.min(stack, round1(put));
    contrib[pos] = Math.max(contrib[pos] ?? 0, put);
    currentBet = Math.max(currentBet, put);
  };

  if (range.rangeType === 'facing_action') {
    // Héros premier de parole : il a ouvert, les autres ont réagi après lui
    if (order.indexOf(range.position) === 0) apply(range.position, 'open');
    for (const step of range.actionSequence) apply(step.position, step.action);
  }
  const pot = round1(Object.values(contrib).reduce((a, b) => a + b, 0));
  return { contrib, pot, currentBet };
}

interface Seat {
  position: string;
  x: number;
  y: number;
  isHero: boolean;
  folded: boolean;
  action: string | null; // action prise (open/call/3bet/xbet) si elle existe
  hasActed: boolean;
}

// Full positional rank (earlier = acts earlier preflop)
const POSITION_RANK: Record<string, number> = {
  'UTG': 0, 'UTG+1': 1, 'UTG+2': 2, 'LJ': 3, 'HJ': 4, 'CO': 5, 'BTN': 6, 'SB': 7, 'BB': 8,
};

function computeSeats(range: RERange): Seat[] {
  const baseOrder = [...(POSITIONS_BY_PLAYERS[range.players] ?? POSITIONS_BY_PLAYERS[6])];
  let heroIdx = baseOrder.indexOf(range.position);

  // If position not in standard order (e.g. 'UTG' in 6-max), substitute the closest seat
  if (heroIdx === -1) {
    const heroRank = POSITION_RANK[range.position] ?? 0;
    heroIdx = baseOrder.reduce((best, pos, i) => {
      const d = Math.abs((POSITION_RANK[pos] ?? 0) - heroRank);
      const dBest = Math.abs((POSITION_RANK[baseOrder[best]] ?? 0) - heroRank);
      return d < dBest ? i : best;
    }, 0);
    baseOrder[heroIdx] = range.position; // keep the original label on the seat
  }

  const order = baseOrder;
  const n = order.length;

  // Réordonne la liste pour commencer par le héros, puis dans l'ordre de jeu
  const rotated = [...order.slice(heroIdx), ...order.slice(0, heroIdx)];

  // Map position → step d'action (si rangeType === 'facing_action')
  const actedMap = new Map<string, string | null>();
  if (range.rangeType === 'facing_action') {
    for (const step of range.actionSequence) {
      actedMap.set(step.position, step.action);
    }
  }

  const cx = 260, cy = 190, rx = 210, ry = 130;

  return rotated.map((pos, i) => {
    // i=0 → héros en bas (90°), puis sens horaire (angle croissant) tous les 360/n degrés
    const angleDeg = 90 + i * (360 / n);
    const rad = (angleDeg * Math.PI) / 180;
    const x = cx + rx * Math.cos(rad);
    const y = cy + ry * Math.sin(rad);

    const isHero = pos === range.position;
    const acted = actedMap.has(pos);
    const action = actedMap.get(pos) ?? null;
    // Une position "a agi" si elle est dans actionSequence avec une action non-null,
    // ou explicitement fold (action === null mais présente dans la séquence avant le héros)
    const folded = acted && action === null;

    return { position: pos, x, y, isHero, folded, action, hasActed: acted };
  });
}

interface Props {
  range: RERange;
}

export default function PokerTableView({ range }: Props) {
  const seats = computeSeats(range);
  const hero = seats.find(s => s.isHero);
  const potInfo = computePot(range);

  const SEAT_W = 76, SEAT_H = 42;

  return (
    <svg viewBox="0 0 520 400" style={{ width: '100%', maxWidth: 460, display: 'block', margin: '0 auto' }} role="img">
      <title>Table de poker</title>
      <ellipse cx={260} cy={190} rx={210} ry={130} fill="var(--surface2)" stroke="var(--ppc-corail)" strokeWidth={5} />
      {/* Au centre : le pot (blindes + mises) */}
      <text x={260} y={148} textAnchor="middle" fill="var(--text-muted)" fontSize={13} fontWeight={700} fontFamily="Montserrat, system-ui, sans-serif" letterSpacing="0.1em">
        POT
      </text>
      <text x={260} y={186} textAnchor="middle" fill="var(--ppc-ivoire)" fontSize={36} fontFamily="Bungee, Montserrat, system-ui, sans-serif">
        {fmtBB(potInfo.pot)} BB
      </text>

      {/* Encart distinct : le stack effectif */}
      <g transform="translate(260, 214)">
        <rect x={-92} y={-15} width={184} height={30} rx={15} fill="var(--gold-bg)" stroke="var(--ppc-or)" strokeWidth={1.5} />
        <text x={0} y={5} textAnchor="middle" fontFamily="Montserrat, system-ui, sans-serif" fontSize={13}>
          <tspan fill="var(--text-muted)" fontWeight={600}>Stack effectif </tspan>
          <tspan fill="var(--ppc-or)" fontWeight={800} fontSize={15}>{range.stackBB} BB</tspan>
        </text>
      </g>
      <text x={260} y={246} textAnchor="middle" fill="var(--text-muted)" fontSize={11} fontFamily="Montserrat, system-ui, sans-serif">
        {range.players}-max
      </text>

      {seats.map(seat => {
        const bx = seat.x - SEAT_W / 2;
        const by = seat.y - SEAT_H / 2;
        const opacity = seat.folded ? 0.45 : 1;
        const strokeColor = seat.isHero
          ? 'var(--accent-hover)'
          : seat.action
          ? ACTION_COLORS[seat.action] ?? 'var(--border)'
          : 'var(--border)';
        const fill = seat.isHero ? 'var(--accent)' : 'var(--surface2)';

        return (
          <g key={seat.position} opacity={opacity}>
            <rect
              x={bx} y={by} width={SEAT_W} height={SEAT_H} rx={8}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={seat.isHero || seat.action ? 2 : 1.5}
            />
            <text
              x={seat.x} y={seat.y - 5} textAnchor="middle"
              fill={seat.isHero ? 'var(--ppc-prune)' : 'var(--text)'}
              fontWeight={700} fontSize={12} fontFamily="Montserrat, system-ui, sans-serif"
            >
              {seat.position}{seat.isHero ? ' (vous)' : ''}
            </text>
            <text
              x={seat.x} y={seat.y + 13} textAnchor="middle"
              fill={seat.isHero ? 'var(--ppc-prune)' : 'var(--ppc-or)'}
              fontWeight={700} fontSize={14} fontFamily="Montserrat, system-ui, sans-serif"
            >
              {fmtBB(range.stackBB - (potInfo.contrib[seat.position] ?? 0))} BB
            </text>

            {/* Mise devant le joueur (blindes comprises) */}
            {(potInfo.contrib[seat.position] ?? 0) > 0 && (() => {
              const k = 0.36;
              const bx2 = seat.x + (260 - seat.x) * k;
              const by2 = seat.y + (190 - seat.y) * k;
              return (
                <g transform={`translate(${bx2}, ${by2})`}>
                  <circle r={8} fill="var(--ppc-corail)" stroke="var(--ppc-ivoire)" strokeWidth={2} strokeDasharray="3 2.2" />
                  <text x={13} y={4.5} fill="var(--ppc-ivoire)" fontWeight={800} fontSize={13} fontFamily="Montserrat, system-ui, sans-serif">
                    {fmtBB(potInfo.contrib[seat.position])}
                  </text>
                </g>
              );
            })()}

            {/* Tag d'action / fold */}
            {seat.folded && (
              <g transform={`translate(${seat.x - 20}, ${by - 16})`}>
                <rect width={40} height={16} rx={8} fill="var(--surface)" />
                <text x={20} y={11.5} textAnchor="middle" fill="var(--text-muted)" fontWeight={700} fontSize={9} fontFamily="Montserrat, system-ui, sans-serif">
                  FOLD
                </text>
              </g>
            )}
            {!seat.folded && seat.action && (
              <g transform={`translate(${seat.x - 20}, ${by - 16})`}>
                <rect width={40} height={16} rx={8} fill={ACTION_COLORS[seat.action] ?? '#888'} />
                <text x={20} y={11.5} textAnchor="middle" fill="var(--ppc-prune)" fontWeight={700} fontSize={9} fontFamily="Montserrat, system-ui, sans-serif">
                  {ACTION_LABELS[seat.action] ?? seat.action.toUpperCase()}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Cartes du héros — sous son siège */}
      {hero && (
        <text
          x={hero.x} y={hero.y + SEAT_H / 2 + 26} textAnchor="middle"
          fill="var(--text-muted)" fontSize={10} fontFamily="Montserrat, system-ui, sans-serif"
        >
          ↓ votre main
        </text>
      )}
    </svg>
  );
}
