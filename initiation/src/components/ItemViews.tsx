import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Answer, ChoiceItem, CustomItem, EstimateItem, Item, MatchItem, MultiItem, NumberItem, OrderItem, PickItem, SeatItem,
} from '../content/types';
import { type Card, cardLabel, shuffle } from '../lib/cards';
import { PCard } from './Cards';
import { PokerTable } from './PokerTable';

export interface ViewProps<I> {
  item: I;
  result: Answer | null;
  onAnswer: (a: Answer) => void;
}

export function ItemView({ item, result, onAnswer }: ViewProps<Item>) {
  switch (item.kind) {
    case 'choice': return <ChoiceView item={item} result={result} onAnswer={onAnswer} />;
    case 'multi': return <MultiView item={item} result={result} onAnswer={onAnswer} />;
    case 'pick': return <PickView item={item} result={result} onAnswer={onAnswer} />;
    case 'order': return <OrderView item={item} result={result} onAnswer={onAnswer} />;
    case 'seats': return <SeatView item={item} result={result} onAnswer={onAnswer} />;
    case 'number': return <NumberView item={item} result={result} onAnswer={onAnswer} />;
    case 'estimate': return <EstimateView item={item} result={result} onAnswer={onAnswer} />;
    case 'match': return <MatchView item={item} result={result} onAnswer={onAnswer} />;
    case 'custom': return <CustomView item={item} result={result} onAnswer={onAnswer} />;
  }
}

// ── QCM ────────────────────────────────────────────────────────────────────

function accepted(item: ChoiceItem): number[] {
  if (item.answer === null) return [];
  return Array.isArray(item.answer) ? item.answer : [item.answer];
}

function ChoiceView({ item, result, onAnswer }: ViewProps<ChoiceItem>) {
  const [chosen, setChosen] = useState<number | null>(null);
  const ok = accepted(item);
  const cols = item.columns ?? (item.options.length <= 3 && item.options.every(o => o.length < 14) ? (item.options.length as 1 | 2 | 3) : 1);
  const choose = (i: number) => {
    if (result) return;
    setChosen(i);
    onAnswer({
      correct: item.answer === null ? null : ok.includes(i),
      answer: item.options[i],
      expected: ok.length ? item.options[ok[0]] : undefined,
    });
  };
  return (
    <div className={`options ${cols === 2 ? 'c2' : cols === 3 ? 'c3' : ''}`}>
      {item.options.map((o, i) => {
        let cls = 'opt';
        if (result) {
          if (item.silent || item.answer === null) { if (i === chosen || o === result.answer) cls += ' sel'; }
          else if (ok.includes(i)) cls += ' right';
          else if (i === chosen || o === result.answer) cls += ' wrong';
        }
        return <button key={i} className={cls} disabled={!!result} onClick={() => choose(i)}>{o}</button>;
      })}
    </div>
  );
}

// ── Choix multiples ────────────────────────────────────────────────────────

function MultiView({ item, result, onAnswer }: ViewProps<MultiItem>) {
  const [sel, setSel] = useState<number[]>([]);
  const [err, setErr] = useState('');
  const toggle = (i: number) => { if (result) return; setErr(''); setSel(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i])); };
  const submit = () => {
    if (sel.length === 0) { setErr('Coche au moins une case.'); return; }
    const good = sel.length === item.answers.length && sel.every(i => item.answers.includes(i));
    onAnswer({
      correct: good,
      answer: sel.sort((a, b) => a - b).map(i => item.options[i]).join(', '),
      expected: item.answers.map(i => item.options[i]).join(', '),
    });
  };
  return (
    <div className="stack">
      <div className="options c2">
        {item.options.map((o, i) => {
          let cls = 'opt';
          const isSel = sel.includes(i);
          if (result) {
            if (item.answers.includes(i)) cls += isSel ? ' right' : ' sel';
            else if (isSel) cls += ' wrong';
          } else if (isSel) cls += ' sel';
          return <button key={i} className={cls} disabled={!!result} onClick={() => toggle(i)}>{isSel ? '☑ ' : '☐ '}{o}</button>;
        })}
      </div>
      {result && <p className="muted">Cases bleues : bonnes réponses que tu n’avais pas cochées.</p>}
      {!result && <div className="row"><button className="btn primary" onClick={submit}>Valider</button>{err && <span className="err">{err}</span>}</div>}
    </div>
  );
}

