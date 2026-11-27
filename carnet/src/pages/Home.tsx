/** Mon carnet : le tournoi en cours, le gros bouton « Noter une main », les mains par soirée. */
import { useState } from 'react';
import { CardRow } from '../components/Cards';
import { ContextEditor, CtxBar } from '../components/ContextEditor';
import { Icon } from '../components/ui';
import { positions } from '../lib/engine';
import { bbs, dayLabel, timeLabel } from '../lib/format';
import { blindsText, heroCards, type Hand } from '../lib/hand';
import { useLiveCtx } from '../lib/session';
import { setCtx, useCarnet } from '../lib/store';

export function HandRow({ h }: { h: Hand }) {
  const stack = h.seats[h.hero]?.stack ?? 0;
  return (
    <a className="handrow" href={`#/main/${h.id}`}>
      <CardRow cards={heroCards(h)} size="sm" slots={2} />
      <span className="handrow-main">
        <b>{positions(h.seats.length)[h.hero]} · {bbs(stack, h.ctx.blinds.bb)}</b>
        <small>{timeLabel(h.date)} · {blindsText(h.ctx.blinds)}{h.note ? ` · ${h.note}` : ''}</small>
      </span>
      <span className="handrow-tags">
        {h.published ? <span className="tag gold">Au vote</span> : h.complete ? <span className="tag ok">Rejouable</span> : <span className="tag">À compléter</span>}
        {h.tags.slice(0, 1).map(t => <span key={t} className="tag">{t}</span>)}
      </span>
    </a>
  );
}

export function Home() {
  useLiveCtx();
  const { hands, ctx } = useCarnet();
  const [editing, setEditing] = useState(false);

  // Une soirée = un jour et un tournoi.
  const groups: { key: string; title: string; sub: string; hands: Hand[] }[] = [];
  for (const h of hands) {
    const day = new Date(h.date).toDateString();
    const key = `${day}|${h.ctx.name}`;
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, title: dayLabel(h.date), sub: h.ctx.name || (h.ctx.kind === 'club' ? 'Tournoi du club' : 'Tournoi'), hands: [] }; groups.push(g); }
    g.hands.push(h);
  }

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <h1>Mon carnet</h1>
          <p>Note un coup entre deux mains, complète-le au calme, puis partage-le.</p>
        </div>
      </div>
      <CtxBar ctx={ctx} onEdit={() => setEditing(true)} />
      <a className="btn primary big block" href="#/noter"><Icon name="pen" />Noter une main</a>

      {hands.length === 0 ? (
        <div className="card empty">
          <b>Ton carnet est vide</b>
          <span>Une main notée reste sur ce téléphone. Tu la rejoues quand tu veux et tu choisis ce que tu partages.</span>
          <a href="#/club">Voir les mains soumises au vote du club</a>
        </div>
      ) : groups.map(g => (
        <section key={g.key} className="sec">
          <div className="sechead"><h2>{g.title}</h2><span className="muted">{g.sub} · {g.hands.length} main{g.hands.length > 1 ? 's' : ''}</span></div>
          <div className="list">{g.hands.map(h => <HandRow key={h.id} h={h} />)}</div>
        </section>
      ))}
      {editing && <ContextEditor ctx={ctx} onSave={setCtx} onClose={() => setEditing(false)} />}
    </div>
  );
}
