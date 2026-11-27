/** Cartes à jouer (jeu quatre couleurs, hors DA) et sélecteur en une touche par carte. */
import { useState } from 'react';
import { RANKS_DESC, RANKS, SUIT_SYMBOL, cardName, cardOf, rankLabel, rankOf, suitOf, type Card } from '../lib/cards';
import { Icon } from './ui';

export function CardFace({ c, size = 'md' }: { c: Card; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`pc ${size} s${suitOf(c)}`} role="img" aria-label={cardName(c)}>
      <b>{rankLabel(rankOf(c))}</b><i>{SUIT_SYMBOL[suitOf(c)]}</i>
    </span>
  );
}
export function CardBack({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return <span className={`pc back ${size}`} aria-hidden="true" />;
}
export function CardSlot({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return <span className={`pc slot ${size}`} aria-hidden="true" />;
}
export function CardRow({ cards, size = 'md', slots = 0 }: { cards: Card[]; size?: 'xs' | 'sm' | 'md' | 'lg'; slots?: number }) {
  return (
    <span className="cardrow">
      {cards.map(c => <CardFace key={c} c={c} size={size} />)}
      {Array.from({ length: Math.max(0, slots - cards.length) }, (_, i) => <CardSlot key={`s${i}`} size={size} />)}
    </span>
  );
}

/**
 * Choisir des cartes : les cases à remplir, puis la grille des 52 cartes (une ligne par couleur),
 * repliée une fois les cases remplies. Toucher une case remplie la rouvre pour la changer ;
 * la toucher une seconde fois la vide. Les cartes déjà prises ailleurs sont grisées.
 */
export function CardPicker({ value, count, onChange, used = new Set(), label }: {
  value: Card[]; count: number; onChange: (cards: Card[]) => void; used?: Set<Card>; label: string;
}) {
  const [slot, setSlot] = useState<number | null>(null);
  const target = slot ?? (value.length < count ? value.length : null);
  const pick = (c: Card) => {
    const at = value.indexOf(c);
    if (at >= 0) { onChange(value.filter(x => x !== c)); setSlot(null); return; }
    if (target === null) return;
    const next = [...value];
    if (target < next.length) next[target] = c; else next.push(c);
    onChange(next.slice(0, count));
    setSlot(null);
  };
  return (
    <div className="picker">
      <div className="picker-slots" aria-label={label}>
        {Array.from({ length: count }, (_, i) => {
          const c = value[i];
          return (
            <button key={i} type="button" className={`picker-slot ${target === i ? 'on' : ''}`}
              onClick={() => (c !== undefined ? (slot === i ? (onChange(value.filter((_, j) => j !== i)), setSlot(null)) : setSlot(i)) : setSlot(i))}
              aria-label={c !== undefined ? `${cardName(c)} : toucher pour changer` : `Carte ${i + 1} à choisir`}>
              {c !== undefined ? <CardFace c={c} size="md" /> : <CardSlot size="md" />}
            </button>
          );
        })}
        {value.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={() => { onChange([]); setSlot(null); }}><Icon name="close" size={15} />Effacer</button>
        )}
      </div>
      {target !== null && <div className="picker-grid" role="group" aria-label={`${label} : choisir une carte`}>
        {[0, 1, 2, 3].map(suit => [<span key={`h${suit}`} className={`pk-suit s${suit}`} aria-hidden="true">{SUIT_SYMBOL[suit]}</span>, ...RANKS_DESC.map(r => {
          const c = cardOf(RANKS.indexOf(r), suit);
          const mine = value.includes(c);
          const taken = used.has(c) && !mine;
          return (
            <button key={c} type="button" className={`pk s${suit} ${mine ? 'on' : ''}`} disabled={taken}
              onClick={() => pick(c)} aria-label={cardName(c)} aria-pressed={mine}>
              {rankLabel(RANKS.indexOf(r))}
            </button>
          );
        })])}
      </div>}
    </div>
  );
}
