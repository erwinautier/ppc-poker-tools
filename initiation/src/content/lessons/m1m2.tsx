/** Module 1 (le but du jeu) et module 2 (les combinaisons) : leçons 1 à 5. */
import { useState } from 'react';
import type { ChoiceItem, Item, Lesson } from '../types';
import { CardRow } from '../../components/Cards';
import { PokerTable } from '../../components/PokerTable';
import { T } from '../../components/Term';
import { CAT_ORDER, Scene, bestFiveItem, catIndex, randomShowdown, sample, showdownItem, trueFalse, withIds } from '../helpers';
import { type Card, CAT_NAMES, RANK_CHARS, SUIT_CHARS, catOf, cards, describe, draw, evalCards, bestFive, handOfCategory, pick, shuffle, sortHand } from '../../lib/cards';
import { FIVE_CARD_COUNTS, FIVE_CARD_TOTAL, dealFiveCounts } from '../../lib/sims';

// ════════════════════════════════════════════════════════════════════════════
// Leçon 1 · Gagner des jetons, pas des mains
// ════════════════════════════════════════════════════════════════════════════

const SESSION = [
  ['Alice', 3], ['Alice', 2], ['Bob', 40], ['Alice', 4], ['Alice', 3], ['Bob', 35], ['Alice', 2], ['Alice', 5], ['Bob', 25], ['Alice', 3],
] as const;

function SessionTable({ amounts }: { amounts: boolean }) {
  return (
    <table className="tbl">
      <thead><tr><th>Main</th><th>Gagnant</th>{amounts && <th className="r">Jetons gagnés</th>}</tr></thead>
      <tbody>
        {SESSION.map(([w, a], i) => (
          <tr key={i}><td>{i + 1}</td><td>{w}</td>{amounts && <td className="r">+{a}</td>}</tr>
        ))}
      </tbody>
    </table>
  );
}

