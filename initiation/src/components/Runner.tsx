import { useEffect, useRef, useState } from 'react';
import type { Answer, Item } from '../content/types';
import { ItemView } from './ItemViews';

export interface RunResult { item: Item; answer: Answer }

interface Props {
  items: Item[];
  mode: 'defi' | 'training';
  timed?: boolean;
  onFinish: (results: RunResult[], seconds: number) => void;
}

/** Enchaîne les situations d'un défi ou d'un entraînement, avec correction après chaque réponse. */
export function Runner({ items, mode, timed, onFinish }: Props) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<(Answer | null)[]>(() => items.map(() => null));
  const start = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [timed]);

  const item = items[i];
  const res = results[i];
  const last = i === items.length - 1;

  const answer = (a: Answer) => setResults(r => r.map((x, k) => (k === i ? a : x)));
  const next = () => {
    if (last) {
      onFinish(items.map((it, k) => ({ item: it, answer: results[k]! })), Math.round((Date.now() - start.current) / 1000));
      return;
    }
    setI(i + 1);
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="stack" ref={topRef} style={{ scrollMarginTop: 12 }}>
      <div className="runner-top">
        <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{mode === 'defi' ? 'Situation' : 'Exercice'} {i + 1} / {items.length}</span>
        <div className="dots" aria-hidden="true">
          {items.map((it, k) => {
            const r = results[k];
            let cls = '';
            if (r) cls = it.silent || r.correct === null ? 'done' : r.correct ? 'ok' : 'ko';
            else if (k === i) cls = 'cur';
            return <span key={k} className={cls} />;
          })}
        </div>
        {timed && <span className="pill">{Math.round((now - start.current) / 1000)} s</span>}
      </div>

      <div className="card stack" key={item.id}>
        <div className="prompt">{item.prompt}</div>
        {item.scene && <div>{item.scene}</div>}
        <ItemView item={item} result={res} onAnswer={answer} />
        {res && <Feedback item={item} res={res} mode={mode} />}
        {res && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={next}>{last ? (mode === 'defi' ? 'Terminer le défi' : 'Voir mon score') : 'Suivante →'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Feedback({ item, res, mode }: { item: Item; res: Answer; mode: 'defi' | 'training' }) {
  if (item.silent) {
    return <div className="feedback neutral"><div className="verdict">Réponse notée</div>On en reparle au bilan.</div>;
  }
  let cls = 'neutral', verdict = 'Noté';
  if (res.correct === true) { cls = 'ok'; verdict = mode === 'defi' ? 'Bien vu !' : 'Bonne réponse'; }
  if (res.correct === false) { cls = 'ko'; verdict = mode === 'defi' ? 'Pas tout à fait…' : 'Ce n’est pas ça'; }
  return (
    <div className={`feedback ${cls}`}>
      <div className="verdict">{verdict}</div>
      {res.correct === false && res.expected && item.kind !== 'pick' && item.kind !== 'order' && item.kind !== 'seats' && item.kind !== 'multi' && (
        <div>Réponse attendue : <strong>{res.expected}</strong></div>
      )}
      {item.feedback && <div style={{ marginTop: 4 }}>{item.feedback}</div>}
    </div>
  );
}
