/** Module 3 · Le déroulement d'une main : leçons 6 à 9. */
import { useState } from 'react';
import type { Item, Lesson, MultiItem, NumberItem, SeatItem } from '../types';
import { PokerTable, bbSeat, sbSeat } from '../../components/PokerTable';
import { T } from '../../components/Term';
import { Narr, chips, sample, withIds } from '../helpers';
import { cards, pick, randInt, shuffle } from '../../lib/cards';

const NAMES = ['Alice', 'Bob', 'Carla', 'David', 'Emma', 'Farid', 'Gaëlle', 'Hugo'];

// ════════════════════════════════════════════════════════════════════════════
// Leçon 6 · Le bouton et les blindes
// ════════════════════════════════════════════════════════════════════════════

function Rotation({ start, done }: { start: number; done: (a: { correct: null; answer: string }) => void }) {
  const [h, setH] = useState(0);
  return (
    <div className="stack">
      <div className="row between"><strong>Main {h + 1}</strong><span className="muted small">Bouton chez {NAMES[(start + h) % 8]}</span></div>
      <PokerTable spec={{ n: 8, labels: NAMES, button: (start + h) % 8, showBlinds: true }} />
      {h < 2
        ? <button className="btn" onClick={() => setH(h + 1)}>Main suivante →</button>
        : <button className="btn primary" onClick={() => done({ correct: null, answer: '3 mains observées' })}>J’ai compris le mouvement, je continue</button>}
    </div>
  );
}

function nextHandItem(id: string, n: number, prevButton: number): SeatItem {
  const labels = NAMES.slice(0, n).map((x, i) => (i === prevButton ? `${x} (bouton avant)` : x));
  const b = (prevButton + 1) % n;
  return {
    kind: 'seats', id,
    prompt: `Table à ${n} joueurs. À la main précédente, le bouton était chez ${NAMES[prevButton]}. Place les jetons pour la nouvelle main.`,
    table: { n, labels },
    tokens: ['BTN', 'SB', 'BB'],
    solution: [b, sbSeat(b, n), bbSeat(b, n)],
    feedback: n === 2
      ? 'En heads-up, le bouton est aussi la petite blinde ; l’autre joueur est la grosse blinde.'
      : `Le bouton passe chez ${NAMES[b]}, la petite blinde chez ${NAMES[sbSeat(b, n)]}, la grosse blinde chez ${NAMES[bbSeat(b, n)]}.`,
  };
}
function blindsItem(id: string, n: number, button: number): SeatItem {
  const labels = NAMES.slice(0, n).map((x, i) => (i === button ? `${x} · BTN` : x));
  return {
    kind: 'seats', id,
    prompt: `Table à ${n} joueurs, le bouton est chez ${NAMES[button]}. Place la petite et la grosse blinde.`,
    table: { n, labels },
    tokens: ['SB', 'BB'],
    solution: [sbSeat(button, n), bbSeat(button, n)],
    feedback: n === 2 ? 'En heads-up, le bouton paie la petite blinde.' : 'La petite blinde est juste à gauche du bouton, la grosse blinde juste après.',
  };
}

