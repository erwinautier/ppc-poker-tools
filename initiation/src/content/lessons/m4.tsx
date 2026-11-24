/** Module 4 · Les principes du préflop : leçons 10 à 12. */
import { useEffect, useRef, useState } from 'react';
import type { ChoiceItem, Item, Lesson, NumberItem, SeatItem } from '../types';
import type { ItemResult } from '../../lib/progress';
import { CardRow, HandGrid, Inline } from '../../components/Cards';
import { PokerTable, positionNames, positionOf, seatOfPosition } from '../../components/PokerTable';
import { T } from '../../components/Term';
import { sample, withIds } from '../helpers';
import { type Card, cards, cardsForCode, codeLabel, pick, randInt, shuffle } from '../../lib/cards';
import { type Equity, equityRun, share } from '../../lib/sims';
import {
  type Decision, type PosGroup, ALL_HANDS, BB_CALL, BB_3BET, GROUP_LABEL, OPEN, OPEN_SPEC, SEAT_GROUP, VS_RAISE_3BET, VS_RAISE_CALL,
  bbDecision, openDecision, pct, vsRaiseDecision, BB_CALL_SPEC, VS_RAISE_CALL_SPEC, VS_RAISE_3BET_SPEC,
} from '../../lib/chart';

// ════════════════════════════════════════════════════════════════════════════
// Leçon 10 · Toutes les mains de départ ne se valent pas
// ════════════════════════════════════════════════════════════════════════════

function Duel({ a, b, done }: { a: Card[]; b: Card[]; done: (x: { correct: boolean; answer: string; expected: string }) => void }) {
  const [choice, setChoice] = useState<'a' | 'b' | null>(null);
  const [eq, setEq] = useState<Equity | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const go = (c: 'a' | 'b') => {
    if (choice) return;
    setChoice(c);
    let acc: Equity | undefined;
    let k = 0;
    const step = () => {
      acc = equityRun(a, b, [], 1500, acc);
      setEq(acc);
      if (++k < 14) timer.current = window.setTimeout(step, 70);
      else {
        const sa = share(acc, 'a'), sb = share(acc, 'b');
        const fav: 'a' | 'b' = sa >= sb ? 'a' : 'b';
        done({ correct: c === fav, answer: c === 'a' ? 'main A' : 'main B', expected: fav === 'a' ? 'main A' : 'main B' });
      }
    };
    step();
  };
  const sa = eq ? share(eq, 'a') : 0, sb = eq ? share(eq, 'b') : 0;
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-around' }}>
        <button className={`opt ${choice === 'a' ? 'sel' : ''}`} style={{ textAlign: 'center' }} disabled={!!choice} onClick={() => go('a')}>
          <div className="small muted mb">Main A</div><CardRow cs={a} />
        </button>
        <span className="muted">contre</span>
        <button className={`opt ${choice === 'b' ? 'sel' : ''}`} style={{ textAlign: 'center' }} disabled={!!choice} onClick={() => go('b')}>
          <div className="small muted mb">Main B</div><CardRow cs={b} />
        </button>
      </div>
      {!choice && <p className="muted center small">Touche la main qui gagnera le plus souvent si les 5 cartes communes sont distribuées.</p>}
      {eq && (
        <div className="stack" style={{ gap: 4 }}>
          <div className="eqbar">
            <div className="ea" style={{ width: `${sa * 100}%` }}>A {Math.round(sa * 100)} %</div>
            <div className="eb" style={{ width: `${sb * 100}%` }}>B {Math.round(sb * 100)} %</div>
          </div>
          <span className="muted small center">{eq.n.toLocaleString('fr-FR')} boards simulés{eq.tie ? ` · ${Math.round((eq.tie / eq.n) * 100)} % d’égalités (partagées)` : ''}</span>
        </div>
      )}
    </div>
  );
}

function duelItem(id: string, a: string, b: string, insight: string, feedback: string): Item {
  return { kind: 'custom', id, prompt: 'Duel préflop : quelle main est favorite ?', render: done => <Duel a={cards(a)} b={cards(b)} done={done} />, insight, feedback };
}

