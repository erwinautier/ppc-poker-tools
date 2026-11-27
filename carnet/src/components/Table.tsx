/** La table vue de dessus : sièges autour du tapis, héros en bas, mises, board et pot au centre. */
import type { Card } from '../lib/cards';
import { bbs, chips } from '../lib/format';
import { buttonIndex, positions, potOf, type State } from '../lib/engine';
import type { HandData } from '../lib/hand';
import { CardBack, CardFace, CardSlot } from './Cards';

export function PokerTable({ hand, state, board, last, reveal, onSeat }: {
  hand: HandData;
  state: State;
  board: Card[];
  /** Joueur de la dernière action, mis en avant. */
  last?: number | null;
  /** Montrer les cartes connues des adversaires (abattage). */
  reveal?: boolean;
  onSeat?: (i: number) => void;
}) {
  const n = hand.seats.length;
  const pos = positions(n);
  const bb = hand.ctx.blinds.bb;
  const btn = buttonIndex(n);
  // Sens des aiguilles d'une montre (ordre de parole), le héros en bas au milieu.
  const angle = (i: number) => Math.PI / 2 + ((i - hand.hero) * 2 * Math.PI) / n;
  const place = (i: number, r = 1) => {
    const a = angle(i);
    return { left: `${50 + 43 * r * Math.cos(a)}%`, top: `${50 + 41 * r * Math.sin(a)}%` };
  };
  // Les jetons misés : entre le siège et le board, plus près du centre en haut et en bas (sièges plus hauts que larges).
  const betPlace = (i: number) => place(i, Math.abs(Math.sin(angle(i))) > 0.3 ? 0.62 : 0.72);
  return (
    <div className={`ptable n${n}`}>
      <div className="felt" />
      <div className="center">
        <div className="board">
          {Array.from({ length: 5 }, (_, i) => (board[i] !== undefined ? <CardFace key={i} c={board[i]} size="sm" /> : <CardSlot key={i} size="sm" />))}
        </div>
        <div className="pot">Pot <b className="tnum">{chips(potOf(state))}</b></div>
      </div>
      {state.ps.map((p, i) => (
        p.bet > 0 && <span key={`b${i}`} className="bet tnum" style={betPlace(i)}>{chips(p.bet)}</span>
      ))}
      {state.ps.map((p, i) => {
        const cards = hand.seats[i].cards ?? [];
        const show = i === hand.hero || (reveal && !p.folded);
        const Tag = onSeat ? 'button' : 'div';
        return (
          <Tag key={i} type={onSeat ? 'button' : undefined} onClick={onSeat ? () => onSeat(i) : undefined}
            aria-label={onSeat ? `${pos[i]} : faire passer les joueurs avant lui` : undefined}
            className={`seat ${i === hand.hero ? 'hero' : ''} ${p.folded ? 'folded' : ''} ${state.toAct === i ? 'toact' : ''} ${last === i ? 'last' : ''}`}
            style={place(i)}>
            <span className="seat-cards">
              {p.folded ? null : show && cards.length ? cards.map(c => <CardFace key={c} c={c} size="xs" />) : <><CardBack size="xs" /><CardBack size="xs" /></>}
            </span>
            <span className="seat-name">{pos[i]}{i === btn && <span className="dealer" title="Bouton">D</span>}</span>
            <span className="seat-stack tnum">{p.allin && !p.folded ? 'Tapis' : bbs(p.stack, bb)}</span>
          </Tag>
        );
      })}
    </div>
  );
}
