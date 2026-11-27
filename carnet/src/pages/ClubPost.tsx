/** Une main au vote : on répond avant de voir la suite ; ensuite les totaux et la fin de la main. */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Replayer } from '../components/Replayer';
import { SharePanel } from '../components/SharePanel';
import { Chips, Icon, useAction, useConfirm } from '../components/ui';
import { club, messageOf, type Feed, type Post } from '../lib/club';
import { bbs, dateLabel, pct } from '../lib/format';
import { TAGS, ctxText, decisionState, heroLine, replayOf } from '../lib/hand';
import { go } from '../lib/router';
import { useUser } from '../lib/session';
import { clubLink } from '../lib/share';
import { getCarnet, saveHand } from '../lib/store';
import { MAX_REASONS, REASONS, matchOption, optionLabel, type VoteOption } from '../lib/vote';

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
  const bb = h.ctx.blinds.bb;
  const r = replayOf(h);
  const decision = decisionState(h, r);
  const [choice, setChoice] = useState<number | null>(post.my_vote);
  const [reasons, setReasons] = useState<number[]>(post.my_reasons);
  const [changing, setChanging] = useState(false);
  const voted = post.my_vote !== null;
  const asking = !post.mine && (!voted || changing);
  const did = decision ? matchOption(post.options, decision, h.actions[h.decision!]) : -1;
  const tags = h.tags.filter(t => (TAGS as readonly string[]).includes(t));
  const panel = asking ? (
    <section className="card stack sm question">
      <h2>Ta réponse</h2>
      <Answers options={post.options} bb={bb} value={choice} onChange={setChoice} />
      <span className="field-label">Pourquoi ? (facultatif, deux au plus)</span>
      <Chips label="Raisons" multi value={reasons}
        onChange={x => setReasons(l => (l.includes(x) ? l.filter(y => y !== x) : l.length >= MAX_REASONS ? l : [...l, x]))}
        items={REASONS.map((t, i) => ({ value: i, label: t, disabled: !reasons.includes(i) && reasons.length >= MAX_REASONS }))} />
      <button className="btn primary big block" disabled={choice === null || busy} onClick={() => run(async () => {
        await club.vote(post.id, choice!, reasons);
        setChanging(false);
        await reload();
      }, voted ? 'Vote changé' : 'Vote enregistré')}>{voted ? 'Changer mon vote' : 'Voter et voir la suite'}</button>
      <p className="muted">Les votes sont anonymes : seuls les totaux sont montrés.</p>
    </section>
  ) : (
    <section className="card stack sm">
      <div className="row between">
        <h2>Les réponses du club</h2>
        <span className="muted">{post.votes} vote{post.votes > 1 ? 's' : ''}</span>
      </div>
      {post.results ? <Results post={post} did={did} /> : <p className="muted">Les résultats s'affichent après ton vote.</p>}
      {voted && <button className="btn sm" onClick={() => setChanging(true)}><Icon name="edit" size={15} />Changer mon vote</button>}
    </section>
  );

  return (
    <>
      <p className="muted">{post.author_name ? `Proposée par ${post.author_name}` : 'Proposée par un membre du club'} · {dateLabel(Date.parse(post.created_at))} · {ctxText(h.ctx)}</p>
      <p><b>{heroLine(h)}</b>{tags.length ? <> · {tags.join(', ')}</> : null}</p>
      {post.hidden && <p className="note">Main retirée par l'équipe du club : seuls son auteur et l'équipe la voient.</p>}
      <Replayer key={asking ? 'q' : 'a'} hand={h} limit={asking && decision ? h.decision! : undefined} startAt={asking ? 'end' : 'start'} footer={panel} />

      {!asking && <SharePanel hand={h} link={clubLink(post.id)} title="Inviter à voter" />}

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

function Results({ post, did }: { post: Post; did: number }) {
  const res = post.results!;
  const best = Math.max(...res.counts);
  return (
    <div className="results">
      {post.options.map((o, i) => {
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
              {i === did && <span className="tag gold">Ce qu'a fait le joueur</span>}
              {i === post.my_vote && <span className="tag ok">Ton vote</span>}
              {why.map(x => <span key={x.r} className="muted">{REASONS[x.r]} ({x.c})</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