type Family = 'Premium' | 'Grosses cartes' | 'Paires moyennes et petites' | 'As assortis' | 'Connecteurs assortis' | 'Le reste';
const FAMILIES: Family[] = ['Premium', 'Grosses cartes', 'Paires moyennes et petites', 'As assortis', 'Connecteurs assortis', 'Le reste'];
function familyOf(h: string): Family {
  if (['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'].includes(h)) return 'Premium';
  if (h.length === 2) return 'Paires moyennes et petites';
  const hi = 'AKQJT';
  if (hi.includes(h[0]) && hi.includes(h[1])) return 'Grosses cartes';
  if (h[0] === 'A' && h[2] === 's') return 'As assortis';
  const r = '23456789TJQKA';
  if (h[2] === 's' && r.indexOf(h[0]) - r.indexOf(h[1]) === 1) return 'Connecteurs assortis';
  return 'Le reste';
}
const FAMILY_CLASS: Record<Family, string | undefined> = {
  Premium: 'raise', 'Grosses cartes': 'call', 'Paires moyennes et petites': 'in', 'As assortis': 'in', 'Connecteurs assortis': 'in', 'Le reste': undefined,
};

function GridPick({ target, done }: { target: string; done: (x: { correct: boolean; answer: string; expected: string }) => void }) {
  const [clicked, setClicked] = useState<string | null>(null);
  return (
    <HandGrid
      onCell={clicked ? undefined : h => { setClicked(h); done({ correct: h === target, answer: h, expected: target }); }}
      showLabels={!!clicked}
      classFor={h => (clicked && h === target ? 'good' : clicked && h === clicked ? 'bad' : undefined)}
    />
  );
}

function gridItem(id: string): Item {
  const target = pick(ALL_HANDS);
  const kind = target.length === 2 ? 'une paire : sur la diagonale' : target[2] === 's' ? 'assortie : au-dessus de la diagonale' : 'dépareillée : en dessous de la diagonale';
  return {
    kind: 'custom', id,
    prompt: <>Touche la case de la main <strong>{codeLabel(target)}</strong> <Inline cs={cardsForCode(target).join(' ')} /> dans la grille (sans étiquettes !).</>,
    render: done => <GridPick target={target} done={done} />,
    feedback: `La main est ${kind}. Ligne = carte la plus haute, colonne = carte la plus basse (ou l’inverse pour les dépareillées).`,
  };
}

function dominationItem(id: string): ChoiceItem {
  const R = '23456789TJQKA';
  for (;;) {
    const shared = pick([...'AKQJT9']);
    const [x, y] = sample([...R].filter(c => c !== shared), 2);
    const none = Math.random() < 0.25;
    let h1: string, h2: string;
    if (none) {
      const [p, q, r2, s2] = sample([...R], 4);
      h1 = [p, q].sort((m, n) => R.indexOf(n) - R.indexOf(m)).join('') + 'o';
      h2 = [r2, s2].sort((m, n) => R.indexOf(n) - R.indexOf(m)).join('') + 'o';
      const opts = [codeLabel(h1), codeLabel(h2), 'Aucune'];
      return { kind: 'choice', id, prompt: 'Laquelle de ces deux mains est dominée par l’autre ?', options: opts, columns: 3, answer: 2, feedback: 'Elles n’ont aucune carte en commun : aucune ne domine l’autre.' };
    }
    const mk = (o: string) => [shared, o].sort((m, n) => R.indexOf(n) - R.indexOf(m)).join('') + 'o';
    h1 = mk(x); h2 = mk(y);
    if (h1 === h2) continue;
    const dominated = R.indexOf(x) < R.indexOf(y) ? 0 : 1;
    return {
      kind: 'choice', id, prompt: 'Laquelle de ces deux mains est dominée par l’autre ?',
      options: [codeLabel(h1), codeLabel(h2), 'Aucune'], columns: 3, answer: dominated,
      feedback: `Elles partagent le ${shared === 'T' ? '10' : shared} ; ${codeLabel(dominated === 0 ? h1 : h2)} a le moins bon kicker. Si les deux touchent la même paire, elle perd.`,
    };
  }
}

function familyItem(id: string): ChoiceItem {
  const fam = pick(FAMILIES);
  const candidates = ALL_HANDS.filter(h => familyOf(h) === fam);
  const h = pick(candidates);
  return { kind: 'choice', id, prompt: <>À quelle famille appartient <strong>{codeLabel(h)}</strong> ?</>, options: FAMILIES, columns: 2, answer: FAMILIES.indexOf(fam), feedback: `${codeLabel(h)} : ${fam.toLowerCase()}.` };
}