// ── Choix de cartes ────────────────────────────────────────────────────────

/** Paquet rangé en 4 lignes (une par enseigne), de l'As au 2. */
const DECK_ORDER: Card[] = [...'shdc'].flatMap(s => [...'AKQJT98765432'].map(r => r + s));

function PickView({ item, result, onAnswer }: ViewProps<PickItem>) {
  const [sel, setSel] = useState<Card[]>([]);
  const [err, setErr] = useState('');
  const toggle = (c: Card) => {
    if (result) return;
    setErr('');
    setSel(s => {
      if (s.includes(c)) return s.filter(x => x !== c);
      if (typeof item.count === 'number' && s.length >= item.count) return s;
      return [...s, c];
    });
  };
  const submit = () => {
    if (typeof item.count === 'number' && sel.length !== item.count) { setErr(`Choisis ${item.count} cartes (${sel.length} pour l’instant).`); return; }
    const good = item.check(sel);
    onAnswer({
      correct: good,
      answer: sel.length ? sel.map(cardLabel).join(' ') : 'aucune carte',
      expected: item.solution.map(cardLabel).join(' '),
    });
  };
  const stateOf = (c: Card): 'good' | 'bad' | undefined => {
    if (!result) return undefined;
    if (item.solution.includes(c)) return 'good';
    if (sel.includes(c)) return 'bad';
    return undefined;
  };
  const isDeck = item.layout === 'deck';
  return (
    <div className="stack">
      {item.fixed?.map(f => (
        <div key={f.label} className="row" style={{ justifyContent: 'center' }}>
          <span className="muted">{f.label}</span>
          {f.cards.map(c => <PCard key={c} c={c} size="sm" />)}
        </div>
      ))}
      {(item.groups ?? [{ label: '', cards: item.pool }]).map(g => (
        <div key={g.label} className="stack" style={{ gap: 4 }}>
          {g.label && <span className="muted small center">{g.label}</span>}
          <div className={isDeck ? 'deck-grid' : 'cards-row'}>
            {(isDeck ? DECK_ORDER : g.cards).map(c => (!isDeck || g.cards.includes(c)) ? (
              <PCard key={c} c={c} size={isDeck ? 'md' : 'lg'} sel={!result && sel.includes(c)} state={stateOf(c)}
                dim={!!result && !item.solution.includes(c) && !sel.includes(c)} onClick={result ? undefined : () => toggle(c)} />
            ) : <span key={c} className="pcard empty" aria-hidden="true" />)}
          </div>
        </div>
      ))}
      {!result && (
        <div className="row wrap">
          <button className="btn primary" onClick={submit}>Valider{typeof item.count === 'number' ? ` (${sel.length}/${item.count})` : ` (${sel.length})`}</button>
          {sel.length > 0 && <button className="btn ghost sm" onClick={() => setSel([])}>Effacer</button>}
          {err && <span className="err">{err}</span>}
        </div>
      )}
      {result && (
        <p className="muted">
          Contour vert : la bonne sélection.{sel.some(c => !item.solution.includes(c)) ? ' Contour rouge : tes cartes en trop.' : ''}
          {item.describe ? ` Ta sélection : ${item.describe(sel)}.` : ''}
        </p>
      )}
    </div>
  );
}

// ── Remise en ordre ────────────────────────────────────────────────────────

