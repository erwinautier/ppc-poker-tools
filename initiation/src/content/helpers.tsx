/** Outils de rédaction partagés par les leçons. */
import type { ReactNode } from 'react';
import type { ChoiceItem, Item, PickItem } from './types';
import { type Card, cards, bestFive, describe, evalCards, shuffle, draw } from '../lib/cards';
import { CardRow, SeatHand } from '../components/Cards';

export const CAT_ORDER = [
  'Quinte flush royale', 'Quinte flush', 'Carré', 'Full', 'Couleur', 'Suite', 'Brelan', 'Deux paires', 'Paire', 'Hauteur',
];
/** Index dans CAT_ORDER pour une catégorie pédagogique 0…9. */
export function catIndex(cat: number): number { return 9 - cat; }

/** Prend n éléments au hasard. */
export function sample<T>(arr: T[], n: number): T[] { return shuffle(arr).slice(0, n); }

export function Scene({ children }: { children: ReactNode }) {
  return <div className="scene stack">{children}</div>;
}

export function Narr({ lines }: { lines: ReactNode[] }) {
  return <div className="narr">{lines.map((l, i) => <div key={i} className="line">{l}</div>)}</div>;
}

// ── Abattage ───────────────────────────────────────────────────────────────

export interface Player { name: string; cards: Card[] | string }

export function showdownWinner(board: Card[], players: { name: string; cards: Card[] }[]) {
  const vals = players.map(p => bestFive([...p.cards, ...board]));
  const max = Math.max(...vals.map(v => v.value));
  const winners = vals.map((v, i) => (v.value === max ? i : -1)).filter(i => i >= 0);
  return { vals, winners };
}

/** Situation d'abattage : désigner le gagnant ou annoncer un partage. */
export function showdownItem(
  id: string,
  boardS: Card[] | string,
  playersS: Player[],
  extra: { prompt?: ReactNode; insight?: string; feedback?: ReactNode } = {},
): ChoiceItem {
  const board = typeof boardS === 'string' ? cards(boardS) : boardS;
  const players = playersS.map(p => ({ name: p.name, cards: typeof p.cards === 'string' ? cards(p.cards) : p.cards }));
  const { vals, winners } = showdownWinner(board, players);
  const answer = winners.length > 1 ? players.length : winners[0];
  return {
    kind: 'choice',
    id,
    prompt: extra.prompt ?? 'Qui remporte le pot ?',
    scene: (
      <Scene>
        <span className="muted small center">Board</span>
        <CardRow cs={board} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)`, gap: 6 }}>
          {players.map(p => <SeatHand key={p.name} who={p.name} cs={p.cards} />)}
        </div>
      </Scene>
    ),
    options: [...players.map(p => p.name), 'Partage du pot'],
    columns: players.length + 1 <= 3 ? ((players.length + 1) as 3) : 2,
    answer,
    insight: extra.insight,
    feedback: (
      <div className="stack" style={{ gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${players.length}, 1fr)`, gap: 6 }}>
          {players.map((p, i) => (
            <SeatHand key={p.name} who={p.name} cs={vals[i].five} size="xs"
              desc={describe(vals[i].value, true)} state={winners.includes(i) ? 'win' : 'lose'} />
          ))}
        </div>
        <span className="small">Sous chaque nom : les 5 cartes qui comptent.</span>
        {extra.feedback}
      </div>
    ),
  };
}

/** Abattage aléatoire. `kind` : 'any', 'same' (même catégorie) ou 'tie' (partage). */
export function randomShowdown(id: string, nPlayers: number, kind: 'any' | 'same' | 'tie' = 'any'): ChoiceItem {
  const names = ['Alice', 'Bob', 'Carla', 'David'];
  for (let tries = 0; tries < 4000; tries++) {
    const dealt = draw(5 + 2 * nPlayers);
    const board = dealt.slice(0, 5);
    const ps = Array.from({ length: nPlayers }, (_, i) => ({ name: names[i], cards: dealt.slice(5 + 2 * i, 7 + 2 * i) }));
    const { vals, winners } = showdownWinner(board, ps);
    const cats = vals.map(v => v.value >> 20);
    if (kind === 'tie' && winners.length < 2) continue;
    if (kind === 'same' && (winners.length > 1 || new Set(cats).size > 1)) continue;
    if (kind === 'any' && winners.length > 1 && tries < 50) continue;
    return showdownItem(id, board, ps);
  }
  return showdownItem(id, 'Ah Ad Kc Qs Jh', [{ name: 'Alice', cards: '5c 4d' }, { name: 'Bob', cards: '9s 3h' }]);
}

// ── Meilleure main parmi 7 cartes ─────────────────────────────────────────

export function bestFiveItem(id: string, holeS: Card[] | string, boardS: Card[] | string, extra: { insight?: string; feedback?: ReactNode } = {}): PickItem {
  const hole = typeof holeS === 'string' ? cards(holeS) : holeS;
  const board = typeof boardS === 'string' ? cards(boardS) : boardS;
  const best = bestFive([...hole, ...board]);
  const used = best.five.filter(c => hole.includes(c)).length;
  return {
    kind: 'pick',
    id,
    prompt: 'Sélectionne les 5 cartes qui forment ta meilleure main.',
    pool: [...hole, ...board],
    groups: [{ label: 'Tes cartes privées', cards: hole }, { label: 'Le board', cards: board }],
    count: 5,
    check: picked => evalCards(picked) === best.value,
    solution: best.five,
    describe: picked => (picked.length === 5 ? describe(evalCards(picked)).toLowerCase() : ''),
    insight: extra.insight,
    feedback: (
      <>
        Ta meilleure main : <strong>{describe(best.value, true)}</strong>. Tu utilises{' '}
        {used === 0 ? 'aucune de tes cartes privées : le board joue' : used === 1 ? 'une seule de tes cartes privées' : 'tes deux cartes privées'}.
        {extra.feedback && <div style={{ marginTop: 4 }}>{extra.feedback}</div>}
      </>
    ),
  };
}

/** Questions vrai / faux rapides. */
export function trueFalse(id: string, statement: ReactNode, isTrue: boolean, feedback: ReactNode): ChoiceItem {
  return { kind: 'choice', id, prompt: statement, options: ['Vrai', 'Faux'], answer: isTrue ? 0 : 1, columns: 2, feedback };
}

/** Assemble une liste d'items en garantissant des id uniques. */
export function withIds(items: Item[], prefix: string): Item[] {
  return items.map((it, i) => ({ ...it, id: `${prefix}${i}` }));
}

export function bb(n: number): string { return `${n.toLocaleString('fr-FR')} BB`; }
export function chips(n: number): string { return n.toLocaleString('fr-FR'); }
