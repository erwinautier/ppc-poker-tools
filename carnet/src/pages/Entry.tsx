/**
 * Saisie guidée, au calme : la table (tapis, cartes), puis chaque action dans l'ordre de parole.
 * Le pot, les tapis restants et la cote se calculent seuls ; le board se pose au début de chaque tour.
 */
import { useMemo, useState } from 'react';
import { CardPicker } from '../components/Cards';
import { ContextEditor, CtxBar } from '../components/ContextEditor';
import { StreetLog, outcome } from '../components/Replayer';
import { PokerTable } from '../components/Table';
import { AmountInput, Chips, Icon, useConfirm, useToast } from '../components/ui';
import type { Card } from '../lib/cards';
import {
  BOARD_AT, apply, boardMissing, minTotal, positions, potOdds, potOf, sizes, toCall,
  type Action, type State,
} from '../lib/engine';
import { bbs, chips, pct } from '../lib/format';
import { MAX_QUESTIONS, replayOf, seatName, toggleDecision, type Hand } from '../lib/hand';
import { go } from '../lib/router';
import { getHand, resizeTable, saveHand } from '../lib/store';

const STREET_NAME = ['', 'Le flop', 'Le turn', 'La river'];

function usedCards(h: Hand): Set<Card> {
  return new Set([...h.board, ...h.seats.flatMap(s => s.cards ?? [])]);
}

export function Entry({ id }: { id: string }) {
  const [h, setH] = useState<Hand | null>(() => getHand(id));
  const [phase, setPhase] = useState<'setup' | 'play'>(() => (h && (h.actions.length || h.complete) ? 'play' : 'setup'));
  const [ctxOpen, setCtxOpen] = useState(false);
  const confirm = useConfirm();

  if (!h) return <div className="card empty"><b>Main introuvable</b><a href="#/">Retour au carnet</a></div>;
  const update = (next: Hand) => { setH(next); saveHand(next); };

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <a className="crumb" href={`#/main/${h.id}`}><Icon name="back" size={15} />La main</a>
          <h1>Déroulé de la main</h1>
        </div>
        {phase === 'play' && (
          <button className="btn sm" onClick={async () => {
            if (h.actions.length && !(await confirm({ title: 'Modifier la table ?', text: 'Changer les tapis ou les positions efface les actions déjà saisies.', ok: 'Modifier la table', danger: true }))) return;
            update({ ...h, actions: [], decisions: [], winners: [], complete: false });
            setPhase('setup');
          }}><Icon name="edit" size={15} />Table</button>
        )}
      </div>
      {h.note && <p className="note"><b>Ta note :</b> {h.note}</p>}
      {phase === 'setup'
        ? <Setup h={h} update={update} onCtx={() => setCtxOpen(true)} onStart={() => setPhase('play')} />
        : <Play h={h} update={update} />}
      {ctxOpen && <ContextEditor ctx={h.ctx} onClose={() => setCtxOpen(false)}
        onSave={c => update(c.table !== h.seats.length ? resizeTable({ ...h, ctx: c }, c.table) : { ...h, ctx: { ...c, table: h.seats.length } })} />}
    </div>
  );
}

// ── La table ─────────────────────────────────────────────────────────────────

function Setup({ h, update, onCtx, onStart }: { h: Hand; update: (h: Hand) => void; onCtx: () => void; onStart: () => void }) {
  const toast = useToast();
  const n = h.seats.length;
  const pos = positions(n);
  const bb = h.ctx.blinds.bb;
  const hero = h.seats[h.hero];
  const moveHero = (j: number) => {
    if (j === h.hero) return;
    const seats = h.seats.map(s => ({ stack: s.stack }));
    seats[h.hero] = { stack: h.seats[j].stack };
    seats[j] = { ...hero };
    update({ ...h, seats, hero: j });
  };
  const setStack = (i: number, v: number) => update({ ...h, seats: h.seats.map((s, j) => (j === i ? { ...s, stack: v } : s)) });
  return (
    <>
      <CtxBar ctx={{ ...h.ctx, table: n }} onEdit={onCtx} />
      <section className="stack sm">
        <span className="field-label">Ma position</span>
        <Chips label="Ma position" value={h.hero} onChange={moveHero} items={pos.map((p, i) => ({ value: i, label: p }))} />
      </section>
      <section className="stack sm">
        <span className="field-label">Mes cartes</span>
        <CardPicker label="Mes cartes" value={hero.cards ?? []} count={2} used={usedCards(h)}
          onChange={cards => update({ ...h, seats: h.seats.map((s, i) => (i === h.hero ? { stack: s.stack, ...(cards.length ? { cards } : {}) } : s)) })} />
      </section>
      <section className="card stack sm">
        <div className="row between">
          <h2>Tapis au début de la main</h2>
          <button className="btn sm" onClick={() => update({ ...h, seats: h.seats.map((s, i) => (i === h.hero ? s : { stack: hero.stack })) })}>Tous comme moi</button>
        </div>
        <p className="muted">Ceux des adversaires qui jouent le coup comptent pour les tapis et la cote. Les autres peuvent rester tels quels.</p>
        <div className="stacks">
          {h.seats.map((s, i) => (
            <label key={i} className={`stackrow ${i === h.hero ? 'hero' : ''}`}>
              <b>{pos[i]}{i === h.hero ? ' (moi)' : ''}</b>
              <AmountInput value={s.stack} min={1} onChange={v => v && setStack(i, v)} label={`Tapis ${pos[i]}`} />
              <span className="muted tnum">{bbs(s.stack, bb)}</span>
            </label>
          ))}
        </div>
      </section>
      <button className="btn primary big block" onClick={() => {
        if (h.seats.some(s => !s.stack || s.stack < 1)) { toast('Chaque tapis doit valoir au moins 1 jeton.', 'error'); return; }
        onStart();
      }}>Commencer le déroulé<Icon name="next" /></button>
    </>
  );
}