const L10: Lesson = {
  id: 10, module: 4,
  title: 'Toutes les mains de départ ne se valent pas',
  objective: 'Lire la grille des 169 mains et repérer les mains dominées.',
  defi: {
    intro: <p>Des duels : deux mains s’affrontent avant le flop. Choisis celle qui gagnera le plus souvent, puis regarde la simulation trancher.</p>,
    items: () => [
      duelItem('l10-1', 'Ah Kd', '2s 2c', 'Une petite paire est légèrement favorite face à deux grosses cartes : c’est un « coin flip ».', 'La paire de 2 est déjà formée ; AK doit toucher une paire. Environ 52/48 : presque pile ou face.'),
      duelItem('l10-2', 'As Ac', 'Kh Kd', 'Une paire contre une paire plus petite : environ 80/20.', 'KK doit toucher un roi (ou une combinaison) pour gagner : environ 1 fois sur 5.'),
      duelItem('l10-3', 'Ah Ks', 'Ad Qc', 'Une main dominée (même carte, moins bon kicker) ne gagne qu’environ 1 fois sur 4.', 'Quand les deux touchent un as, AK gagne grâce à son kicker. AQ est « dominée ».'),
      duelItem('l10-4', '9h 8h', 'Ac Kd', 'Deux grosses cartes battent deux cartes moyennes, même assorties et connectées.', 'Les cartes hautes gagnent plus souvent ; 98 assortis gardent malgré tout près de 40 %.'),
      duelItem('l10-5', 'Kh Qd', 'As 7c', 'Un as, même avec un petit kicker, est légèrement favori face à deux têtes.', 'L’as domine les cartes hautes s’il n’y a pas de paire ; KQ garde de bonnes chances grâce à ses deux cartes hautes.'),
      {
        kind: 'choice', id: 'l10-6',
        prompt: 'Voici la grille des 169 mains de départ. Où sont les mains assorties (« s ») ?',
        scene: <HandGrid />,
        options: ['Au-dessus de la diagonale', 'Sur la diagonale', 'En dessous de la diagonale'], answer: 0,
        insight: 'Dans la grille : paires sur la diagonale, assorties au-dessus, dépareillées en dessous.',
        feedback: 'Les paires sont sur la diagonale, les assorties (s) au-dessus, les dépareillées (o) en dessous.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Il existe <strong>169 mains de départ</strong> : 13 paires, 78 <T k="assortie">assorties</T> (s) et 78 <T k="depareillee">dépareillées</T> (o).</li>
            <li>Dans la grille : paires sur la diagonale, assorties au-dessus, dépareillées en dessous.</li>
            <li>Une main est <T k="domine">dominée</T> quand elle partage une carte avec une autre mais a un moins bon kicker (AQ face à AK) : elle ne gagne qu’environ 1 fois sur 4.</li>
            <li>Paire contre paire plus petite : environ 80/20. Paire contre deux cartes plus hautes : environ 50/50.</li>
            <li>Être assorti n’ajoute que <strong>2 à 3 %</strong> d’équité. Ce n’est pas une raison de jouer une main.</li>
          </ul>
        </div>
        <h3>Les familles de mains</h3>
        <HandGrid classFor={h => FAMILY_CLASS[familyOf(h)]} />
        <div className="row wrap small">
          <span className="pill" style={{ background: 'var(--raise-bg)', color: 'var(--raise-fg)' }}>Premium</span>
          <span className="pill on">Grosses cartes (<T k="broadway">broadway</T>)</span>
          <span className="pill ok">Paires, As assortis, <T k="connecteurs">connecteurs assortis</T></span>
          <span className="pill">Le reste</span>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([gridItem(''), gridItem(''), gridItem(''), dominationItem(''), dominationItem(''), dominationItem(''), familyItem(''), familyItem(''), familyItem(''), familyItem('')]), 'l10t'),
  },
  fiche: {
    essentiel: [
      '169 mains de départ : 13 paires, 78 assorties (s), 78 dépareillées (o).',
      'Grille 13×13 : paires sur la diagonale, assorties au-dessus, dépareillées en dessous.',
      'Main dominée : même carte, moins bon kicker (AQ face à AK) ; environ 25 % de chances.',
      'Paire contre paire plus petite : environ 80/20. Paire contre deux cartes plus hautes : environ 50/50.',
      'Être assorti n’ajoute que 2 à 3 % d’équité.',
    ],
    blocks: [{
      kind: 'table', title: 'Les familles de mains', head: ['Famille', 'Exemples'], rows: [
        ['Premium', 'AA, KK, QQ, JJ, AK'], ['Grosses cartes (broadway)', 'AQ, AJ, KQ, KJ, QJ, JT'], ['Paires moyennes et petites', 'TT à 22'],
        ['As assortis', 'A9s à A2s'], ['Connecteurs assortis', 'T9s, 98s, 87s, 76s, 65s'], ['Le reste', 'K7o, Q4s, 92o, 72o…'],
      ],
    }],
    pieges: ['Surestimer une main parce qu’elle est assortie.', 'Jouer un As avec un petit kicker comme une grosse main.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 11 · La position, un avantage
// ════════════════════════════════════════════════════════════════════════════

const PRE_ORDER = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POST_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN'];

function seatPosItem(id: string): SeatItem {
  const b = randInt(0, 7);
  const pos = pick(positionNames(8));
  return {
    kind: 'seats', id,
    prompt: <>Le bouton est indiqué. Touche le siège <strong>{pos}</strong>.</>,
    table: { n: 8, button: b, labels: Array(8).fill('Joueur') },
    tokens: [pos], solution: [seatOfPosition(pos, b, 8)],
    feedback: `Depuis le bouton, dans le sens horaire : BTN, SB, BB, UTG, UTG+1, MP, HJ, CO.`,
  };
}
function whoHasPositionItem(id: string): ChoiceItem {
  const [p, q] = sample(POST_ORDER, 2);
  const later = POST_ORDER.indexOf(p) > POST_ORDER.indexOf(q) ? p : q;
  return {
    kind: 'choice', id, prompt: <>Au flop, entre le <strong>{p}</strong> et le <strong>{q}</strong>, qui a la position (parle après l’autre) ?</>,
    options: [p, q], columns: 2, answer: later === p ? 0 : 1,
    feedback: 'Après le flop, l’ordre est : SB, BB, UTG, UTG+1, MP, HJ, CO et enfin BTN.',
  };
}
function behindItem(id: string): NumberItem {
  const pos = pick(PRE_ORDER);
  const k = 7 - PRE_ORDER.indexOf(pos);
  return { kind: 'number', id, prompt: <>Table à 8. Tu es en <strong>{pos}</strong>. Combien de joueurs parlent après toi avant le flop ?</>, answer: k, feedback: `Avant le flop, l’ordre est UTG, UTG+1, MP, HJ, CO, BTN, SB, BB : après ${pos}, il en reste ${k}.` };
}

const L11: Lesson = {
  id: 11, module: 4,
  title: 'La position, un avantage',
  objective: 'Comprendre pourquoi parler en dernier aide, et nommer les positions.',
  defi: {
    intro: <p>La même main, jouée deux fois depuis deux places différentes. Il n’y a pas de bonne réponse aux deux premières questions : décide simplement.</p>,
    items: () => [
      {
        kind: 'choice', id: 'l11-1',
        prompt: 'Tu es grosse blinde avec Q♠Q♣. Le bouton a relancé, tu as suivi. Le flop tombe. Tu parles en premier : que fais-tu ?',
        scene: <PokerTable spec={{ n: 2, labels: ['Toi (BB)', 'Bouton'], hero: 0, cards: { 0: cards('Qs Qc'), 1: 'back' }, board: cards('Kd 8c 3h'), pot: '5,5 BB' }} />,
        options: ['Checker', 'Miser'], columns: 2, answer: null,
      },
      {
        kind: 'choice', id: 'l11-2',
        prompt: 'Même main, même flop. Mais cette fois, c’est toi le bouton : ton adversaire parle avant toi et checke. Que fais-tu ?',
        scene: <PokerTable spec={{ n: 2, labels: ['Toi (BTN)', 'BB : check'], hero: 0, cards: { 0: cards('Qs Qc'), 1: 'back' }, board: cards('Kd 8c 3h'), pot: '5,5 BB', highlight: [1] }} />,
        options: ['Checker', 'Miser'], columns: 2, answer: null,
      },
      {
        kind: 'choice', id: 'l11-3',
        prompt: 'Dans quelle version avais-tu le plus d’informations pour décider ?',
        options: ['La première : je parlais en premier', 'La seconde : je parlais en dernier'], answer: 1,
        insight: 'Parler en dernier, c’est décider en connaissant déjà l’action de l’adversaire : c’est « avoir la position ».',
        feedback: 'En parlant en dernier, tu savais déjà que ton adversaire avait checké, signe d’une main plutôt faible.',
      },
      {
        kind: 'choice', id: 'l11-4',
        prompt: <>Tout le monde s’est couché jusqu’à toi. Avec <Inline cs="Ad 9c" />, d’où préfères-tu relancer ?</>,
        options: ['UTG : le premier à parler', 'Le bouton'], columns: 2, answer: 1,
        insight: 'Une main moyenne se joue mieux en fin de parole qu’en début de parole.',
        feedback: 'Au bouton, seuls les deux blindes peuvent encore réagir, et tu auras la position après le flop.',
      },
      { kind: 'number', id: 'l11-5', prompt: 'Table à 8. Tu es le premier à parler avant le flop (UTG). Combien de joueurs parlent après toi ?', answer: 7, insight: 'Plus il reste de joueurs derrière toi, plus il y a de chances que l’un d’eux ait une très bonne main.', feedback: 'Sept joueurs : autant d’adversaires qui peuvent avoir une grosse main.' },
      { kind: 'number', id: 'l11-6', prompt: 'Et si tu es au bouton ?', answer: 2, feedback: 'Seulement la petite et la grosse blinde.' },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <PokerTable spec={{ n: 8, button: 0, showPositions: true, showBlinds: true }} />
        <table className="tbl">
          <thead><tr><th>Groupe</th><th>Positions</th></tr></thead>
          <tbody>
            <tr><td>Précoces</td><td><T k="utg">UTG</T>, UTG+1</td></tr>
            <tr><td>Milieu</td><td><T k="mp">MP, HJ</T></td></tr>
            <tr><td>Tardives</td><td><T k="co">CO</T>, BTN</td></tr>
            <tr><td>Blindes</td><td>SB, BB</td></tr>
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Avoir la <T k="position">position</T>, c’est parler après son adversaire : on décide avec plus d’informations.</li>
            <li>Après le flop, le bouton parle <strong>toujours en dernier</strong> : c’est la meilleure place de la table.</li>
            <li>En début de parole, beaucoup de joueurs restent à parler derrière toi : joue <strong>serré</strong>. Plus tu te rapproches du bouton, plus tu peux jouer de mains.</li>
            <li>Les blindes parlent en premier après le flop : c’est la position la plus difficile.</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([seatPosItem(''), seatPosItem(''), seatPosItem(''), whoHasPositionItem(''), whoHasPositionItem(''), whoHasPositionItem(''), behindItem(''), behindItem('')]), 'l11t'),
  },
  fiche: {
    essentiel: [
      'Avoir la position, c’est parler après son adversaire.',
      'Après le flop, le bouton parle toujours en dernier.',
      'Plus il reste de joueurs derrière soi, plus il faut jouer serré.',
      'Plus on est proche du bouton, plus on peut jouer de mains.',
    ],
    blocks: [{
      kind: 'table', title: 'Les positions d’une table à 8', head: ['Groupe', 'Positions', 'Joueurs derrière (préflop)'],
      rows: [['Précoces', 'UTG, UTG+1', '7, 6'], ['Milieu', 'MP, HJ', '5, 4'], ['Tardives', 'CO, BTN', '3, 2'], ['Blindes', 'SB, BB', '1, 0']],
    }],
    pieges: ['Jouer autant de mains en début de parole qu’au bouton.', 'Oublier que les blindes parlent en premier après le flop.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 12 · Ouvrir, suivre ou se coucher
// ════════════════════════════════════════════════════════════════════════════

const PRE_OPTS = ['Se coucher', 'Suivre (limper)', 'Relancer'];
const DEC_INDEX: Record<Decision, number> = { fold: 0, call: 1, raise: 2 };
const DEC_LABEL: Record<Decision, string> = { fold: 'se coucher', call: 'suivre', raise: 'relancer' };

function openItem(id: string, pos: string, code: string, silent: boolean): ChoiceItem {
  const g = SEAT_GROUP[pos];
  const d = openDecision(g, code);
  const cs = cardsForCode(code);
  const seat = 0;
  const btn = (seat - positionNames(8).indexOf(pos) + 8) % 8;
  return {
    kind: 'choice', id, silent,
    prompt: <>Tout le monde s’est couché jusqu’à toi. Tu es <strong>{pos}</strong> avec <Inline cs={cs.join(' ')} /> Que fais-tu ?</>,
    scene: <PokerTable spec={{ n: 8, button: btn, showBlinds: true, showPositions: true, hero: 0, cards: { 0: cs }, folded: [...Array(8).keys()].filter(i => PRE_ORDER.indexOf(positionOf(i, btn, 8)) < PRE_ORDER.indexOf(pos)) }} />,
    options: PRE_OPTS,
    answer: DEC_INDEX[d],
    feedback: d === 'raise'
      ? `${codeLabel(code)} fait partie des mains à ouvrir en ${pos} : on relance à environ 2,5 BB.`
      : `${codeLabel(code)} ne fait pas partie des mains à ouvrir en ${pos} : on se couche.${pos === 'SB' ? '' : ' Et on ne limpe pas.'}`,
    ref: 12,
  };
}

function vsRaiseItem(id: string): ChoiceItem {
  const pos = pick(['HJ', 'CO', 'BTN']);
  const raiser = pick(['UTG', 'UTG+1', 'MP'].filter(p => PRE_ORDER.indexOf(p) < PRE_ORDER.indexOf(pos)));
  const pool = Math.random() < 0.6 ? [...VS_RAISE_3BET, ...VS_RAISE_CALL] : ALL_HANDS.filter(h => OPEN.bouton.has(h));
  const code = pick(pool);
  const d = vsRaiseDecision(code);
  const cs = cardsForCode(code);
  return {
    kind: 'choice', id,
    prompt: <>Le joueur <strong>{raiser}</strong> relance à 2,5 BB. Les autres se couchent. Tu es <strong>{pos}</strong> avec <Inline cs={cs.join(' ')} /> Que fais-tu ?</>,
    options: ['Se coucher', 'Suivre', 'Relancer (3-bet)'], answer: DEC_INDEX[d],
    feedback: d === 'raise' ? `${codeLabel(code)} est l’une des meilleures mains : on relance (3-bet), à environ 3 fois la relance.`
      : d === 'call' ? `${codeLabel(code)} est assez forte pour suivre, pas pour relancer.`
        : `Face à une relance, ${codeLabel(code)} ne suffit pas : on se couche.`,
  };
}

function bbItem(id: string): ChoiceItem {
  const pool = Math.random() < 0.6 ? [...BB_CALL, ...BB_3BET] : ALL_HANDS;
  const code = pick(pool);
  const d = bbDecision(code);
  const cs = cardsForCode(code);
  return {
    kind: 'choice', id,
    prompt: <>Le bouton relance à 2,5 BB, la petite blinde se couche. Tu es <strong>grosse blinde</strong> avec <Inline cs={cs.join(' ')} /> Que fais-tu ?</>,
    options: ['Se coucher', 'Suivre', 'Relancer (3-bet)'], answer: DEC_INDEX[d],
    feedback: d === 'raise' ? `${codeLabel(code)} : on relance (3-bet).`
      : d === 'call' ? `${codeLabel(code)} : tu as déjà payé 1 BB et il ne te reste que 1,5 BB à ajouter. On défend en suivant.`
        : `${codeLabel(code)} est trop faible, même avec une grosse blinde déjà payée : on se couche.`,
  };
}

function randomOpenItem(id: string): ChoiceItem {
  const pos = pick(['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB']);
  const g = SEAT_GROUP[pos];
  const inR = [...OPEN[g]];
  const code = Math.random() < 0.5 ? pick(inR) : pick(ALL_HANDS);
  return openItem(id, pos, code, false);
}

const DEFI_HANDS: [string, string][] = [
  ['UTG', 'KJo'], ['UTG', 'QQ'], ['MP', 'A9s'], ['MP', 'K9o'], ['HJ', '76s'],
  ['CO', 'A5s'], ['CO', 'KTo'], ['BTN', 'Q9o'], ['BTN', '72o'], ['SB', '33'],
];

function Demo({ done }: { done: (a: { correct: null; answer: string }) => void }) {
  const [s, setS] = useState(0);
  return (
    <div className="stack">
      <PokerTable spec={{
        n: 8, button: 0, showBlinds: true, showPositions: true, hero: 0, cards: { 0: cards('Ks Jd') },
        folded: s === 0 ? [3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7], bets: s === 0 ? { 0: '2,5 BB', 1: '0,5', 2: '1' } : { 0: '+1,5 BB' },
      }} />
      <div className="narr">{s === 0 ? 'Tu es au bouton avec K♠J♦ et tu relances à 2,5 BB. Les blindes réfléchissent…' : 'Les deux blindes se couchent. Tu ramasses 1,5 BB sans même voir le flop, et sans montrer tes cartes.'}</div>
      {s === 0 ? <button className="btn" onClick={() => setS(1)}>Voir la suite →</button> : <button className="btn primary" onClick={() => done({ correct: null, answer: 'démonstration vue' })}>Continuer</button>}
    </div>
  );
}

function ChartTabs() {
  const [g, setG] = useState<PosGroup | 'vs' | 'bb'>('precoce');
  const tabs: [PosGroup | 'vs' | 'bb', string][] = [['precoce', 'UTG'], ['milieu', 'MP/HJ'], ['tardive', 'CO'], ['bouton', 'BTN'], ['sb', 'SB'], ['vs', 'Face à une relance'], ['bb', 'Défense BB']];
  const classFor = (h: string) => {
    if (g === 'vs') return VS_RAISE_3BET.has(h) ? 'raise' : VS_RAISE_CALL.has(h) ? 'call' : undefined;
    if (g === 'bb') return BB_3BET.has(h) ? 'raise' : BB_CALL.has(h) ? 'call' : undefined;
    return OPEN[g].has(h) ? 'raise' : undefined;
  };
  const set = g === 'vs' ? new Set([...VS_RAISE_3BET, ...VS_RAISE_CALL]) : g === 'bb' ? new Set([...BB_3BET, ...BB_CALL]) : OPEN[g];
  return (
    <div className="stack">
      <div className="row wrap">
        {tabs.map(([k, l]) => <button key={k} className={`btn sm ${g === k ? 'primary' : ''}`} onClick={() => setG(k)}>{l}</button>)}
      </div>
      <p className="small muted">
        {g === 'vs' ? 'Un joueur a relancé avant toi : en or, on relance (3-bet) ; en bleu, on suit ; le reste, on jette.'
          : g === 'bb' ? 'Tu es grosse blinde face à une seule relance : en or, on relance ; en bleu, on suit.'
            : `${GROUP_LABEL[g]} : en or, les mains à relancer quand tout le monde s’est couché avant toi.`}
        {' '}Soit {pct(set)} % des mains.
      </p>
      <HandGrid classFor={classFor} />
    </div>
  );
}

function recap12(results: ItemResult[]) {
  const dec = results.filter(r => r.id.startsWith('l12-h'));
  if (!dec.length) return null;
  const played = dec.filter(r => r.answer !== PRE_OPTS[0]).length;
  const limps = dec.filter(r => r.answer === PRE_OPTS[1]).length;
  const good = dec.filter(r => r.correct).length;
  const chartPlays = DEFI_HANDS.filter(([p, h]) => openDecision(SEAT_GROUP[p], h) === 'raise').length;
  return (
    <div className="card tight stack">
      <h3>Ton portrait préflop</h3>
      <p>Tu as joué <strong>{played} mains sur {dec.length}</strong>, dont <strong>{limps} en limpant</strong>. La charte en joue {chartPlays} sur {dec.length}, et toujours en relançant. Tu étais d’accord avec elle {good} fois sur {dec.length}.</p>
      <table className="tbl">
        <thead><tr><th>Main</th><th>Ton choix</th><th>Charte</th></tr></thead>
        <tbody>
          {DEFI_HANDS.map(([p, h], i) => {
            const r = dec[i];
            const d = openDecision(SEAT_GROUP[p], h);
            return <tr key={i}><td>{p} · {codeLabel(h)}</td><td>{r ? `${r.correct ? '✓' : '✗'} ${r.answer.toLowerCase()}` : '–'}</td><td>{DEC_LABEL[d]}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

const L12: Lesson = {
  id: 12, module: 4,
  title: 'Ouvrir, suivre ou se coucher',
  objective: 'Appliquer une charte préflop simple et solide.',
  defi: {
    intro: <p>Dix situations préflop. Fais confiance à ton instinct : la correction ne viendra qu’au bilan, avec ton portrait de joueur.</p>,
    items: () => [
      ...DEFI_HANDS.map(([p, h], i) => openItem(`l12-h${i}`, p, h, true)),
      { kind: 'custom', id: 'l12-demo', prompt: 'Démonstration : pourquoi relancer plutôt que suivre ?', render: done => <Demo done={done} /> },
      {
        kind: 'choice', id: 'l12-why',
        prompt: 'En relançant, combien de façons as-tu de remporter le pot ?',
        options: ['Une seule : avoir la meilleure main', 'Deux : ils se couchent tout de suite, ou j’ai la meilleure main'], answer: 1,
        insight: 'Relancer donne deux façons de gagner (comme en leçon 1) ; suivre la grosse blinde n’en donne qu’une.',
        feedback: 'Comme en leçon 1 : en relançant, tu peux gagner tout de suite si tout le monde se couche. En suivant, tu laisses entrer tout le monde à bas prix.',
      },
    ],
  },
  bilan: {
    recap: recap12,
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Une stratégie simple et solide</h3>
          <ul>
            <li>Si personne n’est entré avant toi : <T k="ouvrir">ouvre</T> en relançant à environ <strong>2,5 BB</strong>, ou couche-toi. <strong>Ne <T k="limp">limpe</T> pas.</strong></li>
            <li>Couche-toi <strong>avec la majorité de tes mains</strong> : de 7 % des mains en UTG à environ un tiers au bouton.</li>
            <li>Face à une relance : <T k="3bet">3-bet</T> avec QQ+ et AK, suis avec les paires de 77 à JJ, AQs, AJs et KQs, jette le reste.</li>
            <li>En grosse blinde, tu as déjà payé 1 BB : défends un peu plus large en suivant.</li>
          </ul>
        </div>
        <h3>La <T k="charte">charte</T> du club (table à 8, tournoi, environ 40 BB)</h3>
        <ChartTabs />
        <p className="muted small">Repère simplifié pour débuter. Avec moins de 15 BB, on joue souvent « tapis ou couché » : c’est une autre stratégie, à voir plus tard.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      ...Array.from({ length: 9 }, () => randomOpenItem('')),
      ...Array.from({ length: 3 }, () => vsRaiseItem('')),
      ...Array.from({ length: 3 }, () => bbItem('')),
    ]), 'l12t'),
  },
  fiche: {
    essentiel: [
      'Personne n’est entré : relance à environ 2,5 BB ou couche-toi. Ne limpe pas.',
      'Couche-toi avec la majorité de tes mains, surtout en début de parole.',
      'Face à une relance : 3-bet avec QQ+ et AK, suis avec 77-JJ, AQs, AJs, KQs, jette le reste.',
      'En grosse blinde, défends plus large en suivant : tu as déjà payé 1 BB.',
    ],
    blocks: [{
      kind: 'table', title: 'Charte d’ouverture (personne n’est entré avant toi)', head: ['Position', 'Mains à relancer'], widths: [40, 140],
      rows: [
        ['UTG, UTG+1', OPEN_SPEC.precoce], ['MP, HJ', OPEN_SPEC.milieu], ['CO', OPEN_SPEC.tardive], ['BTN', OPEN_SPEC.bouton], ['SB', OPEN_SPEC.sb],
      ],
    }, {
      kind: 'table', title: 'Face à une relance', head: ['Situation', 'Relancer (3-bet)', 'Suivre'], widths: [40, 50, 90],
      rows: [['Un joueur a relancé avant toi', VS_RAISE_3BET_SPEC, VS_RAISE_CALL_SPEC.replace('77+', '77-JJ')], ['Tu es grosse blinde', VS_RAISE_3BET_SPEC, BB_CALL_SPEC.replace('22+', '22-JJ')]],
    }],
    pieges: ['Limper (suivre la grosse blinde) au lieu de relancer ou de se coucher.', 'Jouer trop de mains en début de parole.', 'Suivre une relance avec une main dominée (AJo, KQo face à UTG).'],
  },
};

export const LESSONS_M4 = [L10, L11, L12];
