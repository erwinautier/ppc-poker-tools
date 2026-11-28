/** Une main reçue par lien : ses questions d'abord, une à une, puis toute la main. */
import { useEffect, useState } from 'react';
import { Replayer } from '../components/Replayer';
import { Icon, useToast } from '../components/ui';
import { STREETS } from '../lib/engine';
import { heroLine, ctxText, type HandData } from '../lib/hand';
import { go } from '../lib/router';
import { decodeHand } from '../lib/share';
import { newId, saveHand } from '../lib/store';
import { optionLabel, questionsOf, type Question } from '../lib/vote';
import { Answers } from './ClubPost';

export function Shared({ code }: { code: string }) {
  const toast = useToast();
  const [h, setH] = useState<HandData | null | undefined>(undefined);
  /** Question en cours ; au-delà de la dernière, toute la main est montrée. */
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => { let live = true; void decodeHand(code).then(x => { if (live) setH(x); }); return () => { live = false; }; }, [code]);

  if (h === undefined) return <p className="muted">Ouverture de la main…</p>;
  if (h === null) return (
    <div className="card empty">
      <b>Lien illisible</b>
      <span>Le lien a peut-être été coupé en le copiant. Demande à la personne de te le renvoyer.</span>
      <a href="#/">Ouvrir mon carnet</a>
    </div>
  );

  const qs = questionsOf(h);
  const q = qs[step] as Question | undefined;
  const next = (answer: number | null) => {
    setAnswers(l => { const c = [...l]; c[step] = answer; return c; });
    setPick(null);
    setStep(step + 1);
  };
  const footer = (
    <>
      {qs.slice(0, step).map((x, k) => <Recap key={k} q={x} answer={answers[k] ?? null} many={qs.length > 1} />)}
      {q && (
        <section className="card stack sm question">
          {qs.length > 1 && <span className="field-label">Question {step + 1} sur {qs.length} · {STREETS[q.state.street]}</span>}
          <h2>Et toi, tu fais quoi ?</h2>
          <Answers options={q.options} bb={h.ctx.blinds.bb} value={pick} onChange={setPick} />
          <div className="row">
            <button className="btn primary" disabled={pick === null} onClick={() => next(pick)}>Voir la suite</button>
            <button className="btn ghost" onClick={() => next(null)}>Voir sans répondre</button>
          </div>
          <p className="muted">Ta réponse n'est envoyée nulle part : c'est pour toi.</p>
        </section>
      )}
    </>
  );

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <h1>Main partagée</h1>
          <p>{ctxText(h.ctx)} · {heroLine(h)}</p>
        </div>
      </div>
      <Replayer hand={h} limit={q?.index} startAt={q ? 'end' : 'start'} footer={footer} />
      <button className="btn block" onClick={() => {
        const id = newId();
        saveHand({ ...h, id, updated: Date.now(), note: '' });
        toast('Main ajoutée à ton carnet');
        go(`#/main/${id}`);
      }}><Icon name="plus" />Ajouter à mon carnet</button>
    </div>
  );
}

/** Une question passée : ce qu'a fait le joueur, et ta réponse. */
function Recap({ q, answer, many }: { q: Question; answer: number | null; many: boolean }) {
  if (q.did < 0) return null;
  return (
    <p className="note">
      {many ? `${STREETS[q.state.street]} : le` : 'Le'} joueur a choisi <b>{optionLabel(q.options[q.did])}</b>
      {answer !== null ? <> · ta réponse : <b>{optionLabel(q.options[answer])}</b></> : null}
    </p>
  );
}