// ── Les actions ──────────────────────────────────────────────────────────────

function Play({ h, update }: { h: Hand; update: (h: Hand) => void }) {
  const toast = useToast();
  const r = useMemo(() => replayOf(h), [h]);
  const s = r.states.at(-1)!;
  const bb = h.ctx.blinds.bb;
  const missing = boardMissing(s, h.board.length);
  const [ask, setAsk] = useState(false);
  const used = usedCards(h);
  const visible = s.over && s.won === null ? h.board : h.board.slice(0, BOARD_AT[s.street]);

  const add = (list: Action[]) => {
    let st: State = s;
    for (const a of list) {
      const next = apply(st, a, bb);
      if (typeof next === 'string') { toast(next, 'error'); return; }
      st = next;
    }
    const heroAt = list.findIndex(a => a.p === h.hero);
    const decisions = ask && heroAt >= 0 ? toggleDecision(h.decisions, h.actions.length + heroAt) : h.decisions;
    if (ask && heroAt >= 0) setAsk(false);
    update({ ...h, actions: [...h.actions, ...list], decisions, complete: false });
  };
  const undo = () => {
    if (!h.actions.length) return;
    const n = h.actions.length - 1;
    update({ ...h, actions: h.actions.slice(0, n), decisions: h.decisions.filter(d => d < n), winners: [], complete: false });
  };
  // Toucher un siège : tous ceux qui parlent avant lui passent (ou checkent), jamais le héros.
  const foldTo = (j: number) => {
    if (s.over || s.toAct === null || j === s.toAct || missing.count) return;
    const list: Action[] = [];
    let st: State = s;
    while (st.toAct !== null && st.toAct !== j && st.street === s.street) {
      if (st.toAct === h.hero) { toast('C\'est d\'abord à toi de parler.', 'error'); break; }
      const a: Action = { p: st.toAct, k: st.current > st.ps[st.toAct].bet ? 'fold' : 'check' };
      const next = apply(st, a, bb);
      if (typeof next === 'string') break;
      list.push(a);
      st = next;
    }
    if (st.toAct !== j && st.toAct !== h.hero) { toast(`${seatName(h, j)} ne parle plus dans ce tour.`, 'error'); return; }
    if (list.length) add(list);
  };

  return (
    <>
      <PokerTable hand={h} state={s} board={visible} last={h.actions.at(-1)?.p ?? null} reveal={s.over} onSeat={foldTo} />
      {!s.over && !missing.count && s.toAct !== null && s.street === 0 && h.actions.length < 2 && (
        <p className="muted center-text">Astuce : touche un siège pour faire passer tous les joueurs qui parlent avant lui.</p>
      )}

      {!s.over && missing.count > 0 && (
        <section className="card stack sm">
          <h2>{STREET_NAME[s.street]}</h2>
          <CardPicker label={STREET_NAME[s.street]} count={BOARD_AT[s.street] - BOARD_AT[s.street - 1]}
            value={h.board.slice(BOARD_AT[s.street - 1], BOARD_AT[s.street])} used={used}
            onChange={cards => update({ ...h, board: [...h.board.slice(0, BOARD_AT[s.street - 1]), ...cards] })} />
        </section>
      )}

      {!s.over && !missing.count && s.toAct !== null && (
        <ActionPanel h={h} s={s} ask={ask} setAsk={setAsk} onAction={a => add([a])} />
      )}

      {s.over && <EndPanel h={h} s={s} update={update} />}

      <div className="row between">
        <button className="btn sm" onClick={undo} disabled={!h.actions.length}><Icon name="undo" size={15} />Annuler la dernière action</button>
        <span className="muted tnum">{h.actions.length} action{h.actions.length > 1 ? 's' : ''}</span>
      </div>
      <StreetLog hand={h} upto={h.actions.length} />
    </>
  );
}

