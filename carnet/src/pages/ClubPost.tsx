/** Une main au vote : on répond avant de voir la suite ; ensuite les totaux et la fin de la main. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Replayer } from '../components/Replayer';
import { SharePanel } from '../components/SharePanel';
import { Chips, Icon, useAction, useConfirm } from '../components/ui';
import { club, messageOf, type Feed, type MyVote, type Post } from '../lib/club';
import { STREETS } from '../lib/engine';
import { bbs, dateLabel, pct } from '../lib/format';
import { TAGS, ctxText, heroLine } from '../lib/hand';
import { go } from '../lib/router';
import { useUser } from '../lib/session';
import { clubLink } from '../lib/share';
import { getCarnet, saveHand } from '../lib/store';
import { MAX_REASONS, REASONS, optionLabel, questionsOf, type Question, type Results as ResultsData, type VoteOption } from '../lib/vote';

/** Les réponses, en grands boutons ; un montant est aussi donné en grosses blindes. */
export function Answers({ options, bb, value, onChange }: { options: VoteOption[]; bb: number; value: number | null; onChange: (i: number) => void }) {
  return (
    <div className="answers" role="radiogroup" aria-label="Ta réponse">
      {options.map((o, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} className={`answer ${value === i ? 'on' : ''}`} onClick={() => onChange(i)}>
          <b>{optionLabel(o)}</b>
          {o.to && (o.k === 'bet' || o.k === 'raise') ? <small>{bbs(o.to, bb)}</small> : null}
        </button>
      ))}
    </div>
  );
}

export function useFeed(id?: string) {
  const user = useUser();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setFeed(await club.feed(id)); setError(null); } catch (e) { setError(messageOf(e)); }
  }, [id]);
  useEffect(() => {
    if (user === undefined) return;
    if (user === null) { setFeed(null); return; }
    void load();
  }, [user, load]);
  return { user, feed, error, reload: load };
}

/** Connexion, compte à valider, base pas à jour : ce qu'il faut avant de voir les mains du club. */
export function ClubGate({ user, feed, error, children }: { user: ReturnType<typeof useUser>; feed: Feed | null; error: string | null; children: ReactNode }) {
  if (user === undefined || (user && !feed && !error)) return <p className="muted">Chargement…</p>;
  if (user === null) return (
    <div className="card stack sm">
      <h2>Réservé aux adhérents</h2>
      <p className="muted">Connecte-toi avec ton compte PPC Poker Tools pour voir les mains soumises au vote et répondre. Le carnet, lui, marche sans compte.</p>
      <a className="btn primary block" href="#/compte"><Icon name="user" />Se connecter</a>
    </div>
  );
  if (error) return <div className="errorbox"><span>{error}</span></div>;
  if (!feed!.member) return (
    <div className="card stack sm">
      <h2>{feed!.pending ? 'Compte en attente' : 'Réservé aux adhérents'}</h2>
      <p className="muted">{feed!.pending ? 'Un gestionnaire du club doit encore valider ton compte. Tu pourras ensuite voter.' : 'Les votes sont ouverts aux adhérents du club.'}</p>
    </div>
  );
  return <>{children}</>;
}

export function ClubPost({ id }: { id: string }) {
  const { user, feed, error, reload } = useFeed(id);
  const post = feed?.posts[0];
  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <a className="crumb" href="#/club"><Icon name="back" size={15} />Mains du club</a>
          <h1>Et toi, tu fais quoi ?</h1>
        </div>
      </div>
      <ClubGate user={user} feed={feed} error={error}>
        {post ? <PostBody post={post} staff={feed!.staff} reload={reload} /> : <div className="card empty"><b>Main introuvable</b><span>Elle a peut-être été retirée.</span></div>}
      </ClubGate>
    </div>
  );
}