function OrderView({ item, result, onAnswer }: ViewProps<OrderItem>) {
  const shuffled = useMemo(() => {
    let s = shuffle(item.items);
    for (let i = 0; i < 5 && s.every((x, k) => x === item.items[k]); i++) s = shuffle(item.items);
    return s;
  }, [item]);
  const [order, setOrder] = useState<string[]>([]);
  const tap = (x: string) => {
    if (result) return;
    setOrder(o => (o.includes(x) ? o.filter(y => y !== x) : [...o, x]));
  };
  const submit = () => {
    const placed = order.filter((x, i) => item.items[i] === x).length;
    onAnswer({ correct: placed === item.items.length, answer: `${placed}/${item.items.length} bien placés`, expected: item.items.join(' > ') });
  };
  if (result) {
    return (
      <div className="stack">
        <p className="muted">Le bon ordre (ta place entre parenthèses) :</p>
        <div className="order-list">
          {item.items.map((x, i) => {
            const yours = order.indexOf(x);
            return (
              <div key={x} className={`order-item ${yours === i ? 'right' : 'wrong'}`}>
                <span className="rk">{i + 1}</span>
                <span className="grow">{x}{item.notes?.[i] && <span className="muted"> · {item.notes[i]}</span>}</span>
                <span className="muted">({yours + 1})</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="muted">Touche les éléments dans l’ordre. Touche à nouveau pour retirer.</p>
      <div className="order-list">
        {shuffled.map(x => {
          const k = order.indexOf(x);
          return (
            <button key={x} className={`order-item ${k >= 0 ? 'picked' : ''}`} onClick={() => tap(x)}>
              <span className="rk">{k >= 0 ? k + 1 : ''}</span>{x}
            </button>
          );
        })}
      </div>
      <div className="row">
        <button className="btn primary" disabled={order.length !== item.items.length} onClick={submit}>Valider</button>
        {order.length > 0 && <button className="btn ghost sm" onClick={() => setOrder([])}>Recommencer</button>}
      </div>
    </div>
  );
}

// ── Sièges ─────────────────────────────────────────────────────────────────

function SeatView({ item, result, onAnswer }: ViewProps<SeatItem>) {
  const [placed, setPlaced] = useState<number[]>([]);
  const next = item.tokens[placed.length];
  const tap = (i: number) => {
    if (result || placed.length >= item.tokens.length) return;
    const p = [...placed, i];
    setPlaced(p);
    if (p.length === item.tokens.length) {
      const good = p.every((s, k) => s === item.solution[k]);
      onAnswer({
        correct: good,
        answer: p.map((s, k) => `${item.tokens[k]} : ${seatName(item, s)}`).join(' · '),
        expected: item.solution.map((s, k) => `${item.tokens[k]} : ${seatName(item, s)}`).join(' · '),
      });
    }
  };
  const map: Record<number, string[]> = {};
  const state: Record<number, 'good' | 'bad'> = {};
  if (result) {
    item.solution.forEach((s, k) => { (map[s] ??= []).push(item.tokens[k]); state[s] = 'good'; });
    placed.forEach((s, k) => { if (s !== item.solution[k] && !item.solution.includes(s)) state[s] = 'bad'; });
  } else {
    placed.forEach((s, k) => { (map[s] ??= []).push(item.tokens[k]); });
  }
  return (
    <div className="stack">
      {!result && next && (
        <p className="muted center">
          Touche le siège pour <span className="token x-t" style={{ margin: '0 4px' }}>{next}</span>
          {item.tokens.length > 1 && `(${placed.length + 1}/${item.tokens.length})`}
        </p>
      )}
      <PokerTable spec={item.table} onSeat={result ? undefined : tap} placed={map} seatState={result ? state : undefined} />
      {!result && placed.length > 0 && <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => setPlaced([])}>Recommencer</button>}
      {result && <p className="muted center">En vert : la bonne réponse.{Object.values(state).includes('bad') ? ' En rouge : tes erreurs.' : ''}</p>}
    </div>
  );
}
function seatName(item: SeatItem, s: number) {
  return item.table.labels?.[s] ?? `siège ${s + 1}`;
}

// ── Nombre ─────────────────────────────────────────────────────────────────

function NumberView({ item, result, onAnswer }: ViewProps<NumberItem>) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const submit = () => {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    if (v.trim() === '' || !Number.isFinite(n)) { setErr('Entre un nombre.'); return; }
    const good = Math.abs(n - item.answer) <= (item.tolerance ?? 0);
    onAnswer({ correct: good, answer: `${fmt(n)}${item.unit ? ' ' + item.unit : ''}`, expected: `${fmt(item.answer)}${item.unit ? ' ' + item.unit : ''}` });
  };
  return (
    <div className="stack">
      <div className="row wrap">
        <input ref={ref} className="num-input" inputMode="decimal" value={v} disabled={!!result} placeholder={item.placeholder ?? '?'}
          onChange={e => { setV(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && !result && submit()} aria-label="Ta réponse" />
        {item.unit && <span className="muted">{item.unit}</span>}
        {!result && <button className="btn primary" onClick={submit}>Valider</button>}
      </div>
      {err && <span className="err">{err}</span>}
    </div>
  );
}
export function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

// ── Estimation au curseur ──────────────────────────────────────────────────

function EstimateView({ item, result, onAnswer }: ViewProps<EstimateItem>) {
  const mid = Math.round((item.min + item.max) / 2 / item.step) * item.step;
  const [v, setV] = useState(mid);
  const [touched, setTouched] = useState(false);
  const [sim, setSim] = useState<{ done: number; f: number } | null>(null);
  const submit = () => {
    const good = Math.abs(v - item.answer) <= item.tolerance;
    onAnswer({ correct: good, answer: `${fmt(v)} ${item.unit}`, expected: `${fmt(item.answer)} ${item.unit}` });
    if (item.simulate) {
      let k = 0, acc = 0;
      const tick = () => {
        acc += item.simulate!();
        k++;
        setSim({ done: k, f: acc / k });
        if (k < 10) setTimeout(tick, 90);
      };
      tick();
    }
  };
  return (
    <div className="stack">
      <div className="row">
        <input type="range" min={item.min} max={item.max} step={item.step} value={v} disabled={!!result}
          onChange={e => { setV(Number(e.target.value)); setTouched(true); }} aria-label="Ton estimation" />
        <span className="chip-big" style={{ fontSize: '1.3rem', minWidth: 80, textAlign: 'right' }}>{fmt(v)} {item.unit}</span>
      </div>
      {!result && (
        <div className="row">
          <button className="btn primary" onClick={submit}>{touched ? 'Valider mon estimation' : 'Valider'}</button>
          {!touched && <span className="muted small">Déplace le curseur.</span>}
        </div>
      )}
      {result && sim && (
        <div className="scene">
          <div className="row between"><span className="muted">{item.simLabel ?? 'Simulation'} · {sim.done * 10} %</span><strong>{fmt(Math.round(sim.f * 1000) / 10)} %</strong></div>
          <div className="hbar mt"><div style={{ width: `${Math.min(100, sim.f * 100)}%` }} /></div>
        </div>
      )}
    </div>
  );
}

// ── Association ────────────────────────────────────────────────────────────

function MatchView({ item, result, onAnswer }: ViewProps<MatchItem>) {
  const left = useMemo(() => shuffle(item.pairs.map(p => p[0])), [item]);
  const right = useMemo(() => shuffle(item.pairs.map(p => p[1])), [item]);
  const [selL, setSelL] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [errors, setErrors] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const tapR = (d: string) => {
    if (!selL || result) return;
    const ok = item.pairs.some(([a, b]) => a === selL && b === d);
    if (ok) {
      const nd = [...done, selL];
      setDone(nd); setSelL(null);
      if (nd.length === item.pairs.length) onAnswer({ correct: errors <= 1, answer: `${errors} erreur${errors > 1 ? 's' : ''}`, expected: 'au plus 1 erreur' });
    } else {
      setErrors(e => e + 1); setShake(d); setTimeout(() => setShake(null), 450);
    }
  };
  const doneDefs = item.pairs.filter(p => done.includes(p[0])).map(p => p[1]);
  return (
    <div className="stack">
      <p className="muted">Touche un mot, puis sa définition. Erreurs : {errors}</p>
      <div className="match-grid">
        <div className="match-col">
          {left.map(t => (
            <button key={t} className={`match-btn ${done.includes(t) ? 'done' : selL === t ? 'sel' : ''}`}
              onClick={() => !done.includes(t) && setSelL(t)}>{t}</button>
          ))}
        </div>
        <div className="match-col">
          {right.map(d => (
            <button key={d} className={`match-btn ${doneDefs.includes(d) ? 'done' : shake === d ? 'shake' : ''}`} onClick={() => !doneDefs.includes(d) && tapR(d)}>{d}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Interaction sur mesure ─────────────────────────────────────────────────

function CustomView({ item, result, onAnswer }: ViewProps<CustomItem>) {
  return <>{item.render(a => { if (!result) onAnswer(a); })}</>;
}
