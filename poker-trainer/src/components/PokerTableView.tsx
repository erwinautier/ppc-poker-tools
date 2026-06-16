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

interface Seat {
  position: string;
  x: number;
  y: number;
  isHero: boolean;
  folded: boolean;
  action: string | null; // action prise (open/call/3bet/xbet) si elle existe
  hasActed: boolean;
}

function computeSeats(range: RERange): Seat[] {
  const order = POSITIONS_BY_PLAYERS[range.players] ?? POSITIONS_BY_PLAYERS[6];
  const heroIdx = order.indexOf(range.position);
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

  const SEAT_W = 70, SEAT_H = 36;

  return (
    <svg viewBox="0 0 520 400" style={{ width: '100%', maxWidth: 460, display: 'block', margin: '0 auto' }} role="img">
      <title>Table de poker</title>
      <ellipse cx={260} cy={190} rx={210} ry={130} fill="var(--surface2)" stroke="#b9442e" strokeWidth={5} />
      <text x={260} y={120} textAnchor="middle" fill="var(--text)" fontSize={12} fontFamily="Inter, system-ui, sans-serif">
        {range.players}-max · {range.stackBB} BB
      </text>

      {seats.map(seat => {
        const bx = seat.x - SEAT_W / 2;
        const by = seat.y - SEAT_H / 2;
        const opacity = seat.folded ? 0.45 : 1;
        const strokeColor = seat.isHero
          ? '#6b94ff'
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
              x={seat.x} y={seat.y - 4} textAnchor="middle"
              fill={seat.isHero ? '#fff' : 'var(--text)'}
              fontWeight={700} fontSize={12} fontFamily="Inter, system-ui, sans-serif"
            >
              {seat.position}{seat.isHero ? ' (vous)' : ''}
            </text>
            <text
              x={seat.x} y={seat.y + 11} textAnchor="middle"
              fill={seat.isHero ? '#dbe4ff' : 'var(--text-muted)'}
              fontSize={10} fontFamily="Inter, system-ui, sans-serif"
            >
              {range.stackBB} BB
            </text>

            {/* Tag d'action / fold */}
            {seat.folded && (
              <g transform={`translate(${seat.x - 20}, ${by - 16})`}>
                <rect width={40} height={16} rx={8} fill="#3a3f4d" />
                <text x={20} y={11.5} textAnchor="middle" fill="#9aa1b5" fontWeight={700} fontSize={9} fontFamily="Inter, system-ui, sans-serif">
                  FOLD
                </text>
              </g>
            )}
            {!seat.folded && seat.action && (
              <g transform={`translate(${seat.x - 20}, ${by - 16})`}>
                <rect width={40} height={16} rx={8} fill={ACTION_COLORS[seat.action] ?? '#888'} />
                <text x={20} y={11.5} textAnchor="middle" fill="#0f1117" fontWeight={700} fontSize={9} fontFamily="Inter, system-ui, sans-serif">
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
          fill="var(--text-muted)" fontSize={10} fontFamily="Inter, system-ui, sans-serif"
        >
          ↓ votre main
        </text>
      )}
    </svg>
  );
}
