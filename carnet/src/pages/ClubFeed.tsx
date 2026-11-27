/** Les mains soumises au vote du club, les plus récentes d'abord. */
import { CardRow } from '../components/Cards';
import { Icon } from '../components/ui';
import type { Post } from '../lib/club';
import { STREETS, potOf } from '../lib/engine';
import { chips, dateLabel } from '../lib/format';
import { decisionState, heroCards, replayOf } from '../lib/hand';
import { ClubGate, useFeed } from './ClubPost';

function spot(p: Post): string {
  const h = p.hand;
  const d = decisionState(h, replayOf(h));
  if (!d) return '';
  const call = Math.min(d.current - d.ps[h.hero].bet, d.ps[h.hero].stack);
  return `${STREETS[d.street]} · ${call > 0 ? `${chips(call)} à payer · pot ${chips(potOf(d))}` : `pot ${chips(potOf(d))} · au héros de parler`}`;
}

export function ClubFeed() {
  const { user, feed, error } = useFeed();
  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <h1>Mains du club</h1>
          <p>Des coups soumis par les adhérents. Réponds avant de voir la suite.</p>
        </div>
      </div>
      <ClubGate user={user} feed={feed} error={error}>
        {feed?.posts.length ? (
          <div className="list">
            {feed.posts.map(p => (
              <a key={p.id} className="handrow" href={`#/club/${p.id}`}>
                <CardRow cards={heroCards(p.hand)} size="sm" slots={2} />
                <span className="handrow-main">
                  <b>{spot(p)}</b>
                  <small>{p.author_name ?? 'Un membre'} · {dateLabel(Date.parse(p.created_at))} · {p.votes} vote{p.votes > 1 ? 's' : ''}</small>
                </span>
                <span className="handrow-tags">
                  {p.hidden ? <span className="tag">Retirée</span> : p.mine ? <span className="tag gold">Ta main</span> : p.my_vote !== null ? <span className="tag ok">Voté</span> : <span className="tag gold">À toi</span>}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="card empty">
            <b>Aucune main au vote pour l'instant</b>
            <span>Dans ton carnet, une main complète avec un « point de décision » peut être soumise au club.</span>
            <a className="btn" href="#/"><Icon name="book" />Mon carnet</a>
          </div>
        )}
      </ClubGate>
    </div>
  );
}
