/** Une main reçue par lien : la question d'abord (si elle en pose une), puis toute la main. */
import { useEffect, useState } from 'react';
import { Replayer } from '../components/Replayer';
import { Icon, useToast } from '../components/ui';
import { decisionState, heroLine, ctxText, replayOf, type HandData } from '../lib/hand';
import { go } from '../lib/router';
import { decodeHand } from '../lib/share';
import { newId, saveHand } from '../lib/store';
import { matchOption, optionLabel, voteOptions } from '../lib/vote';
import { Answers } from './ClubPost';

export function Shared({ code }: { code: string }) {
  const toast = useToast();
  const [h, setH] = useState<HandData | null | undefined>(undefined);
  const [answer, setAnswer] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { let live = true; void decodeHand(code).then(x => { if (live) setH(x); }); return () => { live = false; }; }, [code]);

  if (h === undefined) return <p className="muted">Ouverture de la main…</p>;
  if (h === null) return (
    <div className="card empty">
      <b>Lien illisible</b>
      <span>Le lien a peut-être été coupé en le copiant. Demande à la personne de te le renvoyer.</span>
      <a href="#/">Ouvrir mon carnet</a>
    </div>
  );

  const r = replayOf(h);
  const decision = decisionState(h, r);
  const options = decision ? voteOptions(decision, h.ctx.blinds.bb) : [];
  const asking = !!decision && !revealed && options.length >= 2;
  const did = decision ? matchOption(options, decision, h.actions[h.decision!]) : -1;
  const question = asking ? (
    <section className="card stack sm question">
      <h2>Et toi, tu fais quoi ?</h2>
      <Answers options={options} bb={h.ctx.blinds.bb} value={answer} onChange={setAnswer} />
      <div className="row">
        <button className="btn primary" disabled={answer === null} onClick={() => setRevealed(true)}>Voir la suite</button>
        <button className="btn ghost" onClick={() => setRevealed(true)}>Voir sans répondre</button>
      </div>
      <p className="muted">Ta réponse n'est envoyée nulle part : c'est pour toi.</p>
    </section>
  ) : decision && did >= 0 && (
    <p className="note">Le joueur a choisi : <b>{optionLabel(options[did])}</b>{answer !== null ? <> · ta réponse : <b>{optionLabel(options[answer])}</b></> : null}</p>
  );

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <h1>Main partagée</h1>
          <p>{ctxText(h.ctx)} · {heroLine(h)}</p>
        </div>
      </div>
      <Replayer hand={h} limit={asking ? h.decision! : undefined} startAt={asking ? 'end' : 'start'} footer={question} />
      <button className="btn block" onClick={() => {
        const id = newId();
        saveHand({ ...h, id, updated: Date.now(), note: '' });
        toast('Main ajoutée à ton carnet');
        go(`#/main/${id}`);
      }}><Icon name="plus" />Ajouter à mon carnet</button>
    </div>
  );
}
