/** Une main du carnet : note, rejoueur, partage, et soumission au vote du club. */
import { useState } from 'react';
import { CardRow } from '../components/Cards';
import { Replayer } from '../components/Replayer';
import { SharePanel } from '../components/SharePanel';
import { Chips, Icon, useAction, useConfirm, useToast } from '../components/ui';
import { club } from '../lib/club';
import { STREETS, positions, tell } from '../lib/engine';
import { bbs, chips, dayLabel, timeLabel } from '../lib/format';
import { actionText, ctxText, decisionState, heroCards, replayOf, shareable, type Hand } from '../lib/hand';
import { go } from '../lib/router';
import { useUser } from '../lib/session';
import { clubLink } from '../lib/share';
import { removeHand, saveHand, useCarnet } from '../lib/store';
import { optionLabel, voteOptions } from '../lib/vote';

export function HandPage({ id }: { id: string }) {
  const { hands } = useCarnet();
  const h = hands.find(x => x.id === id);
  const confirm = useConfirm();
  const toast = useToast();
  if (!h) return <div className="card empty"><b>Main introuvable</b><span>Elle a peut-être été supprimée.</span><a href="#/">Retour au carnet</a></div>;
  const stack = h.seats[h.hero].stack;

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <a className="crumb" href="#/"><Icon name="back" size={15} />Mon carnet</a>
          <h1>{positions(h.seats.length)[h.hero]} · {bbs(stack, h.ctx.blinds.bb)}</h1>
          <p>{dayLabel(h.date)} à {timeLabel(h.date)} · {ctxText(h.ctx)}</p>
        </div>
      </div>
      {h.tags.length > 0 && <div className="chips">{h.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>}

      {!h.complete ? (
        <section className="card stack sm">
          <div className="row">
            <CardRow cards={heroCards(h)} size="lg" slots={2} />
            <div>
              <b>{positions(h.seats.length)[h.hero]}, {chips(stack)} jetons</b>
              <p className="muted">{h.seats.length} joueurs · {h.ctx.blinds.sb}/{h.ctx.blinds.bb}</p>
            </div>
          </div>
          {h.note ? <p className="notetext">{h.note}</p> : <p className="muted">Pas de note.</p>}
          <a className="btn primary big block" href={`#/main/${h.id}/deroule`}><Icon name="play" />{h.actions.length ? 'Reprendre le déroulé' : 'Compléter le déroulé'}</a>
          <p className="muted">Le déroulé (actions, board) permet de rejouer la main et de la partager.</p>
          <a className="btn block" href={`#/noter/${h.id}`}><Icon name="edit" />Modifier la note</a>
        </section>
      ) : (
        <>
          <Replayer hand={h} />
          <div className="row">
            <a className="btn sm" href={`#/main/${h.id}/deroule`}><Icon name="edit" size={15} />Modifier le déroulé</a>
            <a className="btn sm" href={`#/noter/${h.id}`}><Icon name="pen" size={15} />Note et étiquettes</a>
          </div>
          {h.note && <section className="card"><span className="field-label">Ma note (privée)</span><p className="notetext">{h.note}</p></section>}
          <SharePanel hand={shareable(h)} />
          <PublishPanel h={h} />
        </>
      )}

      <button className="btn ghost danger-text" onClick={async () => {
        if (!(await confirm({ title: 'Supprimer cette main ?', text: h.published ? 'Elle reste au vote du club : retire-la d\'abord depuis l\'onglet Club si tu veux qu\'elle disparaisse aussi là-bas.' : 'Elle disparaît de ce téléphone.', ok: 'Supprimer', danger: true }))) return;
        const gone = removeHand(h.id);
        go('#/');
        if (gone) toast('Main supprimée', 'ok', { label: 'Annuler', run: () => saveHand(gone) });
      }}><Icon name="trash" size={16} />Supprimer la main</button>
    </div>
  );
}

function PublishPanel({ h }: { h: Hand }) {
  const user = useUser();
  const [run, busy] = useAction();
  const [showName, setShowName] = useState(false);
  const r = replayOf(h);
  const decision = decisionState(h, r);

  if (h.published) {
    return (
      <section className="card stack sm">
        <h2>Au vote du club</h2>
        <p className="muted">Les adhérents répondent à « Et toi, tu fais quoi ? » avant de voir la suite.</p>
        <a className="btn primary block" href={`#/club/${h.published}`}><Icon name="vote" />Voir les votes</a>
        <SharePanel hand={shareable(h)} link={clubLink(h.published)} title="Inviter à voter" />
      </section>
    );
  }

  const heroActs = h.actions.flatMap((a, i) => (a.p === h.hero && r.states[i] ? [{ i, label: `${STREETS[r.states[i].street]} : ${actionText(tell(r.states[i], a))}` }] : []));
  const options = decision ? voteOptions(decision, h.ctx.blinds.bb) : [];

  return (
    <section className="card stack sm">
      <h2>Soumettre au vote du club</h2>
      <p className="muted">Les adhérents choisissent ce qu'ils auraient fait parmi quelques réponses, avec au plus deux raisons. Pas de commentaire libre.</p>
      {heroActs.length === 0 ? <p className="note">Tu n'as pris aucune décision dans cette main : rien à soumettre au vote.</p> : (
        <>
          <span className="field-label">La décision à soumettre</span>
          <Chips label="Décision" value={h.decision} onChange={i => saveHand({ ...h, decision: i })}
            items={heroActs.map(x => ({ value: x.i, label: x.label }))} />
          {options.length > 0 && <p className="muted">Réponses proposées : {options.map(optionLabel).join(' · ')}.</p>}
          <label className="switch">
            <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} />
            <span className="track" />
            <span className="switch-text">Afficher mon prénom<small>Sinon la main est présentée comme « Un membre du club ».</small></span>
          </label>
          {user === null ? (
            <a className="btn block" href="#/compte"><Icon name="user" />Se connecter pour publier</a>
          ) : (
            <button className="btn primary block" disabled={!decision || busy || options.length < 2} onClick={() => run(async () => {
              const id = await club.publish(shareable(h), options, showName);
              saveHand({ ...h, published: id });
              go(`#/club/${id}`);
            }, 'Main soumise au vote')}><Icon name="vote" />Publier au club</button>
          )}
        </>
      )}
    </section>
  );
}