const L6: Lesson = {
  id: 6, module: 3,
  title: 'Le bouton et les blindes',
  objective: 'Placer le bouton et les blindes, et comprendre leur rotation.',
  defi: {
    intro: <p>Une petite question de bon sens pour commencer, puis tu observeras une table pendant trois mains.</p>,
    items: () => {
      const start = randInt(0, 7);
      const b4 = (start + 3) % 8;
      return [
        {
          kind: 'choice', id: 'l6-1',
          prompt: 'Imagine une partie où personne n’est obligé de miser. Tu décides d’attendre une paire d’as pour jouer. Combien te coûte cette attente ?',
          options: ['Rien du tout', 'Un peu à chaque main', 'Beaucoup'], answer: 0,
          insight: 'Sans mise obligatoire, attendre les meilleures mains ne coûterait rien : plus personne ne jouerait.',
          feedback: 'Rien : tu jettes tes cartes sans perdre un jeton. Si tout le monde fait pareil, il ne se passe plus rien. Il faut donc des mises obligatoires.',
        },
        {
          kind: 'custom', id: 'l6-2',
          prompt: 'Observe trois mains d’affilée. Où vont le bouton (BTN), la petite blinde (SB) et la grosse blinde (BB) ?',
          render: done => <Rotation start={start} done={done} />,
          insight: 'À chaque main, le bouton avance d’un siège vers la gauche (sens des aiguilles d’une montre), et les blindes le suivent.',
        },
        {
          kind: 'seats', id: 'l6-3',
          prompt: `Main 4. À la main 3, le bouton était chez ${NAMES[(start + 2) % 8]}. Place le bouton, la petite blinde et la grosse blinde.`,
          table: { n: 8, labels: NAMES },
          tokens: ['BTN', 'SB', 'BB'],
          solution: [b4, sbSeat(b4, 8), bbSeat(b4, 8)],
          insight: 'La petite blinde est juste à gauche du bouton, la grosse blinde juste à gauche de la petite blinde.',
          feedback: `Le bouton avance d’un siège dans le sens des aiguilles d’une montre : il passe chez ${NAMES[b4]}. La petite blinde (${NAMES[sbSeat(b4, 8)]}) et la grosse blinde (${NAMES[bbSeat(b4, 8)]}) le suivent.`,
        },
        {
          kind: 'seats', id: 'l6-4',
          prompt: 'Il ne reste que deux joueurs : c’est un heads-up. Le bouton est chez Alice. Place la petite et la grosse blinde.',
          table: { n: 2, labels: ['Alice · BTN', 'Bob'] },
          tokens: ['SB', 'BB'],
          solution: [0, 1],
          insight: 'En heads-up, le bouton paie aussi la petite blinde.',
          feedback: 'À deux, le bouton est la petite blinde et l’autre joueur la grosse blinde.',
        },
      ];
    },
  },
  bilan: {
    body: (
      <div className="stack">
        <PokerTable spec={{ n: 8, labels: NAMES, button: 0, showBlinds: true, bets: { 1: '50', 2: '100' } }} />
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Le <T k="bouton">bouton</T> (BTN) désigne le donneur fictif.</li>
            <li>Juste à sa gauche, la <T k="sb">petite blinde</T> (SB) pose une mise obligatoire, en général la moitié de la grosse blinde.</li>
            <li>Juste après, la <T k="bb">grosse blinde</T> (BB) pose une mise obligatoire complète.</li>
            <li>À chaque main, le bouton avance d’un siège vers la gauche, dans le sens des aiguilles d’une montre. Les blindes suivent.</li>
            <li>Pourquoi ? Sans mise obligatoire, personne n’aurait intérêt à jouer. Les blindes créent un pot à se disputer à chaque main.</li>
            <li>En tournoi, les blindes augmentent à chaque <T k="niveau">niveau</T>, et une <T k="ante">ante</T> s’ajoute souvent : de plus en plus de jetons sont en jeu.</li>
            <li>En <T k="headsup">heads-up</T>, le bouton est aussi la petite blinde.</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      nextHandItem('', 8, randInt(0, 7)),
      nextHandItem('', 6, randInt(0, 5)),
      nextHandItem('', 4, randInt(0, 3)),
      nextHandItem('', 2, randInt(0, 1)),
      blindsItem('', 8, randInt(0, 7)),
      blindsItem('', 3, randInt(0, 2)),
    ]), 'l6t'),
  },
  fiche: {
    essentiel: [
      'Le bouton (BTN) désigne le donneur fictif.',
      'Petite blinde (SB) juste à gauche du bouton ; grosse blinde (BB) juste à gauche de la petite blinde.',
      'Le bouton avance d’un siège vers la gauche à chaque main ; les blindes le suivent.',
      'Les blindes sont obligatoires : elles créent un pot à chaque main.',
      'En tournoi, les blindes montent à chaque niveau, et une ante s’ajoute souvent.',
      'En heads-up, le bouton est aussi la petite blinde.',
    ],
    blocks: [{ kind: 'table', title: 'Qui paie quoi ? (blindes 50/100)', head: ['Siège', 'Rôle', 'Mise obligatoire'], rows: [['Bouton', 'Donneur fictif', 'aucune'], ['À gauche du bouton', 'Petite blinde (SB)', '50'], ['Encore à gauche', 'Grosse blinde (BB)', '100']] }],
    pieges: ['Faire tourner le bouton vers la droite.', 'Oublier qu’en heads-up, le bouton paie la petite blinde.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 7 · Les quatre tours d'enchères
// ════════════════════════════════════════════════════════════════════════════

const STEPS = [
  'Pose des blindes',
  'Distribution de 2 cartes à chacun',
  'Tour d’enchères préflop',
  'Carte brûlée + flop (3 cartes)',
  'Tour d’enchères au flop',
  'Carte brûlée + turn (4e carte)',
  'Tour d’enchères à la turn',
  'Carte brûlée + river (5e carte)',
  'Tour d’enchères à la river',
  'Abattage',
];

function Watcher({ done }: { done: (a: { correct: null; answer: string }) => void }) {
  const [s, setS] = useState(0);
  const b = 0; // bouton chez Alice
  const board = cards('Qh 8c 3d Jd 5s');
  const back = Object.fromEntries([...Array(8).keys()].map(i => [i, 'back' as const]));
  const scenes = [
    { cap: 'Les blindes sont posées : 50 pour la petite blinde, 100 pour la grosse blinde.', spec: { bets: { 1: '50', 2: '100' } } },
    { cap: 'Chaque joueur reçoit 2 cartes cachées, une à une, en commençant par la petite blinde.', spec: { cards: back, bets: { 1: '50', 2: '100' } } },
    { cap: 'Premier tour d’enchères, le préflop. Le premier à parler est le joueur à gauche de la grosse blinde (en bleu). Ici, seuls Bob, David et Alice restent.', spec: { cards: { 0: 'back', 1: 'back', 3: 'back' } as Record<number, 'back'>, highlight: [3], folded: [2, 4, 5, 6, 7], pot: '1 000' } },
    { cap: 'Une carte est brûlée (écartée face cachée), puis trois cartes communes sont retournées : le flop.', spec: { cards: { 0: 'back', 1: 'back', 3: 'back' } as Record<number, 'back'>, folded: [2, 4, 5, 6, 7], board: board.slice(0, 3), pot: '1 000' } },
    { cap: 'Deuxième tour d’enchères. Cette fois, c’est le premier joueur encore en jeu à gauche du bouton qui parle (Bob, la petite blinde).', spec: { cards: { 0: 'back', 1: 'back', 3: 'back' } as Record<number, 'back'>, folded: [2, 4, 5, 6, 7], board: board.slice(0, 3), highlight: [1], pot: '1 000' } },
    { cap: 'Carte brûlée, puis une 4e carte commune : la turn. Nouveau tour d’enchères, dans le même ordre.', spec: { cards: { 0: 'back', 3: 'back' } as Record<number, 'back'>, folded: [1, 2, 4, 5, 6, 7], board: board.slice(0, 4), highlight: [3], pot: '2 000' } },
    { cap: 'Carte brûlée, puis la 5e et dernière carte : la river. Dernier tour d’enchères.', spec: { cards: { 0: 'back', 3: 'back' } as Record<number, 'back'>, folded: [1, 2, 4, 5, 6, 7], board, highlight: [3], pot: '2 000' } },
    { cap: 'Il reste deux joueurs : ils montrent leurs cartes. C’est l’abattage.', spec: { cards: { 0: cards('Qs Jc'), 3: cards('Ah Qd') }, folded: [1, 2, 4, 5, 6, 7], board, pot: '2 000' } },
  ];
  const sc = scenes[s];
  return (
    <div className="stack">
      <PokerTable spec={{ n: 8, labels: NAMES, button: b, showBlinds: true, ...sc.spec }} />
      <div className="narr">{sc.cap}</div>
      <div className="row between">
        <span className="muted small">Étape {s + 1} / {scenes.length}</span>
        {s < scenes.length - 1
          ? <button className="btn" onClick={() => setS(s + 1)}>Étape suivante →</button>
          : <button className="btn primary" onClick={() => done({ correct: null, answer: 'main observée' })}>J’ai tout vu</button>}
      </div>
    </div>
  );
}

function firstToAct(n: number, button: number, street: 'pre' | 'post', folded: number[]): number {
  if (n === 2) return street === 'pre' ? button : (button + 1) % 2;
  if (street === 'pre') return (button + 3) % n;
  for (let k = 1; k <= n; k++) {
    const s = (button + k) % n;
    if (!folded.includes(s)) return s;
  }
  return button;
}

function whoActsItem(id: string): SeatItem {
  const n = pick([8, 8, 6, 5, 3, 2]);
  const b = randInt(0, n - 1);
  const street = Math.random() < 0.45 ? 'pre' : 'post';
  let folded: number[] = [];
  if (street === 'post' && n > 2) {
    const k = randInt(1, n - 2);
    folded = sample([...Array(n).keys()], k);
    // on garde la petite blinde en jeu une fois sur trois seulement
    if (Math.random() < 0.66 && !folded.includes(sbSeat(b, n))) folded.push(sbSeat(b, n));
    if (folded.length >= n - 1) folded = folded.slice(0, n - 2);
  }
  const ans = firstToAct(n, b, street, folded);
  const streetLbl = street === 'pre' ? 'avant le flop' : pick(['au flop', 'à la turn', 'à la river']);
  return {
    kind: 'seats', id,
    prompt: `Table à ${n} joueurs. Qui parle en premier ${streetLbl} ?`,
    table: { n, labels: NAMES.slice(0, n), button: b, showBlinds: true, folded, board: street === 'post' ? cards('Ks 9d 4c') : undefined },
    tokens: ['Parle'],
    solution: [ans],
    feedback: n === 2
      ? (street === 'pre' ? 'En heads-up, le bouton (qui est aussi la petite blinde) parle en premier avant le flop.' : 'En heads-up, après le flop, c’est la grosse blinde qui parle en premier ; le bouton parle en dernier.')
      : street === 'pre'
        ? 'Avant le flop : le joueur à gauche de la grosse blinde.'
        : 'Après le flop : le premier joueur encore en jeu à gauche du bouton. Les joueurs couchés ne comptent plus.',
  };
}

const L7: Lesson = {
  id: 7, module: 3,
  title: 'Les quatre tours d’enchères',
  objective: 'Connaître le déroulement d’une main et l’ordre de parole.',
  defi: {
    intro: <p>Observe une main entière, étape par étape. Ensuite, tu devras la reconstituer de mémoire.</p>,
    items: () => {
      const b = randInt(0, 7);
      const folded = [sbSeat(b, 8), (b + 4) % 8];
      return [
        { kind: 'custom', id: 'l7-1', prompt: 'Une main de Texas Hold’em, du début à la fin.', render: done => <Watcher done={done} /> },
        {
          kind: 'order', id: 'l7-2',
          prompt: 'Remets les étapes d’une main dans l’ordre.',
          items: STEPS,
          insight: 'Une main suit toujours le même ordre : blindes, cartes privées, préflop, flop, turn, river, abattage.',
        },
        {
          kind: 'seats', id: 'l7-3',
          prompt: 'Nouvelle main. Avant le flop, qui parle en premier ?',
          table: { n: 8, labels: NAMES, button: b, showBlinds: true },
          tokens: ['Parle'], solution: [(b + 3) % 8],
          insight: 'Avant le flop, le premier à parler est le joueur à gauche de la grosse blinde.',
        },
        {
          kind: 'seats', id: 'l7-4',
          prompt: 'Au flop, quatre joueurs se sont couchés (grisés). Qui parle en premier ?',
          table: { n: 8, labels: NAMES, button: b, showBlinds: true, folded: [...folded, (b + 5) % 8, (b + 6) % 8], board: cards('Ks 9d 4c') },
          tokens: ['Parle'], solution: [firstToAct(8, b, 'post', [...folded, (b + 5) % 8, (b + 6) % 8])],
          insight: 'Après le flop, c’est le premier joueur encore en jeu à gauche du bouton qui parle.',
        },
        {
          kind: 'choice', id: 'l7-5',
          prompt: 'Avant le flop, qui parle en dernier ?',
          options: ['Le bouton', 'La petite blinde', 'La grosse blinde'], answer: 2,
          insight: 'Avant le flop, la grosse blinde parle en dernier. Après, le bouton parle toujours en dernier.',
          feedback: 'La grosse blinde a déjà misé : elle parle en dernier avant le flop. Après le flop, le bouton parle en dernier.',
        },
      ];
    },
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box">
          <h3>Le déroulement d’une main</h3>
          <ol className="steps mt">
            <li>Les blindes sont posées, chacun reçoit 2 cartes.</li>
            <li><T k="preflop">Préflop</T> : premier tour d’enchères.</li>
            <li>Carte brûlée, puis <T k="flop">flop</T> (3 cartes) et tour d’enchères.</li>
            <li>Carte brûlée, puis <T k="turn">turn</T> (4e carte) et tour d’enchères.</li>
            <li>Carte brûlée, puis <T k="river">river</T> (5e carte) et dernier tour d’enchères.</li>
            <li>S’il reste au moins deux joueurs : abattage.</li>
          </ol>
        </div>
        <div className="card tight prose">
          <h3>Qui a la <T k="parole">parole</T> ?</h3>
          <ul className="mt">
            <li><strong>Préflop</strong> : le joueur à gauche de la grosse blinde parle en premier, la grosse blinde en dernier.</li>
            <li><strong>Flop, turn, river</strong> : le premier joueur encore en jeu à gauche du bouton parle en premier, le bouton en dernier.</li>
            <li><strong>Heads-up</strong> : le bouton parle en premier préflop, puis en dernier sur les tours suivants.</li>
          </ul>
        </div>
        <p className="muted">La <T k="brulee">carte brûlée</T> sert à éviter qu’un joueur aperçoive la carte suivante.</p>
      </div>
    ),
  },
  training: { items: () => Array.from({ length: 8 }, (_, i) => whoActsItem(`l7t${i}`)) },
  fiche: {
    essentiel: [
      'Une main : blindes, 2 cartes privées, préflop, flop (3 cartes), turn (1 carte), river (1 carte), abattage.',
      'Une carte est brûlée avant le flop, la turn et la river.',
      'Préflop : le joueur à gauche de la grosse blinde parle en premier, la grosse blinde en dernier.',
      'Après le flop : le premier joueur encore en jeu à gauche du bouton parle en premier, le bouton en dernier.',
      'En heads-up : le bouton parle en premier préflop, en dernier ensuite.',
    ],
    blocks: [{ kind: 'steps', title: 'La frise d’une main', steps: STEPS }],
    pieges: ['Faire parler la petite blinde en premier avant le flop.', 'Oublier les cartes brûlées.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 8 · Les actions possibles
// ════════════════════════════════════════════════════════════════════════════

const ACTIONS = ['Checker', 'Miser', 'Suivre', 'Relancer', 'Se coucher', 'Faire tapis'];

function legal(id: string, situation: string, answers: number[], feedback: string, insight?: string): MultiItem {
  return { kind: 'multi', id, prompt: <>{situation} <span className="muted">Coche toutes les actions possibles.</span></>, options: ACTIONS, answers, feedback, insight };
}

const LEGAL_BANK = [
  () => legal('', 'Au flop, personne n’a encore misé.', [0, 1, 4, 5], 'Personne n’a misé : rien à suivre ni à relancer. Se coucher est permis, mais inutile : checker ne coûte rien.'),
  () => legal('', `Au turn, ton adversaire mise ${chips(pick([200, 300, 450, 800]))}.`, [2, 3, 4, 5], 'Face à une mise : se coucher, suivre ou relancer (faire tapis est une relance). Checker n’est plus possible.'),
  () => legal('', 'Préflop, tu es grosse blinde et tout le monde a seulement suivi.', [0, 3, 4, 5], 'Ta grosse blinde compte comme une mise : tu peux checker ou relancer.'),
  () => legal('', 'Ton seul adversaire fait tapis pour 500. Il te reste 3 000.', [2, 4], 'Ton adversaire n’a plus de jetons : relancer n’aurait aucun sens. Tu suis ses 500 ou tu te couches.'),
  () => legal('', 'À la river, tu parles en premier.', [0, 1, 4, 5], 'Personne n’a misé avant toi : tu peux checker ou miser.'),
];

function minRaiseItem(id: string): NumberItem {
  const b = pick([100, 200, 400]);
  const t = randInt(0, 2);
  if (t === 0) {
    const x = b * pick([2, 3, 4, 5]);
    return { kind: 'number', id, prompt: `Blindes ${b / 2}/${b}. Au flop, ton adversaire mise ${chips(x)}. Tu veux relancer : à combien au minimum (montant total de ta mise) ?`, answer: 2 * x, feedback: `Il a misé ${chips(x)} : ta relance doit ajouter au moins ${chips(x)} de plus, soit ${chips(2 * x)}.` };
  }
  if (t === 1) {
    const x = Math.round(b * pick([2, 2.5, 3]));
    return { kind: 'number', id, prompt: `Blindes ${b / 2}/${b}. Préflop, un joueur relance à ${chips(x)}. Tu veux sur-relancer : à combien au minimum ?`, answer: x + (x - b), feedback: `Il a ajouté ${chips(x - b)} à la grosse blinde. Ta relance doit ajouter au moins autant : ${chips(x)} + ${chips(x - b)} = ${chips(2 * x - b)}.` };
  }
  const x = b * pick([2, 3]);
  const y = x * pick([2, 3]);
  return { kind: 'number', id, prompt: `Blindes ${b / 2}/${b}. Au flop, Alice mise ${chips(x)}, Bob relance à ${chips(y)}. Tu veux relancer à ton tour : à combien au minimum ?`, answer: y + (y - x), feedback: `Bob a augmenté la mise de ${chips(y - x)}. Il faut au moins ${chips(y)} + ${chips(y - x)} = ${chips(2 * y - x)}.` };
}

const L8: Lesson = {
  id: 8, module: 3,
  title: 'Les actions possibles',
  objective: 'Savoir ce qu’on a le droit de faire, et calculer une relance minimale.',
  defi: {
    intro: <p>Dans chaque situation, coche les actions qui te semblent permises. Puis tu chercheras les montants minimums.</p>,
    items: () => [
      legal('l8-1', 'Au flop, personne n’a encore misé.', [0, 1, 4, 5], 'Personne n’a misé : rien à suivre ni à relancer. Se coucher est permis, mais inutile : checker ne coûte rien.', 'Quand personne n’a misé : checker ou miser. Il n’y a rien à suivre.'),
      legal('l8-2', 'Au flop, ton adversaire mise 200.', [2, 3, 4, 5], 'Face à une mise : se coucher, suivre ou relancer. Checker n’est plus possible.', 'Face à une mise : se coucher, suivre ou relancer. Plus question de checker.'),
      legal('l8-3', 'Préflop, tu es grosse blinde et tout le monde a seulement suivi.', [0, 3, 4, 5], 'Ta grosse blinde compte déjà comme une mise : tu peux checker ou relancer.', 'La grosse blinde compte comme une mise : en grosse blinde, on peut checker si personne n’a relancé.'),
      { kind: 'number', id: 'l8-4', prompt: 'Blindes 50/100. Au flop, personne n’a misé. Quelle est la mise minimale ?', answer: 100, insight: 'La mise minimale vaut une grosse blinde.', feedback: 'Une grosse blinde, soit 100.' },
      { kind: 'number', id: 'l8-5', prompt: 'Au flop, ton adversaire mise 300. Tu veux relancer : à combien au minimum (montant total de ta mise) ?', answer: 600, insight: 'Une relance doit augmenter la mise d’au moins l’écart de la mise précédente.', feedback: 'Il a misé 300 : ta relance doit ajouter au moins 300 de plus, soit 600 au total.' },
      { kind: 'number', id: 'l8-6', prompt: 'Blindes 50/100. Préflop, un joueur relance à 250. Tu veux sur-relancer : à combien au minimum ?', answer: 400, feedback: 'Il a ajouté 150 à la grosse blinde (100 → 250). Ta relance doit ajouter au moins 150 : 250 + 150 = 400.' },
      { kind: 'choice', id: 'l8-7', prompt: 'Tu as 1 500 jetons. En No Limit, combien peux-tu miser au maximum ?', options: ['La taille du pot', '1 500 : tout ton tapis', 'Deux grosses blindes'], answer: 1, insight: 'En No Limit, la seule limite est ton tapis.', feedback: 'En No Limit, tu peux toujours miser tout ton tapis.' },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Situation</th><th>Actions possibles</th></tr></thead>
          <tbody>
            <tr><td>Personne n’a misé</td><td><T k="check">checker</T>, <T k="miser">miser</T>, faire tapis</td></tr>
            <tr><td>Face à une mise</td><td><T k="coucher">se coucher</T>, <T k="suivre">suivre</T>, <T k="relancer">relancer</T>, faire tapis</td></tr>
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>Les montants</h3>
          <ul>
            <li>Mise minimale : <strong>une grosse blinde</strong>.</li>
            <li><T k="minraise">Relance minimale</T> : on ajoute <strong>au moins l’écart</strong> de la mise ou relance précédente. Mise de 300 → relance à 600 au moins. Ouverture à 250 (blindes 50/100) → sur-relance à 400 au moins.</li>
            <li>En No Limit, la seule limite est ton tapis : tu peux <T k="allin">faire tapis</T> à tout moment.</li>
          </ul>
        </div>
        <p className="muted">Se coucher alors qu’on peut checker est permis, mais c’est jeter une chance de gagner gratuitement.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([...sample(LEGAL_BANK, 4).map(f => f()), ...Array.from({ length: 4 }, () => minRaiseItem(''))]), 'l8t'),
  },
  fiche: {
    essentiel: [
      'Personne n’a misé : checker, miser ou faire tapis.',
      'Face à une mise : se coucher, suivre, relancer ou faire tapis.',
      'Mise minimale : une grosse blinde.',
      'Relance minimale : ajouter au moins l’écart de la mise ou relance précédente.',
      'En No Limit, on peut miser tout son tapis à tout moment.',
    ],
    blocks: [{ kind: 'table', title: 'Exemples de relance minimale (blindes 50/100)', head: ['Situation', 'Relance minimale'], rows: [['Mise de 300 au flop', '600'], ['Ouverture à 250 préflop', '400'], ['Mise de 200, relance à 600', '1 000']] }],
    pieges: ['Checker face à une mise.', 'Relancer d’un montant trop petit.', 'Se coucher alors qu’on pouvait checker.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 9 · Compter le pot et les tapis
// ════════════════════════════════════════════════════════════════════════════

function potItem(id: string): NumberItem {
  const b = pick([100, 200]);
  const open = Math.round(b * pick([2.5, 3]));
  const callers = randInt(0, 2);
  const bbCalls = Math.random() < 0.5;
  const pot = open * (1 + callers + (bbCalls ? 1 : 0)) + b / 2 + (bbCalls ? 0 : b);
  const who = callers === 0 ? '' : callers === 1 ? ' Un joueur suit.' : ' Deux joueurs suivent.';
  return {
    kind: 'number', id,
    prompt: `Blindes ${b / 2}/${b}. Un joueur relance à ${chips(open)}.${who} La petite blinde se couche, la grosse blinde ${bbCalls ? 'suit' : 'se couche'}. Combien y a-t-il dans le pot ?`,
    answer: pot,
    feedback: `${1 + callers + (bbCalls ? 1 : 0)} × ${chips(open)} + petite blinde ${b / 2}${bbCalls ? '' : ` + grosse blinde ${b}`} = ${chips(pot)}.`,
  };
}
function toCallItem(id: string): NumberItem {
  const a = pick([200, 300, 500, 800]);
  const r = a * pick([3, 3.5, 4]);
  return { kind: 'number', id, prompt: `Tu as misé ${chips(a)}. Ton adversaire relance à ${chips(r)}. Combien dois-tu ajouter pour suivre ?`, answer: r - a, feedback: `${chips(r)} − ${chips(a)} déjà misés = ${chips(r - a)}.` };
}
function bbItem(id: string): NumberItem {
  const b = pick([200, 400, 600, 800, 1000, 2000]);
  const n = randInt(8, 45);
  return { kind: 'number', id, prompt: `Tournoi, blindes ${chips(b / 2)}/${chips(b)}. Tu as ${chips(n * b)} jetons. Combien de grosses blindes ?`, answer: n, unit: 'BB', feedback: `${chips(n * b)} ÷ ${chips(b)} = ${n} BB.` };
}
function sidePotItem(id: string): NumberItem {
  const a = pick([1000, 1500, 2000, 3000]);
  const x = pick([2000, 4000, 5000]);
  const main = Math.random() < 0.5;
  return {
    kind: 'number', id,
    prompt: `Alice fait tapis avec ${chips(a)}. Bob et Carla, qui ont beaucoup plus, suivent. Ensuite Bob mise ${chips(x)} et Carla suit. ${main ? 'Combien Alice peut-elle gagner au maximum ?' : 'Combien contient le pot annexe ?'}`,
    answer: main ? 3 * a : 2 * x,
    feedback: `Pot principal : 3 × ${chips(a)} = ${chips(3 * a)} (Alice peut le gagner). Pot annexe : 2 × ${chips(x)} = ${chips(2 * x)} (entre Bob et Carla seulement).`,
  };
}

const L9: Lesson = {
  id: 9, module: 3,
  title: 'Compter le pot et les tapis',
  objective: 'Calculer le pot, le montant à suivre et les pots annexes.',
  defi: {
    intro: <p>Tu es le caissier de la table. Suis les actions et calcule. Prends ton temps, un brouillon peut aider.</p>,
    items: () => [
      { kind: 'number', id: 'l9-1', prompt: 'Blindes 50/100. UTG relance à 300, le bouton suit, les deux blindes se couchent. Combien y a-t-il dans le pot ?', answer: 750, insight: 'Le pot contient toutes les mises, y compris les blindes des joueurs qui se sont couchés.', feedback: '300 (UTG) + 300 (bouton) + 50 (petite blinde) + 100 (grosse blinde) = 750. Les blindes restent dans le pot.' },
      { kind: 'number', id: 'l9-2', prompt: 'Au flop, UTG mise 400. Le bouton relance à 1 200. Combien UTG doit-il ajouter pour suivre ?', answer: 800, insight: 'Pour suivre, on paie la différence entre la mise la plus haute et ce qu’on a déjà misé.', feedback: '1 200 − 400 déjà misés = 800.' },
      { kind: 'number', id: 'l9-3', prompt: 'UTG suit. Combien y a-t-il maintenant dans le pot ?', answer: 3150, feedback: '750 avant le flop + 1 200 + 1 200 = 3 150.' },
      {
        kind: 'choice', id: 'l9-4',
        prompt: 'Trois joueurs. Alice fait tapis avec 2 000. Bob et Carla (10 000 chacun) suivent. Ensuite, Bob mise 3 000 et Carla suit. Si Alice a la meilleure main, combien gagne-t-elle au maximum ?',
        scene: <Narr lines={['Alice : tapis 2 000', 'Bob : suit 2 000, puis mise 3 000', 'Carla : suit 2 000, puis suit 3 000']} />,
        options: ['2 000', '6 000', '12 000'], columns: 3, answer: 1,
        insight: 'Un joueur à tapis ne gagne de chaque adversaire que ce qu’il a lui-même misé.',
        feedback: 'Elle ne peut gagner que ce qu’elle a couvert : 2 000 de chaque joueur (le sien compris), soit 6 000. Les 6 000 misés ensuite par Bob et Carla forment un pot à part.',
      },
      { kind: 'number', id: 'l9-5', prompt: 'Et ce pot à part, que Bob et Carla se disputent, combien contient-il ?', answer: 6000, insight: 'Les mises qu’un joueur à tapis ne peut pas couvrir forment un pot annexe.', feedback: '3 000 + 3 000 = 6 000. On l’appelle le pot annexe : Alice ne peut pas le gagner.' },
      { kind: 'number', id: 'l9-6', prompt: 'Tournoi, blindes 400/800. Tu as 18 400 jetons. Combien de grosses blindes cela fait-il ?', answer: 23, unit: 'BB', insight: 'En tournoi, on compte son tapis en grosses blindes.', feedback: '18 400 ÷ 800 = 23 grosses blindes.' },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Le pot contient <strong>toutes les mises</strong>, y compris les blindes des joueurs couchés.</li>
            <li>Pour suivre, on paie <strong>la mise la plus haute moins ce qu’on a déjà misé</strong> dans ce tour.</li>
            <li>Un joueur à tapis ne gagne de chaque adversaire que <strong>ce qu’il a lui-même misé</strong>. Le reste forme un <T k="potannexe">pot annexe</T>, disputé par les autres.</li>
            <li>En tournoi, on mesure les tapis en <T k="tapisbb">grosses blindes</T> : 18 400 jetons en 400/800, c’est 23 BB. C’est ce chiffre qui dicte la stratégie, pas le nombre de jetons.</li>
          </ul>
        </div>
        <table className="tbl">
          <thead><tr><th>Exemple</th><th className="r">Alice</th><th className="r">Bob</th><th className="r">Carla</th><th className="r">Total</th></tr></thead>
          <tbody>
            <tr><td>Pot principal</td><td className="r">2 000</td><td className="r">2 000</td><td className="r">2 000</td><td className="r">6 000</td></tr>
            <tr><td>Pot annexe</td><td className="r">·</td><td className="r">3 000</td><td className="r">3 000</td><td className="r">6 000</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([potItem(''), potItem(''), toCallItem(''), bbItem(''), bbItem(''), sidePotItem(''), sidePotItem('')]), 'l9t'),
  },
  fiche: {
    essentiel: [
      'Le pot contient toutes les mises, y compris les blindes des joueurs couchés.',
      'Montant à suivre = mise la plus haute − ce qu’on a déjà misé dans ce tour.',
      'Un joueur à tapis ne gagne de chaque adversaire que ce qu’il a misé lui-même.',
      'Les mises au-delà forment un pot annexe, disputé sans lui.',
      'En tournoi : tapis en BB = jetons ÷ grosse blinde.',
    ],
    blocks: [{ kind: 'table', title: 'Pot principal et pot annexe', head: ['', 'Alice (tapis 2 000)', 'Bob', 'Carla', 'Total'], rows: [['Pot principal', '2 000', '2 000', '2 000', '6 000'], ['Pot annexe', '-', '3 000', '3 000', '6 000']] }],
    pieges: ['Oublier les blindes dans le pot.', 'Payer la totalité de la relance alors qu’on a déjà misé une partie.', 'Croire qu’un joueur à tapis peut gagner tout le pot.'],
  },
};

export const LESSONS_M3 = [L6, L7, L8, L9];
