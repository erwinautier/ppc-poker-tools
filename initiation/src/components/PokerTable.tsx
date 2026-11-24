import type { TableSpec } from '../content/types';
import { PCard } from './Cards';

/** Noms de positions pour n joueurs, dans l'ordre à partir du bouton. */
export function positionNames(n: number): string[] {
  if (n === 2) return ['BTN/SB', 'BB'];
  const rest = n - 3;
  const after = ['UTG+1', 'MP', 'HJ', 'CO'];
  const tail = rest > 0 ? ['UTG', ...after.slice(after.length - (rest - 1))] : [];
  return ['BTN', 'SB', 'BB', ...tail];
}

/** Position du siège `seat` quand le bouton est au siège `button`. */
export function positionOf(seat: number, button: number, n: number): string {
  return positionNames(n)[(seat - button + n) % n];
}
export function seatOfPosition(pos: string, button: number, n: number): number {
  const i = positionNames(n).indexOf(pos);
  return (button + i) % n;
}
export function sbSeat(button: number, n: number) { return n === 2 ? button : (button + 1) % n; }
export function bbSeat(button: number, n: number) { return n === 2 ? (button + 1) % n : (button + 2) % n; }

/** Coordonnées (%) du siège i : le siège 0 est en bas, puis on tourne dans le sens horaire. */
function seatXY(i: number, n: number): [number, number] {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [50 + 44 * Math.cos(a), 50 + 41 * Math.sin(a)];
}

interface Props {
  spec: TableSpec;
  onSeat?: (i: number) => void;
  /** Jetons posés par l'élève : siège → libellés. */
  placed?: Record<number, string[]>;
  seatState?: Record<number, 'good' | 'bad'>;
}

export function PokerTable({ spec, onSeat, placed, seatState }: Props) {
  const { n, button, labels, stacks, folded = [], hero, cards = {}, bets = {}, board, pot, highlight = [], showBlinds, showPositions } = spec;
  const seats = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = seatXY(i, n);
    const tokens: string[] = [];
    if (button !== undefined && showBlinds) {
      if (i === button) tokens.push('BTN');
      if (i === sbSeat(button, n)) tokens.push('SB');
      if (i === bbSeat(button, n)) tokens.push('BB');
    }
    if (placed?.[i]) tokens.push(...placed[i]);
    const label = labels?.[i] ?? (showPositions && button !== undefined ? positionOf(i, button, n) : `Siège ${i + 1}`);
    const cls = ['seat', i === hero && 'hero', folded.includes(i) && 'folded', highlight.includes(i) && 'hl', onSeat && 'clickable', seatState?.[i]]
      .filter(Boolean).join(' ');
    const cs = cards[i];
    seats.push(
      <div key={i} className={cls} style={{ left: `${x}%`, top: `${y}%` }} onClick={onSeat ? () => onSeat(i) : undefined}
        role={onSeat ? 'button' : undefined} aria-label={onSeat ? `Siège : ${label}` : undefined}>
        {cs && (
          <div className="mini">
            {cs === 'back' ? (<><PCard back size="xs" /><PCard back size="xs" /></>) : cs.map(c => <PCard key={c} c={c} size="xs" />)}
          </div>
        )}
        <div className="disc">
          <span className="nm">{label}</span>
          {stacks?.[i] && <span className="stk">{stacks[i]}</span>}
        </div>
        {(tokens.length > 0 || bets[i]) && (
          <div className="tokens">
            {tokens.map((t, k) => <span key={k} className={`token ${tokenClass(t)}`}>{t}</span>)}
            {bets[i] && <span className="bet-chip">{bets[i]}</span>}
          </div>
        )}
      </div>,
    );
  }
  return (
    <div className="ptable">
      <div className="felt">
        {board && board.length > 0 && (
          <div className="cards-row" style={{ gap: 3 }}>
            {board.map(c => <PCard key={c} c={c} size="sm" />)}
          </div>
        )}
        {pot && <span className="pot">Pot : {pot}</span>}
      </div>
      {seats}
    </div>
  );
}

function tokenClass(t: string) {
  if (t === 'BTN') return 'btn-t';
  if (t === 'SB') return 'sb-t';
  if (t === 'BB') return 'bb-t';
  return 'x-t';
}