function PostBody({ post, staff, reload }: { post: Post; staff: boolean; reload: () => Promise<void> }) {
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const h = post.hand;
  const qs = useMemo(() => questionsOf(h, post.steps), [h, post.steps]);
  /** Question dont on change la réponse. */
  const [changing, setChanging] = useState<number | null>(null);
  // On répond dans l'ordre : la première question sans réponse est la question en cours.
  const open = post.mine ? -1 : changing ?? qs.findIndex(q => !post.my_votes[q.step]);
  const q = open >= 0 ? qs[open] : undefined;
  const tags = h.tags.filter(t => (TAGS as readonly string[]).includes(t));
  const many = qs.length > 1;

  const panel = (
    <>
      {qs.map((x, k) => (k === open ? (
        <Ballot key={`q${x.step}`} q={x} count={qs.length} bb={h.ctx.blinds.bb} mine={post.my_votes[x.step]} busy={busy}
          onVote={(choice, reasons) => run(async () => {
            await club.vote(post.id, x.step, choice, reasons);
            setChanging(null);
            await reload();
          }, post.my_votes[x.step] ? 'Vote changé' : 'Vote enregistré')}
          onCancel={changing !== null ? () => setChanging(null) : undefined} />
      ) : open < 0 || k < open ? (
        <section key={`r${x.step}`} className="card stack sm">
          <div className="row between">
            <h2>{many ? `Question ${k + 1} · ${STREETS[x.state.street]}` : 'Les réponses du club'}</h2>
            <span className="muted">{(post.results[x.step]?.total ?? post.votes)} vote{(post.results[x.step]?.total ?? post.votes) > 1 ? 's' : ''}</span>
          </div>
          {post.results[x.step] ? <Results q={x} res={post.results[x.step]!} mine={post.my_votes[x.step]} /> : <p className="muted">Les résultats s'affichent après ton vote.</p>}
          {post.my_votes[x.step] && changing === null && <button className="btn sm" onClick={() => setChanging(k)}><Icon name="edit" size={15} />Changer mon vote</button>}
        </section>
      ) : null))}
    </>
  );

  return (
    <>
      <p className="muted">{post.author_name ? `Proposée par ${post.author_name}` : 'Proposée par un membre du club'} · {dateLabel(Date.parse(post.created_at))} · {ctxText(h.ctx)}</p>
      <p><b>{heroLine(h)}</b>{tags.length ? <> · {tags.join(', ')}</> : null}{many ? <> · {qs.length} questions</> : null}</p>
      {post.hidden && <p className="note">Main retirée par l'équipe du club : seuls son auteur et l'équipe la voient.</p>}
      <Replayer hand={h} limit={q?.index} startAt={q ? 'end' : 'start'} footer={panel} />

      {!q && <SharePanel hand={h} link={clubLink(post.id)} title="Inviter à voter" />}

      {(post.mine || staff) && (
        <div className="row">
          {staff && (
            <button className="btn sm" disabled={busy} onClick={() => run(async () => { await club.hide(post.id, !post.hidden); await reload(); }, post.hidden ? 'Main remise au vote' : 'Main retirée du vote')}>
              <Icon name={post.hidden ? 'eye' : 'eyeoff'} size={15} />{post.hidden ? 'Remettre' : 'Retirer du vote'}
            </button>
          )}
          <button className="btn sm danger" disabled={busy} onClick={async () => {
            if (!(await confirm({ title: 'Supprimer cette main du club ?', text: 'Elle disparaît avec ses votes. La main reste dans ton carnet.', ok: 'Supprimer', danger: true }))) return;
            await run(async () => {
              await club.remove(post.id);
              const local = getCarnet().hands.find(x => x.published === post.id);
              if (local) saveHand({ ...local, published: undefined });
              go('#/club');
            }, 'Main supprimée du club');
          }}><Icon name="trash" size={15} />Supprimer</button>
        </div>
      )}
    </>
  );
}

/** Le bulletin d'une question : une réponse, deux raisons au plus. */
function Ballot({ q, count, bb, mine, busy, onVote, onCancel }: {
  q: Question; count: number; bb: number; mine: MyVote | null; busy: boolean;
  onVote: (choice: number, reasons: number[]) => void; onCancel?: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(mine?.choice ?? null);
  const [reasons, setReasons] = useState<number[]>(mine?.reasons ?? []);
  const last = q.step === count - 1;
  return (
    <section className="card stack sm question">
      {count > 1 && <span className="field-label">Question {q.step + 1} sur {count} · {STREETS[q.state.street]}</span>}
      <h2>Ta réponse</h2>
      <Answers options={q.options} bb={bb} value={choice} onChange={setChoice} />
      <span className="field-label">Pourquoi ? (facultatif, deux au plus)</span>
      <Chips label="Raisons" multi value={reasons}
        onChange={x => setReasons(l => (l.includes(x) ? l.filter(y => y !== x) : l.length >= MAX_REASONS ? l : [...l, x]))}
        items={REASONS.map((t, i) => ({ value: i, label: t, disabled: !reasons.includes(i) && reasons.length >= MAX_REASONS }))} />
      <button className="btn primary big block" disabled={choice === null || busy} onClick={() => onVote(choice!, reasons)}>
        {mine ? 'Changer mon vote' : last ? 'Voter et voir la suite' : 'Voter et passer à la question suivante'}
      </button>
      {onCancel && <button className="btn ghost block" onClick={onCancel}>Garder mon vote</button>}
      <p className="muted">Les votes sont anonymes : seuls les totaux sont montrés.</p>
    </section>
  );
}

function Results({ q, res, mine }: { q: Question; res: ResultsData; mine: MyVote | null }) {
  const best = Math.max(...res.counts);
  return (
    <div className="results">
      {q.options.map((o, i) => {
        const n = res.counts[i] ?? 0;
        const share = res.total ? n / res.total : 0;
        const why = (res.reasons[i] ?? []).map((c, r) => ({ c, r })).filter(x => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 3);
        return (
          <div key={i} className={`result ${n === best && n > 0 ? 'top' : ''}`}>
            <div className="row between">
              <b>{optionLabel(o)}</b>
              <span className="tnum">{pct(share)} · {n}</span>
            </div>
            <div className="bar"><span style={{ width: `${share * 100}%` }} /></div>
            <div className="result-tags">
              {i === q.did && <span className="tag gold">Ce qu'a fait le joueur</span>}
              {i === mine?.choice && <span className="tag ok">Ton vote</span>}
              {why.map(x => <span key={x.r} className="muted">{REASONS[x.r]} ({x.c})</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
