/** Note express, à la table : position, cartes, tapis, une phrase, une étiquette. Vingt secondes. */
import { useState } from 'react';
import { CardPicker } from '../components/Cards';
import { ContextEditor, CtxBar } from '../components/ContextEditor';
import { AmountInput, Chips, Field, Icon, useToast } from '../components/ui';
import { positions } from '../lib/engine';
import { bbs } from '../lib/format';
import { TAGS, ctxText, type Hand } from '../lib/hand';
import { go } from '../lib/router';
import { useLiveCtx } from '../lib/session';
import { blankHand, getHand, lastStack, saveHand, setCtx, useCarnet } from '../lib/store';

export function Express({ id }: { id?: string }) {
  useLiveCtx();
  const toast = useToast();
  const carnet = useCarnet();
  const existing = id ? getHand(id) : null;
  // Une nouvelle note prend le tournoi en cours (et les blindes du moment) ; une note existante garde les siennes.
  const ctx = existing?.ctx ?? carnet.ctx;
  const played = !!existing?.actions.length;
  const [pos, setPos] = useState<string>(existing ? positions(existing.seats.length)[existing.hero] : 'BTN');
  const [cards, setCards] = useState<number[]>(existing?.seats[existing.hero]?.cards ?? []);
  const [stack, setStack] = useState<number | null>(existing?.seats[existing.hero]?.stack ?? lastStack() ?? ctx.blinds.bb * 50);
  const [note, setNote] = useState(existing?.note ?? '');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [editing, setEditing] = useState(false);

  if (id && !existing) return <div className="card empty"><b>Main introuvable</b><a href="#/">Retour au carnet</a></div>;

  const table = existing ? existing.seats.length : ctx.table;
  const posList = positions(table);
  const heroPos = posList.includes(pos) ? pos : 'BTN';

  const save = (then: 'list' | 'entry') => {
    if (!stack || stack < 1) { toast('Indique ton tapis.', 'error'); return; }
    const mine = (s: number) => ({ stack: s, ...(cards.length ? { cards } : {}) });
    let h: Hand;
    if (existing && played) {
      // Déroulé déjà saisi : position et tapis se changent dans le déroulé.
      h = { ...existing, seats: existing.seats.map((s, i) => (i === existing.hero ? mine(s.stack) : s)) };
    } else {
      const fresh = blankHand(ctx, stack, heroPos);
      h = existing ? { ...existing, seats: fresh.seats, hero: fresh.hero } : fresh;
      h.seats[h.hero] = mine(stack);
    }
    h = { ...h, note: note.trim(), tags };
    saveHand(h);
    if (then === 'entry') { go(`#/main/${h.id}/deroule`); return; }
    toast(existing ? 'Note mise à jour' : 'Main notée', 'ok', existing ? undefined : { label: 'Compléter', run: () => go(`#/main/${h.id}/deroule`) });
    go(existing ? `#/main/${h.id}` : '#/');
  };

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <a className="crumb" href={existing ? `#/main/${existing.id}` : '#/'}><Icon name="back" size={15} />{existing ? 'La main' : 'Mon carnet'}</a>
          <h1>{existing ? 'Modifier la note' : 'Noter une main'}</h1>
        </div>
      </div>
      {existing ? <p className="muted">{ctxText(ctx)} · {table} joueurs</p> : <CtxBar ctx={ctx} onEdit={() => setEditing(true)} />}

      {!played && (
        <section className="stack sm">
          <span className="field-label">Ma position</span>
          <Chips label="Ma position" value={heroPos} onChange={setPos} items={posList.map(p => ({ value: p, label: p }))} />
        </section>
      )}

      <section className="stack sm">
        <span className="field-label">Mes cartes</span>
        <CardPicker label="Mes cartes" value={cards} count={2} onChange={setCards} />
      </section>

      <div className="form">
        {!played && (
          <Field label="Mon tapis au début de la main" hint={stack ? `${bbs(stack, ctx.blinds.bb)} à ${ctx.blinds.sb}/${ctx.blinds.bb}` : 'En jetons'}>
            <AmountInput value={stack} min={1} onChange={setStack} label="Mon tapis" />
          </Field>
        )}
        <Field label="Ce qui s'est passé" hint="La dictée du clavier marche ici. Cette note reste sur ton téléphone : elle n'est jamais partagée." wide={played}>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3}
            placeholder="UTG relance 1 500, je paie au bouton, BB paie. Flop K72, il mise 2 500…" />
        </Field>
      </div>

      <section className="stack sm">
        <span className="field-label">Étiquettes</span>
        <Chips label="Étiquettes" multi value={tags} onChange={t => setTags(l => (l.includes(t) ? l.filter(x => x !== t) : [...l, t]))}
          items={TAGS.map(t => ({ value: t, label: t }))} />
      </section>

      <div className="row stickybar">
        <button className="btn primary big" style={{ flex: 1 }} onClick={() => save('list')}><Icon name="check" />{existing ? 'Enregistrer' : 'Noter la main'}</button>
        {!existing?.complete && <button className="btn big" onClick={() => save('entry')}>{existing ? 'Déroulé' : 'Noter et dérouler'}</button>}
      </div>
      {editing && <ContextEditor ctx={ctx} onSave={setCtx} onClose={() => setEditing(false)} />}
    </div>
  );
}
