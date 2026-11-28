/** Rejouer une main pas à pas : table, commandes, et le déroulé écrit tour par tour. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BOARD_AT, STREETS, potOdds, potOf, tell, toCall, type State } from '../lib/engine';
import { chips, pct } from '../lib/format';
import { actionText, lineText, replayOf, seatName, story, type HandData } from '../lib/hand';
import { CardRow } from './Cards';
import { PokerTable } from './Table';
import { Icon } from './ui';

export function outcome(hand: HandData, s: State): string | null {
  if (!s.over) return null;
  if (s.won !== null) return `${seatName(hand, s.won)} remporte ${chips(potOf(s))}.`;
  if (hand.winners.length) return `${hand.winners.map(i => seatName(hand, i)).join(' et ')} ${hand.winners.length > 1 ? 'partagent' : 'remporte'} ${chips(potOf(s))}.`;
  return `Abattage pour ${chips(potOf(s))}.`;
}

export function Replayer({ hand, limit, startAt = 'start', footer }: {
  hand: HandData;
  /** Dernière étape montrée (la question en cours, tant que la suite est cachée). Quand elle recule
   *  après une réponse, le rejoueur avance seul jusqu'à la question suivante ou la fin. */
  limit?: number;
  startAt?: 'start' | 'end';
  footer?: ReactNode;
}) {
  const r = useMemo(() => replayOf(hand), [hand]);
  const end = r.states.length - 1;
  const max = Math.min(limit ?? end, end);
  const [f, setF] = useState(startAt === 'end' ? max : 0);
  const [playing, setPlaying] = useState(false);
  const shown = useRef({ max, f });
  shown.current.f = f;
  useEffect(() => {
    const before = shown.current;
    if (max > before.max && before.f === before.max) setPlaying(true);
    else setF(x => Math.min(x, max));
    shown.current = { max, f: Math.min(before.f, max) };
  }, [max]);
  useEffect(() => {
    if (!playing) return;
    if (f >= max) { setPlaying(false); return; }
    const t = setTimeout(() => setF(x => Math.min(max, x + 1)), 1100);
    return () => clearTimeout(t);
  }, [playing, f, max]);

  const s = r.states[f];
  const board = s.over && s.won === null ? hand.board : hand.board.slice(0, BOARD_AT[s.street]);
  const a = f > 0 ? hand.actions[f - 1] : null;
  const caption = a ? `${seatName(hand, a.p)} ${actionText(tell(r.states[f - 1], a))}` : 'Antes et blindes posées';
  const odds = potOdds(s);
  const info = s.over
    ? (f === end ? outcome(hand, s) : null)
    : s.toAct !== null
      ? (odds !== null ? `${seatName(hand, s.toAct)} : ${chips(toCall(s))} à payer, cote ${pct(odds)}` : `À ${seatName(hand, s.toAct)} de parler`)
      : null;

  return (
    <div className="replayer">
      <PokerTable hand={hand} state={s} board={board} last={a?.p ?? null} reveal={s.over && f === end} />
      <div className="caption" aria-live="polite">
        <span className="street">{s.over && f === end ? (s.won === null ? 'Abattage' : 'Fin de la main') : STREETS[s.street]}</span>
        <b>{caption}</b>
        {s.returned && <span className="muted">{seatName(hand, s.returned.p)} récupère {chips(s.returned.amount)} non suivis.</span>}
        {info && <span className={s.over ? 'result' : 'odds'}>{info}</span>}
      </div>
      <div className="controls">
        <button className="iconbtn" onClick={() => { setPlaying(false); setF(0); }} disabled={f === 0} aria-label="Début"><Icon name="first" /></button>
        <button className="iconbtn" onClick={() => { setPlaying(false); setF(Math.max(0, f - 1)); }} disabled={f === 0} aria-label="Action précédente"><Icon name="prev" /></button>
        <button className="iconbtn big" onClick={() => { if (f >= max) setF(0); setPlaying(p => !p); }} aria-label={playing ? 'Pause' : 'Lecture'}><Icon name={playing ? 'pause' : 'play'} size={22} /></button>
        <button className="iconbtn" onClick={() => { setPlaying(false); setF(Math.min(max, f + 1)); }} disabled={f >= max} aria-label="Action suivante"><Icon name="next" /></button>
        <button className="iconbtn" onClick={() => { setPlaying(false); setF(max); }} disabled={f >= max} aria-label="Fin"><Icon name="last" /></button>
        <span className="muted tnum step">{f}/{max}</span>
      </div>
      {footer}
      <StreetLog hand={hand} upto={max} current={f - 1} onJump={i => { setPlaying(false); setF(i + 1); }} />
    </div>
  );
}

type Item = ReturnType<typeof story>[number]['items'][number];
/** Abandons d'affilée : une seule ligne. */
function groupFolds(items: Item[]): Item[][] {
  const out: Item[][] = [];
  for (const it of items) {
    const g = out.at(-1);
    if (it.k === 'fold' && g && g[0].k === 'fold') g.push(it);
    else out.push([it]);
  }
  return out;
}

/** Le déroulé écrit ; une action touchée y ramène le rejoueur. */
export function StreetLog({ hand, upto, current, onJump }: { hand: HandData; upto: number; current?: number; onJump?: (i: number) => void }) {
  const lines = useMemo(() => story(hand, replayOf(hand), upto), [hand, upto]);
  if (!lines.length) return null;
  return (
    <ol className="log">
      {lines.map(line => (
        <li key={line.street}>
          <div className="log-head">
            <b>{STREETS[line.street]}</b>
            {line.street > 0 && <CardRow cards={line.board.slice(BOARD_AT[line.street - 1])} size="xs" />}
            {line.street > 0 && <span className="muted tnum">pot {chips(line.pot)}</span>}
          </div>
          {onJump ? (
            <div className="log-items">
              {groupFolds(line.items).map(g => {
                const lastIt = g.at(-1)!;
                const on = current !== undefined && g.some(it => it.index === current);
                const text = g.length > 1
                  ? `${g.slice(0, -1).map(it => seatName(hand, it.p)).join(', ')} et ${seatName(hand, lastIt.p)} passent`
                  : `${seatName(hand, lastIt.p)} ${lastIt.text}`;
                return (
                  <button key={lastIt.index} type="button" className={`log-item ${lastIt.k === 'fold' ? 'fold' : ''} ${on ? 'on' : ''} ${g.length === 1 && lastIt.p === hand.hero ? 'hero' : ''}`} onClick={() => onJump(lastIt.index)}>
                    {text}
                  </button>
                );
              })}
            </div>
          ) : <p>{lineText(hand, line)}</p>}
        </li>
      ))}
    </ol>
  );
}