const L1: Lesson = {
  id: 1, module: 1,
  title: 'Gagner des jetons, pas des mains',
  objective: 'Comprendre le but du jeu et les deux façons de remporter un pot.',
  defi: {
    intro: <p>Avant toute explication, observe et réponds. Ici, rien n’est noté : se tromper fait partie du jeu, c’est même comme ça qu’on apprend.</p>,
    items: () => [
      {
        kind: 'choice', id: 'l1-1',
        prompt: 'Alice et Bob ont joué 10 mains l’un contre l’autre, avec 100 jetons chacun au départ. Qui a gagné la soirée ?',
        scene: <SessionTable amounts={false} />,
        options: ['Alice, elle a gagné 7 mains', 'Bob', 'On ne peut pas savoir'],
        answer: 2,
        insight: 'Le nombre de mains gagnées ne dit pas qui gagne : ce sont les jetons qui comptent.',
        feedback: 'On sait seulement qui a gagné chaque main, pas combien de jetons. Impossible de conclure.',
      },
      {
        kind: 'choice', id: 'l1-2',
        prompt: 'Voici maintenant les jetons gagnés à chaque main. Qui a gagné la soirée ?',
        scene: <SessionTable amounts />,
        options: ['Alice', 'Bob'], answer: 1,
        insight: 'Bob n’a gagné que 3 mains, mais les plus grosses : il finit avec 178 jetons, Alice avec 22.',
        feedback: 'Alice a gagné 22 jetons en tout, Bob 100. Bob finit avec 178 jetons, Alice avec 22.',
      },
      {
        kind: 'choice', id: 'l1-3',
        prompt: 'Une autre main. Bob mise. Alice et Carla se couchent : elles abandonnent leurs cartes. Bob ramasse le pot. Comment a-t-il gagné ?',
        scene: <PokerTable spec={{ n: 3, labels: ['Bob', 'Alice', 'Carla'], hero: 0, cards: { 0: 'back' }, folded: [1, 2], board: cards('Kc 8d 3s'), pot: '12', bets: { 0: 'mise 6' } }} />,
        options: ['Il avait la meilleure main', 'Tous ses adversaires se sont couchés', 'Il a eu de la chance'],
        answer: 1,
        insight: 'Première façon de gagner un pot : tous les adversaires se couchent.',
        feedback: 'Personne n’a vu ses cartes : il a gagné parce que plus personne ne lui disputait le pot.',
      },
      {
        kind: 'choice', id: 'l1-4',
        prompt: 'Dans cette main, Bob avait-il la meilleure main ?',
        options: ['Oui, forcément', 'Non', 'On ne le saura jamais'], answer: 2,
        insight: 'Quand tout le monde se couche, le gagnant ne montre pas ses cartes : il a pu bluffer.',
        feedback: 'Ses cartes restent cachées. Il avait peut-être une très bonne main… ou rien du tout.',
      },
      {
        kind: 'choice', id: 'l1-5',
        prompt: 'Cette fois, Alice et Bob vont jusqu’au bout et montrent leurs cartes. Qui gagne ?',
        scene: (
          <Scene>
            <span className="muted small center">Cartes communes (le board)</span>
            <CardRow cs="Kc 9d 6s 3h 2c" />
            <div className="row" style={{ justifyContent: 'space-around' }}>
              <div className="stack center" style={{ gap: 4 }}><strong>Alice</strong><CardRow cs="As Ad" size="sm" /></div>
              <div className="stack center" style={{ gap: 4 }}><strong>Bob</strong><CardRow cs="Kh Qs" size="sm" /></div>
            </div>
          </Scene>
        ),
        options: ['Alice', 'Bob'], answer: 0,
        insight: 'Deuxième façon de gagner : avoir la meilleure main à l’abattage.',
        feedback: 'Alice a une paire d’as, Bob une paire de rois (son roi + celui du board). La paire d’as est plus forte.',
      },
      {
        kind: 'choice', id: 'l1-6',
        prompt: 'Pour composer sa main, de combien de cartes Alice dispose-t-elle au total ?',
        options: ['2', '5', '7'], answer: 2,
        insight: 'Chacun combine ses 2 cartes privées avec les 5 cartes communes, et garde les 5 meilleures.',
        feedback: 'Ses 2 cartes privées + les 5 cartes communes = 7 cartes. Elle garde la meilleure combinaison de 5.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Le but du poker est de <strong>gagner des jetons</strong>, pas des mains.</li>
            <li>On remporte un <T k="pot">pot</T> de deux façons : quand <strong>tous les adversaires se couchent</strong>, ou à l’<T k="abattage">abattage</T> avec <strong>la meilleure main</strong>.</li>
            <li>Au Texas Hold’em, chacun reçoit 2 <T k="privees">cartes privées</T> ; 5 cartes communes forment le <T k="board">board</T>. On garde la meilleure combinaison de 5 cartes parmi ces 7.</li>
            <li>En <T k="nolimit">No Limit</T>, on peut miser tout son <T k="tapis">tapis</T> à tout moment.</li>
            <li>En tournoi, tout le monde commence avec le même tapis. Sans jetons, on est éliminé ; le dernier joueur gagne.</li>
          </ul>
        </div>
        <p className="muted">Conséquence : un bon joueur ne cherche pas à jouer beaucoup de mains, mais à gagner gros quand il est devant et à perdre peu quand il est derrière.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(sample<Item>([
      trueFalse('', 'Pour gagner un pot, il faut toujours montrer ses cartes.', false, 'Faux : si tous les adversaires se couchent, on gagne sans rien montrer.'),
      trueFalse('', 'Alice a gagné 12 mains sur 20 ce soir. Elle a forcément plus de jetons qu’au départ.', false, 'Faux : elle a pu gagner de petits pots et en perdre de très gros.'),
      { kind: 'choice', id: '', prompt: 'Combien de cartes communes y a-t-il au maximum sur la table ?', options: ['3', '5', '7'], answer: 1, columns: 3, feedback: 'Cinq cartes communes : le board.' },
      { kind: 'choice', id: '', prompt: 'Combien de cartes privées reçoit chaque joueur ?', options: ['1', '2', '5'], answer: 1, columns: 3, feedback: 'Deux cartes, que lui seul peut voir.' },
      trueFalse('', 'En No Limit, tu as le droit de miser tous tes jetons d’un coup.', true, 'Vrai : c’est ce qui fait la particularité du No Limit.'),
      { kind: 'choice', id: '', prompt: 'En tournoi, que se passe-t-il quand tu n’as plus de jetons ?', options: ['Tu es éliminé', 'Tu continues sans miser', 'On te redonne des jetons'], answer: 0, feedback: 'Tu es éliminé (sauf si le tournoi prévoit une recave).' },
      { kind: 'choice', id: '', prompt: 'Bob mise avec une main faible. Alice, qui avait mieux, se couche. Qui gagne le pot ?', options: ['Alice', 'Bob', 'Personne'], answer: 1, columns: 3, feedback: 'Bob : Alice a abandonné. C’est le principe du bluff.' },
      { kind: 'choice', id: '', prompt: 'Une main se termine à l’abattage quand…', options: ['au moins deux joueurs sont encore en jeu après le dernier tour d’enchères', 'un joueur mise', 'tout le monde se couche sauf un joueur'], answer: 0, feedback: 'S’il reste au moins deux joueurs à la fin, ils montrent leurs cartes.' },
      { kind: 'choice', id: '', prompt: 'À l’abattage, combien de cartes compte la main de chaque joueur ?', options: ['2', '5', '7'], answer: 1, columns: 3, feedback: 'Toujours 5 : la meilleure combinaison parmi les 7 disponibles.' },
      trueFalse('', 'Le meilleur joueur de la soirée est celui qui gagne le plus de mains.', false, 'Faux : c’est celui qui finit avec le plus de jetons.'),
    ], 6), 'l1t'),
  },
  fiche: {
    essentiel: [
      'Le but du poker : gagner des jetons, pas des mains.',
      'Au Texas Hold’em, chaque joueur reçoit 2 cartes privées ; 5 cartes communes forment le board.',
      'Chacun garde la meilleure combinaison de 5 cartes parmi ses 7 cartes.',
      'En No Limit, on peut miser tout son tapis à tout moment.',
      'En tournoi, on est éliminé quand on n’a plus de jetons ; le dernier joueur gagne.',
    ],
    blocks: [
      { kind: 'steps', title: 'Deux façons de remporter un pot', steps: ['Tous les adversaires se couchent : on gagne sans montrer ses cartes.', 'Abattage : les joueurs restants montrent leurs cartes, la meilleure main de 5 cartes gagne.'] },
      { kind: 'text', title: 'Le calcul de la main', text: '2 cartes privées + 5 cartes communes = 7 cartes disponibles. On garde les 5 meilleures.' },
    ],
    pieges: [
      'Croire que le meilleur joueur est celui qui gagne le plus de mains.',
      'Croire qu’il faut avoir la meilleure main pour gagner un pot.',
    ],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 2 · Plus c'est rare, plus c'est fort
// ════════════════════════════════════════════════════════════════════════════

const EXAMPLES: Record<number, string> = {
  9: 'As Ks Qs Js Ts', 8: '9h 8h 7h 6h 5h', 7: 'Qs Qh Qd Qc 4s', 6: 'Kh Kd Ks 7c 7d', 5: 'Ad Jd 8d 6d 2d',
  4: 'Tc 9d 8s 7h 6c', 3: '7s 7h 7d Kc 3s', 2: 'Jh Jc 4s 4d As', 1: 'Ts Th Ac 8d 5s', 0: 'Ah Qd 9s 6c 3h',
};
const ONE_IN = ['2', '2,4', '21', '47', '255', '509', '694', '4 165', '72 193', '649 740'];

/** Derniers compteurs observés, réaffichés pendant le classement. */
let observed: number[] = Array(10).fill(0);

function Observed() {
  const total = observed.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const alpha = [...Array(10).keys()].sort((a, b) => CAT_NAMES[a].localeCompare(CAT_NAMES[b], 'fr'));
  return (
    <div className="scene" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', fontSize: '0.8rem' }}>
      <span className="muted" style={{ gridColumn: '1 / -1' }}>Tes observations sur {total.toLocaleString('fr-FR')} mains :</span>
      {alpha.map(c => [<span key={c}>{CAT_NAMES[c]}</span>, <strong key={c + 'n'} style={{ textAlign: 'right' }}>{observed[c].toLocaleString('fr-FR')}</strong>])}
    </div>
  );
}

function Distributor({ done }: { done: (a: { correct: null; answer: string }) => void }) {
  const [counts, setCounts] = useState<number[]>(() => { observed = Array(10).fill(0); return observed; });
  const total = counts.reduce((a, b) => a + b, 0);
  const deal = (n: number) => { const next = dealFiveCounts(n, counts); observed = next; setCounts(next); };
  const alpha = [...Array(10).keys()].sort((a, b) => CAT_NAMES[a].localeCompare(CAT_NAMES[b], 'fr'));
  return (
    <div className="stack">
      <div className="row wrap">
        <button className="btn" onClick={() => deal(1000)}>+ 1 000 mains</button>
        <button className="btn" onClick={() => deal(10000)}>+ 10 000</button>
        <button className="btn" onClick={() => deal(100000)}>+ 100 000</button>
        <span className="muted small">{total.toLocaleString('fr-FR')} mains distribuées</span>
      </div>
      <table className="tbl">
        <thead><tr><th>Combinaison (ordre alphabétique)</th><th className="r">Sorties</th></tr></thead>
        <tbody>
          {alpha.map(c => (
            <tr key={c}>
              <td>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{CAT_NAMES[c]}</div>
                <div style={{ display: 'flex' }}><CardRow cs={EXAMPLES[c]} size="xs" gap={2} /></div>
              </td>
              <td className="r" style={{ verticalAlign: 'middle', fontWeight: 700 }}>{counts[c].toLocaleString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn primary" disabled={total === 0} onClick={() => done({ correct: null, answer: `${total.toLocaleString('fr-FR')} mains observées` })}>
        {total === 0 ? 'Distribue d’abord quelques mains' : 'J’ai observé, je continue'}
      </button>
    </div>
  );
}

function rankingTable() {
  return (
    <table className="tbl">
      <thead><tr><th>#</th><th>Combinaison</th><th className="r">1 main sur…</th></tr></thead>
      <tbody>
        {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((c, i) => (
          <tr key={c}>
            <td>{i + 1}</td>
            <td><div style={{ fontWeight: 600, marginBottom: 3 }}>{CAT_NAMES[c]}</div><div style={{ display: 'flex' }}><CardRow cs={EXAMPLES[c]} size="xs" gap={2} /></div></td>
            <td className="r" style={{ verticalAlign: 'middle' }}>{ONE_IN[c]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function duel(id: string): ChoiceItem {
  const tricky: [number, number][] = [[5, 4], [6, 5], [3, 2], [7, 6], [4, 3], [2, 1], [8, 7]];
  let [a, b] = Math.random() < 0.6 ? pick(tricky) : sample([...Array(10).keys()], 2) as [number, number];
  if (Math.random() < 0.5) [a, b] = [b, a];
  const ha = handOfCategory(a), hb = handOfCategory(b);
  return {
    kind: 'choice', id,
    prompt: 'Laquelle de ces deux mains est la plus forte ?',
    scene: (
      <Scene>
        <div className="row between"><strong>Main A · {CAT_NAMES[a]}</strong></div>
        <CardRow cs={ha} size="sm" />
        <div className="row between"><strong>Main B · {CAT_NAMES[b]}</strong></div>
        <CardRow cs={hb} size="sm" />
      </Scene>
    ),
    options: [`A · ${CAT_NAMES[a]}`, `B · ${CAT_NAMES[b]}`], columns: 2,
    answer: a > b ? 0 : 1,
    feedback: `${CAT_NAMES[Math.max(a, b)]} (1 main sur ${ONE_IN[Math.max(a, b)]}) bat ${CAT_NAMES[Math.min(a, b)].toLowerCase()} (1 sur ${ONE_IN[Math.min(a, b)]}).`,
  };
}

const L2: Lesson = {
  id: 2, module: 2,
  title: 'Plus c’est rare, plus c’est fort',
  objective: 'Classer les 10 combinaisons et comprendre pourquoi.',
  defi: {
    intro: <p>Le poker classe les mains selon une logique très simple. À toi de la découvrir : distribue des milliers de mains de 5 cartes et observe.</p>,
    items: () => [
      {
        kind: 'custom', id: 'l2-1',
        prompt: 'Distribue des mains de 5 cartes et observe combien de fois sort chaque combinaison.',
        render: done => <Distributor done={done} />,
        insight: 'Certaines combinaisons sortent à chaque instant, d’autres presque jamais.',
      },
      {
        kind: 'order', id: 'l2-2',
        prompt: 'Classe les 10 combinaisons de la plus forte à la plus faible. Indice : au poker, ce qui est rare vaut cher.',
        scene: <Observed />,
        items: CAT_ORDER,
        notes: ONE_IN.slice().reverse().map(x => `1 sur ${x}`),
        insight: 'La hiérarchie suit la rareté : plus une combinaison est rare, plus elle est forte.',
      },
      {
        kind: 'choice', id: 'l2-3',
        prompt: 'D’après tes observations, laquelle sort le moins souvent ?',
        options: ['La couleur', 'La suite'], columns: 2, answer: 0,
        insight: 'La couleur bat la suite : elle est deux fois plus rare.',
        feedback: `Sur 2 598 960 mains possibles : ${FIVE_CARD_COUNTS[5].toLocaleString('fr-FR')} couleurs contre ${FIVE_CARD_COUNTS[4].toLocaleString('fr-FR')} suites. La couleur est donc plus forte.`,
      },
      {
        kind: 'choice', id: 'l2-4',
        prompt: 'Et entre le full et la couleur ?',
        options: ['Le full est plus fort', 'La couleur est plus forte'], columns: 2, answer: 0,
        insight: 'Le full bat la couleur.',
        feedback: `${FIVE_CARD_COUNTS[6].toLocaleString('fr-FR')} fulls contre ${FIVE_CARD_COUNTS[5].toLocaleString('fr-FR')} couleurs : le full est plus rare, donc plus fort.`,
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box">
          <h3>À retenir</h3>
          <p>Les 10 <T k="combinaison">combinaisons</T>, de la plus forte à la plus faible. Plus une main est rare, plus elle est forte.</p>
        </div>
        {rankingTable()}
        <p className="muted">Sur {FIVE_CARD_TOTAL.toLocaleString('fr-FR')} mains de 5 cartes possibles, une sur deux n’a même pas une paire. Les trois confusions les plus fréquentes : la <T k="couleur">couleur</T> bat la <T k="suite">suite</T>, le <T k="full">full</T> bat la couleur, le <T k="brelan">brelan</T> bat les <T k="deuxpaires">deux paires</T>.</p>
      </div>
    ),
  },
  training: { items: () => Array.from({ length: 10 }, (_, i) => duel(`l2t${i}`)) },
  fiche: {
    essentiel: [
      'Il existe 10 combinaisons. Plus une combinaison est rare, plus elle est forte.',
      'La couleur bat la suite, le full bat la couleur, le brelan bat les deux paires.',
      'Une main sur deux n’a même pas une paire.',
    ],
    blocks: [{
      kind: 'cards', title: 'La hiérarchie, de la plus forte à la plus faible',
      rows: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(c => ({ label: CAT_NAMES[c], cards: EXAMPLES[c], note: `1 main sur ${ONE_IN[c]}` })),
    }],
    pieges: ['Penser que la suite bat la couleur.', 'Penser que deux paires battent un brelan.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 3 · Reconnaître une combinaison
// ════════════════════════════════════════════════════════════════════════════

function nameItem(id: string, hand: Card[], extra: { insight?: string; feedback?: string } = {}): ChoiceItem {
  const cat = catOf(evalCards(hand));
  return {
    kind: 'choice', id,
    prompt: 'Quelle est cette combinaison ?',
    scene: <CardRow cs={hand} size="lg" />,
    options: CAT_ORDER, columns: 2,
    answer: catIndex(cat),
    insight: extra.insight,
    feedback: extra.feedback ?? `${describe(evalCards(hand))}.`,
  };
}

function trapHand(): Card[] {
  for (;;) {
    if (Math.random() < 0.5) {
      // fausse suite qui « fait le tour »
      const starts = [[10, 11, 12, 0, 1], [11, 12, 0, 1, 2], [9, 10, 11, 12, 0]];
      const rs = pick(starts);
      const ss = rs.map(() => pick([...SUIT_CHARS]));
      if (new Set(ss).size === 1) continue;
      const h = rs.map((r, i) => RANK_CHARS[r] + ss[i]);
      if (catOf(evalCards(h)) === 0) return shuffle(h);
    } else {
      // quatre cartes d'une couleur + une intruse
      const s = pick([...SUIT_CHARS]);
      const other = pick([...SUIT_CHARS].filter(x => x !== s));
      const rs = sample([...Array(13).keys()], 5);
      const h = rs.map((r, i) => RANK_CHARS[r] + (i < 4 ? s : other));
      if (catOf(evalCards(h)) === 0) return sortHand(h);
    }
  }
}

const L3: Lesson = {
  id: 3, module: 2,
  title: 'Reconnaître une combinaison',
  objective: 'Nommer une main de 5 cartes sans tomber dans les pièges.',
  defi: {
    intro: <p>Voici 10 mains de 5 cartes. Pour chacune, choisis sa combinaison. Attention : certaines sont piégées.</p>,
    items: () => [
      nameItem('l3-1', cards('Kh Qd Jc Ts 9h')),
      nameItem('l3-2', cards('Kc As 2d 3h 4s'), { insight: 'Une suite ne « fait pas le tour » : K-A-2-3-4 n’est pas une suite.', feedback: 'Hauteur as. K-A-2-3-4 n’est pas une suite : l’As ne peut pas relier le roi et le 2.' }),
      nameItem('l3-3', cards('5d 4c 3s 2h Ah'), { insight: 'A-2-3-4-5 est une suite : l’As peut compter comme un 1.', feedback: 'Suite hauteur 5, la plus petite (on l’appelle la « roue »). L’As compte ici comme un 1.' }),
      nameItem('l3-4', cards('Jh 9h 6h 4h 2h'), { insight: 'Une couleur, ce sont 5 cartes de la même enseigne, même si elles ne se suivent pas.', feedback: 'Couleur hauteur valet : 5 cœurs. Peu importe qu’ils ne se suivent pas.' }),
      nameItem('l3-5', cards('Ah Kh Qh Jh 9d'), { insight: 'Quatre cartes de la même enseigne ne font pas une couleur : il en faut cinq.', feedback: 'Hauteur as. Quatre cœurs seulement : pas de couleur. Et A-K-Q-J-9 ne se suit pas.' }),
      nameItem('l3-6', cards('8s 8d 8c 3h 3s'), { insight: 'Un brelan et une paire ensemble forment un full.', feedback: 'Full aux 8 par les 3 : un brelan de 8 plus une paire de 3.' }),
      nameItem('l3-7', cards('Qs Qd 7h 7c 2s')),
      nameItem('l3-8', cards('6c 6h 6d Kc 2h')),
      nameItem('l3-9', cards('7d 6d 5d 4d 3d'), { insight: 'Une suite ET une couleur à la fois : c’est une quinte flush.', feedback: 'Quinte flush hauteur 7 : cinq carreaux qui se suivent.' }),
      nameItem('l3-10', cards('Ts Jd Qh Ks Ac'), { insight: 'La plus haute suite va du 10 à l’As.', feedback: 'Suite hauteur as, du 10 à l’As. Sans être de la même enseigne : ce n’est pas une quinte flush royale.' }),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Les règles qui évitent les pièges</h3>
          <ul>
            <li><T k="suite">Suite</T> : 5 valeurs qui se suivent, enseignes quelconques. L’As est haut (10-J-Q-K-A) ou bas (A-2-3-4-5, la <T k="roue">roue</T>). Une suite ne fait jamais le tour : K-A-2-3-4 n’en est pas une.</li>
            <li><T k="couleur">Couleur</T> : 5 cartes de la même <T k="enseigne">enseigne</T>, quelles que soient leurs valeurs. Quatre ne suffisent pas.</li>
            <li><T k="full">Full</T> : un brelan et une paire.</li>
            <li><T k="quinteflush">Quinte flush</T> : une suite dont les 5 cartes sont de la même enseigne.</li>
          </ul>
        </div>
        <div className="scene stack">
          <strong className="small">Les pièges du défi</strong>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}><CardRow cs="Kc As 2d 3h 4s" size="xs" gap={2} /><span className="small">hauteur as, pas une suite</span></div>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}><CardRow cs="5d 4c 3s 2h Ah" size="xs" gap={2} /><span className="small">suite (la roue)</span></div>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}><CardRow cs="Ah Kh Qh Jh 9d" size="xs" gap={2} /><span className="small">hauteur as, pas une couleur</span></div>
        </div>
      </div>
    ),
  },
  training: {
    timed: true,
    intro: <p>Contre la montre : 15 mains à nommer le plus vite possible. Le chronomètre tourne dès le début.</p>,
    items: () => Array.from({ length: 15 }, (_, i) => {
      const h = Math.random() < 0.2 ? trapHand() : handOfCategory(pick([0, 1, 2, 3, 4, 4, 5, 5, 6, 7, 8, 9]));
      return nameItem(`l3t${i}`, Math.random() < 0.5 ? shuffle(h) : h);
    }),
  },
  fiche: {
    essentiel: [
      'Suite : 5 valeurs consécutives, enseignes quelconques.',
      'L’As peut être haut (10-J-Q-K-A) ou bas (A-2-3-4-5), mais une suite ne fait jamais le tour.',
      'Couleur : 5 cartes de la même enseigne, quelles que soient leurs valeurs.',
      'Full : un brelan + une paire. Quinte flush : suite + couleur à la fois.',
    ],
    blocks: [{
      kind: 'cards', title: 'Les pièges à connaître',
      rows: [
        { label: 'Pas une suite', cards: 'Kc As 2d 3h 4s', note: 'hauteur as' },
        { label: 'Suite (la roue)', cards: '5d 4c 3s 2h Ah', note: 'l’As compte comme un 1' },
        { label: 'Pas une couleur', cards: 'Ah Kh Qh Jh 9d', note: 'il faut 5 cartes' },
        { label: 'Couleur', cards: 'Jh 9h 6h 4h 2h', note: 'pas besoin de se suivre' },
        { label: 'Quinte flush', cards: '7d 6d 5d 4d 3d', note: 'suite + couleur' },
      ],
    }],
    pieges: ['Compter K-A-2-3-4 comme une suite.', 'Voir une couleur avec seulement 4 cartes de la même enseigne.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 4 · La meilleure main parmi 7 cartes
// ════════════════════════════════════════════════════════════════════════════

function randomBestFive(id: string) {
  for (;;) {
    const d = draw(7);
    const v = bestFive(d).value;
    if (v >> 20 >= 1 || Math.random() < 0.15) return bestFiveItem(id, d.slice(0, 2), d.slice(2));
  }
}

const L4: Lesson = {
  id: 4, module: 2,
  title: 'La meilleure main parmi 7 cartes',
  objective: 'Composer sa main avec 0, 1 ou 2 cartes privées.',
  defi: {
    intro: <p>Tu as 2 cartes privées et il y a 5 cartes communes. À chaque fois, touche les 5 cartes qui forment ta meilleure main, puis valide.</p>,
    items: () => [
      bestFiveItem('l4-1', 'As Ad', 'Ac Kh 7d 4s 2c', { insight: 'Tu peux utiliser tes deux cartes privées.' }),
      bestFiveItem('l4-2', 'Kh 3c', 'Ah 9h 6h 2h Js', { insight: 'Tu peux n’utiliser qu’une seule de tes cartes privées.' }),
      bestFiveItem('l4-3', 'Ac Kd', '9s 8h 7d 6c 5s', { insight: 'Tu peux n’utiliser aucune de tes cartes : on dit que « le board joue ».', feedback: 'Ton As et ton Roi ne prolongent pas la suite : ta meilleure main, ce sont les 5 cartes du board. Tous les joueurs ont au moins cette suite.' }),
      bestFiveItem('l4-4', 'Qs Jd', 'Qh 8c 8s 4d 2h', { insight: 'Une carte privée peut servir de kicker.' }),
      bestFiveItem('l4-5', '7h 2c', 'Kd Kc Ks 9h 9d', { insight: 'Quand le board est plus fort que tout ce que tes cartes peuvent apporter, c’est lui qui joue.' }),
      bestFiveItem('l4-6', 'Td 9c', 'Jh 8s 7d 2c 2h', { insight: 'Pour une suite, tes deux cartes peuvent compléter le board.' }),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Ta main, c’est la <strong>meilleure combinaison de 5 cartes</strong> parmi les 7 : tes 2 cartes privées + les 5 cartes du board.</li>
            <li>Tu peux utiliser <strong>2, 1 ou 0</strong> de tes cartes privées. Aucune obligation de jouer les deux (c’est à l’Omaha, une autre variante, qu’on y est obligé).</li>
            <li>Quand ta meilleure main est formée par les 5 cartes communes, on dit que <T k="boardjoue">le board joue</T>. Tous les joueurs ont alors au moins cette main : le pot est souvent partagé.</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: { items: () => Array.from({ length: 8 }, (_, i) => randomBestFive(`l4t${i}`)) },
  fiche: {
    essentiel: [
      'Ta main = la meilleure combinaison de 5 cartes parmi tes 2 cartes privées et les 5 cartes communes.',
      'Tu peux utiliser 2, 1 ou 0 de tes cartes privées.',
      'Si les 5 cartes du board forment la meilleure main, « le board joue » : le pot est souvent partagé.',
    ],
    blocks: [{
      kind: 'cards', title: 'Trois exemples',
      rows: [
        { label: 'Tes cartes : As Ad', cards: 'As Ad Ac Kh 7d', note: 'board Ac Kh 7d 4s 2c : brelan d’as, tes 2 cartes' },
        { label: 'Tes cartes : Kh 3c', cards: 'Ah Kh Jh 9h 6h', note: 'board Ah 9h 6h 2h Js : couleur, une seule carte' },
        { label: 'Tes cartes : Ac Kd', cards: '9s 8h 7d 6c 5s', note: 'le board joue : aucune de tes cartes' },
      ],
    }],
    pieges: ['Croire qu’il faut utiliser ses deux cartes privées.', 'Oublier qu’une carte privée peut servir de kicker.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 5 · Départager deux mains
// ════════════════════════════════════════════════════════════════════════════

const L5: Lesson = {
  id: 5, module: 2,
  title: 'Départager deux mains',
  objective: 'Utiliser le kicker et reconnaître un partage.',
  defi: {
    intro: <p>Des joueurs arrivent à l’abattage. À toi d’arbitrer : qui remporte le pot ? Ou faut-il le partager ?</p>,
    items: () => [
      showdownItem('l5-1', 'Kd 9s 7h 4c 2d', [{ name: 'Alice', cards: '7c 7d' }, { name: 'Bob', cards: 'Ks Qh' }], { insight: 'D’abord, on compare les combinaisons : le brelan bat la paire.' }),
      showdownItem('l5-2', 'Js 8d 5c 3h 2s', [{ name: 'Alice', cards: 'Qc Qs' }, { name: 'Bob', cards: 'Kh Kd' }], { insight: 'À combinaison égale, la plus haute gagne : une paire de rois bat une paire de dames.' }),
      showdownItem('l5-3', 'Ks 9h 7d 4c 2s', [{ name: 'Alice', cards: 'Ah Kd' }, { name: 'Bob', cards: 'Kc Qs' }], { insight: 'Même paire : la carte suivante, le kicker, fait la différence.' }),
      showdownItem('l5-4', 'Ah Ad Kc Qs Jh', [{ name: 'Alice', cards: '5c 4d' }, { name: 'Bob', cards: '9s 3h' }], { insight: 'Si les 5 meilleures cartes sont identiques, on partage le pot.' }),
      showdownItem('l5-5', 'Kh 9h 6h 2c 3s', [{ name: 'Alice', cards: 'Qh Jh' }, { name: 'Bob', cards: 'Ah 4h' }], { insight: 'Couleur contre couleur : on compare la plus haute carte, puis la suivante…' }),
      showdownItem('l5-6', 'Kd Qs 8c 6h 3d', [{ name: 'Alice', cards: 'Ac 7s' }, { name: 'Bob', cards: 'Ad 7h' }], { insight: 'Les enseignes ne départagent jamais : un pique ne bat pas un cœur.' }),
      showdownItem('l5-7', 'Kh Kd 7s 7c 3h', [{ name: 'Alice', cards: 'Jd 4c' }, { name: 'Bob', cards: 'Ad 2c' }], { insight: 'Deux paires identiques : c’est encore le kicker qui départage.' }),
      showdownItem('l5-8', '9c 8d 7h 2s 2c', [{ name: 'Alice', cards: 'Th 6s' }, { name: 'Bob', cards: 'Jd Tc' }, { name: 'Carla', cards: '9h 9d' }], { insight: 'À plusieurs, on compare toutes les mains : ici, le full bat les deux suites.' }),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box">
          <h3>Pour départager, on compare dans l’ordre</h3>
          <ol className="steps mt">
            <li>la <strong>combinaison</strong> (un brelan bat une paire) ;</li>
            <li>la <strong>hauteur</strong> de la combinaison (paire de rois &gt; paire de dames) ;</li>
            <li>les <T k="kicker">kickers</T>, une carte après l’autre, mais <strong>seulement parmi les 5 cartes</strong> de la main ;</li>
            <li>si les 5 cartes sont identiques : <T k="partage">partage</T> du pot.</li>
          </ol>
        </div>
        <p className="muted">Les <T k="enseigne">enseignes</T> ne départagent jamais : ♠ ne bat pas ♥. Et une 6e carte ne compte jamais : seules 5 cartes forment la main.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle([
      ...Array.from({ length: 5 }, () => randomShowdown('', 2, 'any')),
      ...Array.from({ length: 3 }, () => randomShowdown('', 2, 'same')),
      randomShowdown('', 3, 'any'),
      randomShowdown('', 2, 'tie'),
    ]), 'l5t'),
  },
  fiche: {
    essentiel: [
      'On compare d’abord les combinaisons, puis leur hauteur.',
      'À combinaison égale, le kicker départage : seules les 5 cartes de la main comptent.',
      'Si les 5 cartes sont identiques, le pot est partagé.',
      'Les enseignes ne départagent jamais.',
    ],
    blocks: [
      { kind: 'steps', title: 'L’ordre de départage', steps: ['La combinaison (brelan > paire).', 'La hauteur de la combinaison (paire de rois > paire de dames).', 'Les kickers, un par un, parmi les 5 cartes de la main.', '5 cartes identiques : partage du pot.'] },
      { kind: 'cards', title: 'Exemple de kicker', rows: [
        { label: 'Alice (gagne)', cards: 'Ks Kd Ah 9h 7d', note: 'paire de rois, kicker as' },
        { label: 'Bob', cards: 'Ks Kc Qs 9h 7d', note: 'paire de rois, kicker dame' },
      ] },
    ],
    pieges: ['Croire qu’une enseigne est plus forte qu’une autre.', 'Compter une 6e carte comme kicker.'],
  },
};

export const LESSONS_M1M2 = [L1, L2, L3, L4, L5];