function ActionPanel({ h, s, ask, setAsk, onAction }: { h: Hand; s: State; ask: boolean; setAsk: (v: boolean) => void; onAction: (a: Action) => void }) {
  const i = s.toAct!;
  const p = s.ps[i];
  const bb = h.ctx.blinds.bb;
  const call = toCall(s);
  const odds = potOdds(s);
  const list = sizes(s, bb);
  const kind = s.current === 0 ? 'bet' : 'raise';
  const min = minTotal(s, bb);
  const max = p.bet + p.stack;
  const [custom, setCustom] = useState<number | null>(null);
  const isHero = i === h.hero;
  const asked = h.decisions.length;
  const full = asked >= MAX_QUESTIONS;
  return (
    <section className={`card stack sm actpanel ${isHero ? 'hero' : ''}`}>
      <div className="row between">
        <h2>{seatName(h, i)} parle</h2>
        <span className="muted tnum">{chips(p.stack)} · {bbs(p.stack, bb)}</span>
      </div>
      <p className="muted tnum">
        Pot {chips(potOf(s))}{call > 0 ? ` · ${chips(call)} à payer · cote ${pct(odds ?? 0)}` : ''}
      </p>
      <div className="acts">
        {call > 0
          ? <><button className="btn big" onClick={() => onAction({ p: i, k: 'fold' })}>Passe</button>
            <button className="btn big primary" onClick={() => onAction({ p: i, k: 'call' })}>Suit {chips(Math.min(s.current, max))}{call >= p.stack ? ' (tapis)' : ''}</button></>
          : <button className="btn big primary" onClick={() => onAction({ p: i, k: 'check' })}>Parole</button>}
      </div>
      {list.length > 0 && (
        <>
          <span className="field-label">{kind === 'bet' ? 'Mise' : 'Relance à'}</span>
          <div className="sizes">
            {list.map(z => (
              <button key={z.label} className={`size ${z.allin ? 'allin' : ''}`} onClick={() => onAction({ p: i, k: kind, to: z.to })}>
                <b>{z.label}</b><span className="tnum">{chips(z.to)}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <div style={{ flex: 1 }}><AmountInput value={custom} min={1} onChange={setCustom} label="Autre montant" placeholder={`Autre (${chips(min)} min.)`} /></div>
            <button className="btn" disabled={!custom || (custom < min && custom < max)}
              onClick={() => { if (custom) { onAction({ p: i, k: kind, to: Math.min(custom, max) }); setCustom(null); } }}>
              {kind === 'bet' ? 'Miser' : 'Relancer'}
            </button>
          </div>
        </>
      )}
      {isHero && (
        <label className="switch">
          <input type="checkbox" checked={ask} disabled={full && !ask} onChange={e => setAsk(e.target.checked)} />
          <span className="track" />
          <span className="switch-text">C'est ici que j'ai hésité<small>{full
            ? `Déjà ${MAX_QUESTIONS} questions dans cette main : c'est le maximum.`
            : `La main partagée s'arrêtera là pour demander « Et toi, tu fais quoi ? ».${asked ? ` Déjà ${asked} question${asked > 1 ? 's' : ''} plus tôt dans la main : elles seront posées dans l'ordre.` : ''}`}</small></span>
        </label>
      )}
    </section>
  );
}

function EndPanel({ h, s, update }: { h: Hand; s: State; update: (h: Hand) => void }) {
  const pos = positions(h.seats.length);
  const used = usedCards(h);
  const live = s.ps.flatMap((p, i) => (p.folded ? [] : [i]));
  const from = BOARD_AT[s.street];
  const runout = s.won === null && from < 5;
  return (
    <section className="card stack sm">
      <h2>Fin de la main</h2>
      {s.won !== null ? <p>{outcome(h, s)}</p> : (
        <>
          {runout && (
            <div className="stack sm">
              <span className="field-label">Board jusqu'à la river (facultatif)</span>
              <CardPicker label="Board" count={5 - from} value={h.board.slice(from)} used={used}
                onChange={cards => update({ ...h, board: [...h.board.slice(0, from), ...cards] })} />
            </div>
          )}
          {live.filter(i => i !== h.hero).map(i => (
            <div key={i} className="stack sm">
              <span className="field-label">Cartes de {pos[i]} (facultatif)</span>
              <CardPicker label={`Cartes de ${pos[i]}`} count={2} value={h.seats[i].cards ?? []} used={used}
                onChange={cards => update({ ...h, seats: h.seats.map((x, j) => (j === i ? { stack: x.stack, ...(cards.length ? { cards } : {}) } : x)) })} />
            </div>
          ))}
          <span className="field-label">Qui remporte le pot de {chips(potOf(s))} ?</span>
          <Chips label="Gagnants" multi value={h.winners}
            onChange={w => update({ ...h, winners: h.winners.includes(w) ? h.winners.filter(x => x !== w) : [...h.winners, w].sort((a, b) => a - b) })}
            items={live.map(i => ({ value: i, label: seatName(h, i) }))} />
        </>
      )}
      <button className="btn primary big block" onClick={() => { update({ ...h, complete: true }); go(`#/main/${h.id}`); }}>
        <Icon name="check" />Enregistrer la main
      </button>
    </section>
  );
}
