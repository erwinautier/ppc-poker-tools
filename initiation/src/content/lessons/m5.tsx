/** Module 5 · Le postflop : leçons 13 à 17. */
import { useState } from 'react';
import type { ChoiceItem, Item, Lesson, NumberItem, PickItem } from '../types';
import { CardRow, Inline } from '../../components/Cards';
import { T } from '../../components/Term';
import { Narr, Scene, sample, withIds } from '../helpers';
import { type Card, CAT_NAMES, cardLabel, cards, catOf, deckWithout, describe, draw, evalCards, pick, rankOf, shuffle, suitOf } from '../../lib/cards';
import { hitProbability, nutsOf, outsFor, sameStrength } from '../../lib/sims';

const pctS = (x: number) => `${Math.round(x * 100)} %`;

// ════════════════════════════════════════════════════════════════════════════
// Leçon 13 · Lire le board
// ════════════════════════════════════════════════════════════════════════════

function nutsPickItem(id: string, boardS: string, insight: string): PickItem {
  const board = cards(boardS);
  const nuts = nutsOf(board);
  return {
    kind: 'pick', id,
    prompt: 'Choisis les 2 cartes privées qui donneraient la meilleure main possible sur ce board.',
    fixed: [{ label: 'Board', cards: board }],
    pool: deckWithout(board), layout: 'deck', count: 2,
    check: p => sameStrength(evalCards([...board, ...p]), nuts.value),
    solution: nuts.combos[0],
    describe: p => (p.length === 2 ? describe(evalCards([...board, ...p])).toLowerCase() : ''),
    insight,
    feedback: <>La meilleure main possible : <strong>{describe(nuts.value).toLowerCase()}</strong>, par exemple avec <Inline cs={nuts.combos[0].join(' ')} />.</>,
  };
}

function straightPossible(board: Card[]): boolean {
  const rs = new Set(board.map(rankOf));
  if (rs.has(12)) rs.add(-1);
  const arr = [...rs];
  for (let lo = -1; lo <= 8; lo++) if (arr.filter(r => r >= lo && r <= lo + 4).length >= 3) return true;
  return false;
}
function texture(board: Card[]): 'sec' | 'coordonne' | null {
  const suits = new Set(board.map(suitOf));
  const ranks = board.map(rankOf);
  const paired = new Set(ranks).size < 3;
  const sp = straightPossible(board);
  const span = Math.max(...ranks) - Math.min(...ranks);
  if (suits.size === 1) return 'coordonne';
  if (!paired && sp && (suits.size === 2 || span <= 3)) return 'coordonne';
  if (suits.size === 3 && !sp) return 'sec';
  return null;
}

function textureItem(id: string): ChoiceItem {
  for (;;) {
    const b = draw(3);
    const t = texture(b);
    if (!t) continue;
    const suits = new Set(b.map(suitOf)).size;
    return {
      kind: 'choice', id, prompt: 'Ce flop est-il sec ou coordonné ?', scene: <CardRow cs={b} size="lg" />,
      options: ['Sec', 'Coordonné'], columns: 2, answer: t === 'sec' ? 0 : 1,
      feedback: t === 'sec'
        ? 'Sec : trois enseignes différentes et des cartes trop éloignées pour une suite.'
        : suits === 1 ? 'Coordonné : trois cartes de la même enseigne, la couleur est déjà possible.'
          : suits === 2 ? 'Coordonné : deux cartes de la même enseigne (tirage couleur) et des cartes proches (tirages suite).'
            : 'Coordonné : des cartes très proches, beaucoup de suites et de tirages possibles.',
    };
  }
}

function nutsCatItem(id: string): ChoiceItem {
  const n = pick([3, 3, 4, 5]);
  const b = draw(n);
  const nuts = nutsOf(b);
  const cat = catOf(nuts.value);
  const pool = [3, 4, 5, 6, 7, 8].filter(c => c !== cat);
  const opts = shuffle([cat, ...sample(pool, 3)]).map(c => (c === 9 ? 'Quinte flush royale' : CAT_NAMES[c]));
  return {
    kind: 'choice', id, prompt: 'Sur ce board, quelle est la meilleure main possible ?', scene: <CardRow cs={b} size="lg" />,
    options: opts, columns: 2, answer: opts.indexOf(cat === 9 ? 'Quinte flush royale' : CAT_NAMES[cat]),
    feedback: <>Les nuts : <strong>{describe(nuts.value).toLowerCase()}</strong>, par exemple avec <Inline cs={nuts.combos[0].join(' ')} />.</>,
  };
}

const L13: Lesson = {
  id: 13, module: 5,
  title: 'Lire le board',
  objective: 'Trouver la meilleure main possible et juger la force de sa main.',
  defi: {
    intro: <p>Joue au détective : sur chaque board, quelles 2 cartes faudrait-il avoir pour être imbattable ? Touche-les dans le paquet.</p>,
    items: () => [
      nutsPickItem('l13-1', 'Ks 7d 2c', 'Sur un board sans couleur ni suite possible, la meilleure main est souvent un brelan.'),
      nutsPickItem('l13-2', '9c 8d 7s', 'Trois cartes proches : une suite devient possible.'),
      nutsPickItem('l13-3', 'Qh 9h 4h', 'Trois cartes de la même enseigne : la couleur devient possible.'),
      nutsPickItem('l13-4', '8s 8d 3c', 'Un board pairé rend le full et le carré possibles.'),
      nutsPickItem('l13-5', 'Kc Qd Js Th 2c', 'La meilleure main possible change à chaque nouvelle carte.'),
      {
        kind: 'choice', id: 'l13-6',
        prompt: <>Tu as <Inline cs="As Kd" /> Sur ce board, ta main est…</>,
        scene: <CardRow cs="Kc 7d 2s" size="lg" />,
        options: ['Très forte', 'Moyenne', 'Faible'], columns: 3, answer: 0,
        feedback: 'Top paire avec le meilleur kicker, sur un board sec : très peu de mains te battent.',
      },
      {
        kind: 'choice', id: 'l13-7',
        prompt: <>Même main <Inline cs="As Kd" />, mais sur ce board. Ta main est…</>,
        scene: <CardRow cs="Kh Jh Th" size="lg" />,
        options: ['Très forte', 'Moyenne', 'Faible'], columns: 3, answer: [1, 2],
        insight: 'La force d’une main est relative au board : la même top paire est très forte sur un board sec, beaucoup moins sur un board coordonné.',
        feedback: 'Toujours une paire de rois… mais toute main avec deux cœurs a déjà une couleur, et Q9 a déjà une suite. Ta main a beaucoup perdu de sa valeur.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Lire un board en trois questions</h3>
          <ol className="steps mt">
            <li><strong>Le board est-il pairé ?</strong> Full et carré deviennent possibles.</li>
            <li><strong>Trois cartes (ou plus) de la même enseigne ?</strong> La couleur est possible. Deux seulement : tirage couleur.</li>
            <li><strong>Trois cartes proches ?</strong> Une suite est possible.</li>
          </ol>
        </div>
        <div className="prose">
          <ul>
            <li>Les <T k="nuts">nuts</T> : la meilleure main possible sur le board. Elles changent à chaque nouvelle carte.</li>
            <li>Un <T k="sec">board sec</T> (K-7-2 de trois enseignes) offre peu de tirages. Un <T k="coordonne">board coordonné</T> (9♥-8♥-7♣) en offre beaucoup.</li>
            <li>La force d’une main est <strong>relative</strong> au board : une <T k="toppair">top paire</T> est très forte sur un board sec, moyenne sur un board coordonné.</li>
            <li>Vocabulaire : <T k="overpair">surpaire</T> (paire servie plus haute que le board), <T k="set">set</T> (brelan avec une paire servie).</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([textureItem(''), textureItem(''), textureItem(''), textureItem(''), nutsCatItem(''), nutsCatItem(''), nutsCatItem(''), nutsCatItem('')]), 'l13t'),
  },
  fiche: {
    essentiel: [
      'Les nuts : la meilleure main possible sur un board donné. Elles changent à chaque carte.',
      'Board sec : enseignes différentes, cartes éloignées, peu de tirages.',
      'Board coordonné : cartes proches et/ou de même enseigne, beaucoup de tirages.',
      'La force d’une main est relative au board.',
    ],
    blocks: [
      { kind: 'steps', title: 'Lire un board en trois questions', steps: ['Le board est-il pairé ? Full et carré possibles.', 'Trois cartes de la même enseigne ? Couleur possible.', 'Trois cartes proches ? Suite possible.'] },
      { kind: 'cards', title: 'Exemples', rows: [
        { label: 'Sec', cards: 'Ks 7d 2c', note: 'nuts : brelan de rois' },
        { label: 'Coordonné', cards: '9h 8h 7c', note: 'nuts : suite (JT)' },
        { label: 'Monocolore', cards: 'Qh 9h 4h', note: 'nuts : couleur à l’as' },
        { label: 'Pairé', cards: '8s 8d 3c', note: 'nuts : carré de 8' },
      ] },
    ],
    pieges: ['Juger sa main sans regarder le board.', 'Oublier que la couleur ou la suite sont possibles pour l’adversaire.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 14 · Tirages et outs
// ════════════════════════════════════════════════════════════════════════════

function outsPickItem(id: string, holeS: string, boardS: string, minCat: number, goal: string, insight: string): PickItem {
  const hole = cards(holeS), board = cards(boardS);
  const sol = outsFor(hole, board, minCat);
  return {
    kind: 'pick', id,
    prompt: `Touche toutes les cartes qui, à la turn, te donneraient ${goal}.`,
    fixed: [{ label: 'Tes cartes', cards: hole }, { label: 'Flop', cards: board }],
    pool: deckWithout([...hole, ...board]), layout: 'deck', count: 'any',
    check: p => p.length === sol.length && p.every(c => sol.includes(c)),
    solution: sol,
    insight,
    feedback: <>Il y en a <strong>{sol.length}</strong>. Ce sont tes <T k="out">outs</T>.</>,
  };
}

const DRAWS: { hole: string; board: string; minCat: number; goal: string; name: string }[] = [
  { hole: 'Ah 7h', board: 'Kh 9h 2c', minCat: 5, goal: 'une couleur', name: 'tirage couleur' },
  { hole: 'Js Ts', board: '9h 8c 2d', minCat: 4, goal: 'une suite', name: 'suite ouverte' },
  { hole: 'Qd Jc', board: 'Th 9s 3c', minCat: 4, goal: 'une suite', name: 'suite ouverte' },
  { hole: '6c 5c', board: '8d 7h Ks', minCat: 4, goal: 'une suite', name: 'suite ouverte' },
  { hole: 'Ac Qd', board: 'Kh Jd 4s', minCat: 4, goal: 'une suite', name: 'suite ventrale' },
  { hole: '9d 7d', board: 'Jc 8s 2h', minCat: 4, goal: 'une suite', name: 'suite ventrale' },
  { hole: 'Kd Qd', board: 'Ad 8d 3s', minCat: 5, goal: 'une couleur', name: 'tirage couleur' },
  { hole: 'Jh Th', board: '9h 8s 2h', minCat: 4, goal: 'une suite ou une couleur', name: 'couleur + suite ouverte' },
  { hole: '5s 5d', board: 'Kh 9c 2s', minCat: 3, goal: 'un brelan (ou mieux)', name: 'paire servie' },
  { hole: '8h 8c', board: 'Ad 7s 3h', minCat: 3, goal: 'un brelan (ou mieux)', name: 'paire servie' },
];

function outsCountItem(id: string): NumberItem {
  const d = pick(DRAWS);
  const n = outsFor(cards(d.hole), cards(d.board), d.minCat).length;
  return {
    kind: 'number', id,
    prompt: <>Tu as <Inline cs={d.hole} /> sur le flop <Inline cs={d.board} /> Combien d’outs pour {d.goal} ?</>,
    answer: n, unit: 'outs', feedback: `${d.name[0].toUpperCase() + d.name.slice(1)} : ${n} outs.`,
  };
}
function percentItem(id: string): NumberItem {
  const outs = pick([4, 8, 9, 2, 6]);
  const two = Math.random() < 0.5;
  const exact = hitProbability(outs, two ? 47 : 46, two ? 2 : 1);
  return {
    kind: 'number', id,
    prompt: two
      ? `Tu as ${outs} outs au flop et tu verras la turn ET la river. Environ quel pourcentage de chances de toucher ?`
      : `Tu as ${outs} outs à la turn, une seule carte à venir. Environ quel pourcentage de chances de toucher ?`,
    answer: Math.round(exact * 100), tolerance: 3, unit: '%',
    feedback: `Règle du 2 et du 4 : ${outs} × ${two ? 4 : 2} = ${outs * (two ? 4 : 2)} %. Valeur exacte : ${pctS(exact)}.`,
  };
}

const L14: Lesson = {
  id: 14, module: 5,
  title: 'Tirages et outs',
  objective: 'Compter ses outs et estimer ses chances de toucher.',
  defi: {
    intro: <p>Ta main n’est pas encore faite, mais elle peut le devenir. Quelles cartes du paquet te sauveraient ? Touche-les toutes, puis valide.</p>,
    items: () => [
      outsPickItem('l14-1', 'Ah 7h', 'Kh 9h 2c', 5, 'une couleur', 'Tirage couleur : il reste 9 cartes de ton enseigne, soit 9 outs.'),
      outsPickItem('l14-2', '9s 8d', '7c 6h 2s', 4, 'une suite', 'Suite ouverte (quatre cartes qui se suivent) : 8 outs, deux valeurs de 4 cartes.'),
      outsPickItem('l14-3', '9s 8d', 'Jc 7h 2s', 4, 'une suite', 'Suite ventrale (il manque une carte au milieu) : 4 outs seulement.'),
      {
        kind: 'estimate', id: 'l14-4',
        prompt: 'Tu as 9 outs au flop. Selon toi, quelle est ta probabilité de toucher ta couleur à la turn OU à la river ?',
        min: 0, max: 100, step: 1, answer: 35, tolerance: 7, unit: '%',
        simulate: () => { let k = 0; for (let i = 0; i < 2000; i++) { const a = Math.random() * 47 | 0; let b = Math.random() * 46 | 0; if (b >= a) b++; if (a < 9 || b < 9) k++; } return k / 2000; },
        simLabel: 'Simulation de 20 000 turns et rivers',
        feedback: 'Environ 35 % : un peu plus d’une fois sur trois.',
      },
      {
        kind: 'estimate', id: 'l14-5',
        prompt: 'Et si tu ne vois qu’une seule carte (la turn) ?',
        min: 0, max: 100, step: 1, answer: 19, tolerance: 6, unit: '%',
        simulate: () => { let k = 0; for (let i = 0; i < 2000; i++) if ((Math.random() * 47 | 0) < 9) k++; return k / 2000; },
        simLabel: 'Simulation de 20 000 turns',
        feedback: 'Environ 19 % : moins d’une fois sur cinq.',
      },
      {
        kind: 'choice', id: 'l14-6',
        prompt: '9 outs : environ 19 % en une carte, 35 % en deux cartes. Quelle règle simple retrouve ces chiffres ?',
        options: ['Outs × 2 pour une carte, outs × 4 pour deux cartes', 'Outs + 10', 'Outs × 10'], answer: 0,
        insight: 'Règle du 2 et du 4 : outs × 2 ≈ % sur une carte, outs × 4 ≈ % sur deux cartes.',
        feedback: '9 × 2 = 18 % et 9 × 4 = 36 % : très proche des vrais chiffres.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Tirage</th><th className="r">Outs</th><th className="r">1 carte</th><th className="r">2 cartes</th></tr></thead>
          <tbody>
            {[['Couleur', 9], ['Suite ouverte', 8], ['Deux cartes plus hautes que le board', 6], ['Suite ventrale', 4], ['Paire servie → brelan', 2], ['Couleur + suite ouverte', 15]].map(([n, o]) => (
              <tr key={n as string}><td>{n}</td><td className="r">{o}</td><td className="r">{pctS(hitProbability(o as number, 46, 1))}</td><td className="r">{pctS(hitProbability(o as number, 47, 2))}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Un <T k="out">out</T> est une carte qui transforme ton <T k="tirage">tirage</T> en main probablement gagnante.</li>
            <li><T k="regle24">Règle du 2 et du 4</T> : outs × 2 ≈ % de toucher à la carte suivante ; outs × 4 ≈ % sur deux cartes.</li>
            <li>Le × 4 ne vaut que si tu es sûr de voir la turn ET la river (par exemple si tu es à tapis).</li>
            <li>Attention aux outs « sales » : une carte qui t’améliore peut aussi améliorer l’adversaire (le 4e cœur qui te donne une suite donne une couleur à un autre).</li>
          </ul>
        </div>
        <p className="muted small">Vocabulaire : <T k="ouverte">suite ouverte</T> (8 outs), <T k="ventrale">suite ventrale</T> (4 outs).</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([...Array.from({ length: 5 }, () => outsCountItem('')), ...Array.from({ length: 3 }, () => percentItem(''))]), 'l14t'),
  },
  fiche: {
    essentiel: [
      'Out : carte qui transforme un tirage en main probablement gagnante.',
      'Règle du 2 et du 4 : outs × 2 ≈ % sur une carte, outs × 4 ≈ % sur deux cartes.',
      'Le × 4 ne vaut que si l’on voit la turn ET la river.',
      'Attention aux outs qui améliorent aussi l’adversaire.',
    ],
    blocks: [{
      kind: 'table', title: 'Les tirages courants', head: ['Tirage', 'Outs', '1 carte', '2 cartes'],
      rows: [['Couleur', '9', '20 %', '35 %'], ['Suite ouverte', '8', '17 %', '31 %'], ['Deux surcartes', '6', '13 %', '24 %'], ['Suite ventrale', '4', '9 %', '16 %'], ['Paire servie → brelan', '2', '4 %', '8 %'], ['Couleur + suite ouverte', '15', '33 %', '54 %']],
    }],
    pieges: ['Utiliser le × 4 alors qu’on ne verra qu’une carte.', 'Compter un out qui donne une meilleure main à l’adversaire.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 15 · La cote du pot
// ════════════════════════════════════════════════════════════════════════════

function Sparkline({ series }: { series: number[] }) {
  const w = 300, h = 70;
  const min = Math.min(0, ...series), max = Math.max(0, ...series);
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${y(v)}`).join(' ');
  const end = series[series.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Évolution des jetons : ${end >= 0 ? '+' : ''}${end}`}>
      <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeDasharray="4 4" />
      <polyline points={pts} fill="none" stroke={end >= 0 ? 'var(--success)' : 'var(--danger)'} strokeWidth="2" />
    </svg>
  );
}

function BetGame({ pay, win, oneIn, done }: { pay: number; win: number; oneIn: number; done: (a: { correct: boolean; answer: string; expected: string }) => void }) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [series, setSeries] = useState<number[] | null>(null);
  const ev = win / oneIn - pay * (1 - 1 / oneIn);
  const go = (accept: boolean) => {
    setChoice(accept);
    const s = [0];
    for (let i = 0; i < 200; i++) s.push(s[s.length - 1] + (Math.random() < 1 / oneIn ? win : -pay));
    setSeries(s);
    done({ correct: accept === ev > 0, answer: accept ? 'accepter' : 'refuser', expected: ev > 0 ? 'accepter' : 'refuser' });
  };
  return (
    <div className="stack">
      <div className="narr center" style={{ fontSize: '1rem' }}>
        Tu paies <strong>{pay}</strong>. Une fois sur <strong>{oneIn}</strong>, tu gagnes <strong>{win}</strong> (et tu récupères ta mise). Sinon, tu perds ta mise.
      </div>
      {choice === null ? (
        <div className="options c2">
          <button className="opt" onClick={() => go(true)}>J’accepte ce pari</button>
          <button className="opt" onClick={() => go(false)}>Je refuse</button>
        </div>
      ) : series && (
        <div className="scene stack" style={{ gap: 4 }}>
          <span className="small muted">Si tu acceptais ce pari 200 fois de suite :</span>
          <Sparkline series={series} />
          <span className="small">Résultat : <strong>{series[series.length - 1] >= 0 ? '+' : ''}{series[series.length - 1]}</strong> jetons. En moyenne : <strong>{ev >= 0 ? '+' : ''}{ev.toFixed(1).replace('.', ',')}</strong> par pari.</span>
        </div>
      )}
    </div>
  );
}

function betItem(id: string, pay: number, win: number, oneIn: number, insight: string): Item {
  return { kind: 'custom', id, prompt: 'On te propose un pari. Tu acceptes ?', render: done => <BetGame pay={pay} win={win} oneIn={oneIn} done={done} />, insight };
}

const FRACTIONS: [number, string][] = [[1 / 3, 'un tiers du pot'], [1 / 2, 'la moitié du pot'], [2 / 3, 'les deux tiers du pot'], [1, 'le pot']];

function potOddsDecision(id: string): ChoiceItem {
  for (;;) {
    const P = pick([60, 80, 100, 120, 150, 200]);
    const [f, fl] = pick(FRACTIONS);
    const B = Math.round(P * f);
    const d = pick(DRAWS.filter(x => x.minCat >= 4));
    const outs = outsFor(cards(d.hole), cards(d.board), d.minCat).length;
    const allIn = Math.random() < 0.4;
    const eq = hitProbability(outs, allIn ? 47 : 46, allIn ? 2 : 1);
    const req = B / (P + 2 * B);
    if (Math.abs(eq - req) < 0.035) continue;
    const call = eq > req;
    return {
      kind: 'choice', id,
      prompt: allIn
        ? <>Au flop, ton tirage : {d.name} ({outs} outs). Le pot fait {P}. Ton adversaire fait tapis pour {B} ({fl}) : tu verras la turn et la river. Tu suis ?</>
        : <>À la turn, ton tirage : {d.name} ({outs} outs). Le pot fait {P}. Ton adversaire mise {B} ({fl}). Tu suis ?</>,
      options: ['Suivre', 'Se coucher'], columns: 2, answer: call ? 0 : 1,
      feedback: `Il faut ${B} ÷ ${P + 2 * B} = ${pctS(req)} de chances. Tu en as environ ${pctS(eq)} (${outs} × ${allIn ? 4 : 2}). ${call ? 'Suivre est rentable.' : 'Pas assez : on se couche.'}`,
    };
  }
}
function requiredItem(id: string): NumberItem {
  const P = pick([60, 90, 100, 120, 150]);
  const [f, fl] = pick(FRACTIONS);
  const B = Math.round(P * f);
  const req = B / (P + 2 * B);
  return {
    kind: 'number', id, prompt: `Le pot fait ${P}. Ton adversaire mise ${B} (${fl}). Quelle équité minimum te faut-il pour suivre ?`,
    answer: Math.round(req * 100), tolerance: 2, unit: '%',
    feedback: `Tu paies ${B} pour un pot final de ${P} + ${B} + ${B} = ${P + 2 * B}. ${B} ÷ ${P + 2 * B} = ${pctS(req)}.`,
  };
}

const L15: Lesson = {
  id: 15, module: 5,
  title: 'La cote du pot',
  objective: 'Décider de suivre en comparant le prix à payer et ses chances.',
  defi: {
    intro: <p>Oublions un instant le poker. On te propose des paris : accepte ceux qui te semblent bons. Ensuite, on regarde ce qu’ils rapportent quand on les répète.</p>,
    items: () => [
      betItem('l15-1', 10, 30, 3, 'Gagner une fois sur trois peut être très rentable si le gain est assez gros.'),
      betItem('l15-2', 10, 30, 5, 'Avec le même gain, gagner une fois sur cinq ne suffit plus.'),
      betItem('l15-3', 50, 40, 2, 'Gagner souvent ne suffit pas : il faut que le gain compense ce qu’on risque.'),
      betItem('l15-4', 5, 100, 10, 'On peut perdre 9 fois sur 10 et gagner de l’argent, si le prix est bas.'),
      {
        kind: 'number', id: 'l15-5',
        prompt: 'Tu paies 10 pour gagner 30. Combien de fois sur 100, au minimum, dois-tu gagner pour ne pas perdre d’argent ?',
        answer: 25, tolerance: 2, unit: 'fois sur 100',
        insight: 'Le pourcentage minimum de réussite = ce que je paie ÷ (ce que je paie + ce que je gagne).',
        feedback: '10 ÷ (10 + 30) = 25 %. Gagner 25 fois 30 = 750, perdre 75 fois 10 = 750 : à l’équilibre.',
      },
      {
        kind: 'choice', id: 'l15-6',
        prompt: 'Retour au poker. À la turn, le pot fait 100 et ton adversaire mise 50. Tu as un tirage couleur : 9 outs, une seule carte à venir. Tu dois payer 50 pour un pot final de 200. Tu suis ?',
        scene: <CardRow cs="Ah 7h Kh 9h 2c 4s" size="sm" />,
        options: ['Suivre', 'Se coucher'], columns: 2, answer: 1,
        insight: 'On ne suit que si ses chances de gagner dépassent la part du pot que l’on paie.',
        feedback: 'Il faudrait 50 ÷ 200 = 25 % de chances. Avec 9 outs et une carte : 9 × 2 ≈ 19 %. Pas assez : on se couche.',
      },
      {
        kind: 'choice', id: 'l15-7',
        prompt: 'Même tirage, mais au flop. Ton adversaire fait tapis : 50 dans un pot de 100. Cette fois, tu verras la turn ET la river. Tu suis ?',
        options: ['Suivre', 'Se coucher'], columns: 2, answer: 0,
        feedback: 'Toujours 25 % nécessaires, mais avec deux cartes à venir : 9 × 4 ≈ 35 %. On suit.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>La règle</h3>
          <p>Équité nécessaire = <strong>montant à payer ÷ pot final</strong> (pot + mise adverse + ta mise).</p>
          <p>Si ton <T k="equite">équité</T> (tes chances de gagner) dépasse ce chiffre, suivre est rentable sur le long terme.</p>
        </div>
        <table className="tbl">
          <thead><tr><th>Mise adverse</th><th className="r">Équité nécessaire</th></tr></thead>
          <tbody>
            {FRACTIONS.map(([f, l]) => <tr key={l}><td>{l[0].toUpperCase() + l.slice(1)}</td><td className="r">{pctS(f / (1 + 2 * f))}</td></tr>)}
          </tbody>
        </table>
        <div className="prose">
          <ul>
            <li>Méthode : 1) compte tes outs ; 2) estime tes chances (× 2 ou × 4) ; 3) compare à la <T k="cote">cote du pot</T>.</li>
            <li>Raisonne sur le long terme : une bonne décision peut perdre une fois, elle rapporte sur la durée. C’est la <T k="variance">variance</T>.</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([...Array.from({ length: 6 }, () => potOddsDecision('')), requiredItem(''), requiredItem('')]), 'l15t'),
  },
  fiche: {
    essentiel: [
      'Équité nécessaire = montant à payer ÷ pot final (pot + mise adverse + ta mise).',
      'On suit si ses chances de gagner dépassent ce chiffre.',
      'Méthode : compter ses outs, estimer ses chances (× 2 ou × 4), comparer.',
      'Une bonne décision se juge sur le long terme, pas sur un coup.',
    ],
    blocks: [{ kind: 'table', title: 'Équité nécessaire selon la mise', head: ['Mise adverse', 'Équité nécessaire'], rows: [['1/3 du pot', '20 %'], ['1/2 pot', '25 %'], ['2/3 du pot', '29 %'], ['Le pot', '33 %']] }],
    pieges: ['Suivre « pour voir » sans regarder le prix.', 'Juger une décision sur un seul résultat.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 16 · Pourquoi miser ? Valeur et bluff
// ════════════════════════════════════════════════════════════════════════════

const RIVER = 'Ks 8d 4c 2h 9s';
const VILLAIN = ['Kc Qc', 'Kh 9d', '8h 8c', 'Qh Qd', 'Ah 8s', '7h 6h'];
function villainLabel(cs: string) {
  const v = evalCards([...cards(cs), ...cards(RIVER)]);
  return `${cards(cs).map(cardLabel).join(' ')} : ${describe(v).toLowerCase()}`;
}

const VALUE_OPTS = ['Miser pour la valeur', 'Checker', 'Bluffer'];
const VALUE_BANK: { s: string; hole: string; board: string; a: number; f: string }[] = [
  { s: 'River. Ton adversaire a payé tes mises au flop et à la turn, puis checke.', hole: 'Ah Kc', board: 'Ac 9d 6s 4h 2c', a: 0, f: 'Top paire, meilleur kicker : beaucoup de mains moins bonnes (un as plus faible, un 9) peuvent encore payer.' },
  { s: 'River. Ton adversaire checke.', hole: '7d 7c', board: 'Qs Jh 5d 8s 2c', a: 1, f: 'Petite paire : si tu mises, les mains moins bonnes se couchent et les meilleures paient. Checke et vois l’abattage.' },
  { s: 'River. Ton tirage a raté. Ton adversaire, un joueur prudent qui se couche souvent, checke.', hole: '9d 7d', board: 'Kd 8d 3c 2s Jc', a: 2, f: 'Tu as hauteur 9 : tu ne gagnes qu’en le faisant coucher. Face à un joueur prudent, un bluff a de bonnes chances de marcher.' },
  { s: 'River. Ton tirage a raté. Ton adversaire, qui paie presque tout, checke.', hole: '9d 7d', board: 'Kd 8d 3c 2s Jc', a: 1, f: 'Face à un joueur qui paie tout (une « calling station »), on ne bluffe pas : il paiera avec n’importe quelle paire.' },
  { s: 'Flop. Tu as relancé préflop, seule la grosse blinde a suivi. Elle checke sur ce board sec.', hole: 'Ks Qs', board: 'Ad 8c 3h', a: 2, f: 'Mise de continuation (c-bet) : tu n’as rien, mais l’as fait peur et ton adversaire a souvent raté. Une petite mise (1/3 du pot) suffit souvent.' },
  { s: 'Flop. La grosse blinde checke sur ce board très coordonné.', hole: '9h 9c', board: '9s 7h 6h', a: 0, f: 'Brelan (set) sur un board plein de tirages : mise pour la valeur, et pour ne pas laisser l’adversaire tirer gratuitement.' },
  { s: 'River. Ton adversaire checke.', hole: 'Qc Qd', board: 'Qs 7d 7c 2h Ks', a: 0, f: 'Full aux dames : mise pour la valeur, les 7, les rois et les dames moins bonnes peuvent payer.' },
  { s: 'River. Ton adversaire checke.', hole: 'As 2s', board: 'Th 9c 6d 5s Kc', a: 1, f: 'Hauteur as : tu peux gagner contre des tirages ratés, mais une mise ne ferait payer que des paires. Checke.' },
  { s: 'Turn. Ton adversaire checke.', hole: 'Kh Kd', board: 'Kc 7s 2d 4h', a: 0, f: 'Brelan de rois sur un board sec : mise pour la valeur.' },
  { s: 'River. Ton adversaire checke.', hole: 'Jh Th', board: '9s 8c 7d 2h 3c', a: 0, f: 'Tu as la meilleure suite possible : mise pour la valeur.' },
  { s: 'Flop. Trois adversaires sont dans le coup et checkent devant toi.', hole: '2c 2d', board: 'Ah Kh Qh', a: 1, f: 'Petite paire sur un board très fort, contre trois adversaires : n’importe qui peut avoir mieux. Checke.' },
];

function valueItem(id: string, x: typeof VALUE_BANK[number]): ChoiceItem {
  return {
    kind: 'choice', id, prompt: x.s,
    scene: <Scene><div className="row" style={{ justifyContent: 'space-around' }}><div className="stack center" style={{ gap: 4 }}><span className="muted small">Tes cartes</span><CardRow cs={x.hole} size="sm" /></div><div className="stack center" style={{ gap: 4 }}><span className="muted small">Board</span><CardRow cs={x.board} size="sm" /></div></div></Scene>,
    options: VALUE_OPTS, answer: x.a, feedback: x.f,
  };
}

const L16: Lesson = {
  id: 16, module: 5,
  title: 'Pourquoi miser ? Valeur et bluff',
  objective: 'Savoir pourquoi on mise : pour être payé ou pour faire coucher.',
  defi: {
    intro: <p>Tu es à la river. Ton adversaire peut avoir une de ces six mains. Qui paierait ta mise ? Qui se coucherait ? On part du principe qu’il paie avec une paire ou mieux, et qu’il se couche sinon.</p>,
    items: () => [
      {
        kind: 'multi', id: 'l16-1',
        prompt: <>Tu as <Inline cs="As Kd" /> (paire de rois, kicker as). Lesquelles de ces mains sont <strong>moins bonnes</strong> que la tienne <strong>et</strong> paieraient ta mise ?</>,
        scene: <CardRow cs={RIVER} />,
        options: VILLAIN.map(villainLabel), answers: [0, 3, 4],
        insight: 'Avec une main forte, des mains moins bonnes paient ta mise : tu mises pour la valeur.',
        feedback: 'KQ, QQ et A8 sont moins bonnes et paieront avec leur paire. K9 et 88 te battent. 76 n’a rien et se couche.',
      },
      {
        kind: 'multi', id: 'l16-2',
        prompt: <>Cette fois, tu as <Inline cs="7d 6c" /> : ton tirage a raté, tu n’as rien. Si tu mises, lesquelles de ces mains paient ?</>,
        scene: <CardRow cs={RIVER} />,
        options: VILLAIN.slice(0, 5).map(villainLabel), answers: [0, 1, 2, 3, 4],
        feedback: 'Toutes ont une paire ou mieux : elles paient toutes… et elles te battent toutes.',
      },
      {
        kind: 'choice', id: 'l16-3',
        prompt: 'Avec ta main ratée, une mise ne peut être rentable que si…',
        options: ['des mains meilleures que la tienne se couchent', 'des mains moins bonnes paient', 'tu parles en dernier'], answer: 0,
        insight: 'Avec une main faible, une mise n’a d’intérêt que si elle fait coucher de meilleures mains : c’est le bluff.',
        feedback: 'Personne de moins bon ne paiera. Le seul espoir : faire coucher une main meilleure. C’est un bluff.',
      },
      {
        kind: 'choice', id: 'l16-4',
        prompt: 'Tu as la meilleure main possible, le pot fait 100. Selon ta mise, voici combien de fois sur 10 ton adversaire paie. Quelle mise rapporte le plus en moyenne ?',
        scene: (
          <table className="tbl"><thead><tr><th>Ta mise</th><th className="r">Il paie</th></tr></thead>
            <tbody><tr><td>33</td><td className="r">6 fois sur 10</td></tr><tr><td>66</td><td className="r">4 fois sur 10</td></tr><tr><td>100</td><td className="r">2 fois sur 10</td></tr><tr><td>200 (tapis)</td><td className="r">1 fois sur 10</td></tr></tbody></table>
        ),
        options: ['33', '66', '100', '200'], columns: 2, answer: 1,
        insight: 'Une grosse mise rapporte plus quand elle est payée, mais elle est payée moins souvent : il faut trouver l’équilibre.',
        feedback: '33 × 0,6 = 20 ; 66 × 0,4 = 26 ; 100 × 0,2 = 20 ; 200 × 0,1 = 20. La mise des deux tiers du pot rapporte le plus.',
      },
      {
        kind: 'choice', id: 'l16-5',
        prompt: <>Tu as <Inline cs="8c 8h" /> sur ce board, ton adversaire checke. Que fais-tu ?</>,
        scene: <CardRow cs="Ks Td 4c 2h 9s" />,
        options: ['Miser', 'Checker'], columns: 2, answer: 1,
        insight: 'Avec une main moyenne, on checke souvent : une mise ferait coucher les mains moins bonnes et payer les meilleures.',
        feedback: 'Ta paire de 8 bat les tirages ratés, mais ceux-ci se coucheraient. Seuls les rois, les 10 et les 9 paieraient… et ils te battent.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Ta main</th><th>Ce que tu fais</th><th>Pourquoi</th></tr></thead>
          <tbody>
            <tr><td>Forte</td><td><T k="valeur">Mise pour la valeur</T></td><td>Des mains moins bonnes paient.</td></tr>
            <tr><td>Moyenne</td><td>Check</td><td>Une mise ne fait payer que mieux.</td></tr>
            <tr><td>Faible</td><td><T k="bluff">Bluff</T> ou abandon</td><td>Seul espoir : faire coucher mieux.</td></tr>
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>On mise pour deux raisons seulement : être payé par moins bon (valeur), ou faire coucher meilleur (bluff).</li>
            <li>Le <T k="sizing">sizing</T> se compte en fraction du pot : 1/3, 1/2, 2/3, pot. Plus gros, on est payé moins souvent.</li>
            <li>La <T k="cbet">mise de continuation</T> : celui qui a relancé préflop mise souvent au flop, qu’il ait touché ou non.</li>
            <li>Face à une <T k="station">calling station</T> (qui paie tout) : beaucoup de valeur, très peu de bluffs. C’est fréquent en partie amicale.</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: { items: () => withIds(sample(VALUE_BANK, 8).map(x => valueItem('', x)), 'l16t') },
  fiche: {
    essentiel: [
      'On mise pour être payé par moins bon (valeur) ou pour faire coucher meilleur (bluff).',
      'Main forte : mise de valeur. Main moyenne : check. Main faible : bluff ou abandon.',
      'Taille de mise en fraction du pot : plus gros, on est payé moins souvent.',
      'C-bet : le relanceur préflop mise souvent au flop.',
      'Face à un joueur qui paie tout : beaucoup de valeur, peu de bluffs.',
    ],
    blocks: [{ kind: 'table', title: 'Que faire selon ta main ?', head: ['Ta main', 'Action', 'Pourquoi'], rows: [['Forte', 'Mise de valeur', 'Des mains moins bonnes paient'], ['Moyenne', 'Check', 'Une mise ne fait payer que mieux'], ['Faible', 'Bluff ou abandon', 'Seul espoir : faire coucher mieux']] }],
    pieges: ['Miser une main moyenne « pour savoir où on en est ».', 'Bluffer un joueur qui paie tout.', 'Checker une très bonne main par peur de faire fuir l’adversaire.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 17 · Jouer une main complète
// ════════════════════════════════════════════════════════════════════════════

interface Step { pos: string; hole: string; board?: string; pot?: string; text: string; options: string[]; answer: number | number[]; expl: string; ref: number }
interface Hand { title: string; steps: Step[] }

const O3 = ['Se coucher', 'Suivre', 'Relancer'];
const O2 = ['Checker', 'Miser'];

const HANDS_DEFI: Hand[] = [
  { title: 'Main 1', steps: [
    { pos: 'BTN', hole: 'As Qd', text: 'Tout le monde se couche jusqu’à toi, au bouton.', options: O3, answer: 2, expl: 'AQo au bouton fait partie de la charte : on relance à 2,5 BB.', ref: 12 },
    { pos: 'BTN', hole: 'As Qd', board: 'Qc 8h 3d', pot: '5,5 BB', text: 'Seule la grosse blinde a suivi. Elle checke.', options: O2, answer: 1, expl: 'Top paire, très bon kicker, board sec : mise pour la valeur (environ la moitié du pot).', ref: 16 },
    { pos: 'BTN', hole: 'As Qd', board: 'Qc 8h 3d 2s', pot: '11,5 BB', text: 'Elle a suivi. Turn : 2♠. Elle checke encore.', options: O2, answer: 1, expl: 'Rien n’a changé, tu es très probablement devant : continue à miser pour la valeur.', ref: 16 },
    { pos: 'BTN', hole: 'As Qd', board: 'Qc 8h 3d 2s 7c', pot: '25 BB', text: 'Elle a suivi. River : 7♣. Elle checke.', options: O2, answer: 1, expl: 'Une dame moins bonne ou un 8 peuvent encore payer : dernière mise de valeur.', ref: 16 },
  ] },
  { title: 'Main 2', steps: [
    { pos: 'BB', hole: '9h 8h', text: 'Le CO relance à 2,5 BB, tout le monde se couche jusqu’à toi.', options: O3, answer: 1, expl: '98s fait partie de la défense de grosse blinde : tu as déjà payé 1 BB, on suit.', ref: 12 },
    { pos: 'BB', hole: '9h 8h', board: 'Th 7h 2c', pot: '5,5 BB', text: 'Tu checkes, le CO mise 3 BB.', options: O3, answer: [1, 2], expl: 'Tirage couleur + suite ouverte : 15 outs, environ 30 % dès la turn. Il faut 3 ÷ 11,5 = 26 % : suivre est rentable (relancer aussi).', ref: 15 },
    { pos: 'BB', hole: '9h 8h', board: 'Th 7h 2c Ac', pot: '11,5 BB', text: 'Turn : A♣. Tu checkes, le CO mise 6 BB.', options: O3, answer: 1, expl: 'Toujours 15 outs (environ 32 %) pour 6 ÷ 23,5 = 26 % nécessaires : on suit.', ref: 15 },
    { pos: 'BB', hole: '9h 8h', board: 'Th 7h 2c Ac 6d', pot: '23,5 BB', text: 'River : 6♦. Tu parles en premier.', options: O2, answer: 1, expl: 'Suite au 10 : la meilleure main possible sur ce board. Mise pour la valeur.', ref: 13 },
  ] },
  { title: 'Main 3', steps: [
    { pos: 'BTN', hole: 'Ad Jc', text: 'Le joueur UTG relance à 2,5 BB, tout le monde se couche jusqu’à toi.', options: O3, answer: 0, expl: 'Face à une relance d’UTG, AJo est souvent dominée (AQ, AK). Elle n’est pas dans la charte : on se couche.', ref: 12 },
    { pos: 'BB', hole: '5s 5h', text: 'Plus tard. Tu es grosse blinde, le bouton relance à 2,5 BB.', options: O3, answer: 1, expl: 'Toutes les paires se défendent en grosse blinde : on suit.', ref: 12 },
    { pos: 'BB', hole: '5s 5h', board: 'Ks Qd 8c', pot: '5,5 BB', text: 'Tu checkes, le bouton mise 3 BB.', options: O3, answer: 0, expl: 'Ta paire de 5 est sous trois cartes hautes. 2 outs seulement (environ 4 %) pour 26 % nécessaires : on se couche.', ref: 15 },
  ] },
];
const HANDS_TRAINING: Hand[] = [
  { title: 'KK au bouton', steps: [
    { pos: 'BTN', hole: 'Ks Kh', text: 'Tu as relancé au bouton. La petite blinde relance à 9 BB. Ton tapis : 40 BB.', options: ['Se coucher', 'Suivre', 'Faire tapis'], answer: 2, expl: 'KK est la deuxième meilleure main : à 40 BB, on met tapis.', ref: 12 },
  ] },
  { title: 'A5s au cutoff', steps: [
    { pos: 'CO', hole: 'Ac 5c', text: 'Tout le monde se couche jusqu’à toi.', options: O3, answer: 2, expl: 'A5s fait partie de la charte du CO : on relance.', ref: 12 },
    { pos: 'CO', hole: 'Ac 5c', board: '9d 6s 2h', pot: '5,5 BB', text: 'Seule la grosse blinde a suivi. Elle checke.', options: O2, answer: 1, expl: 'Mise de continuation sur un board sec : ton adversaire a souvent raté. Une petite mise suffit.', ref: 16 },
    { pos: 'CO', hole: 'Ac 5c', board: '9d 6s 2h', pot: '7,5 BB', text: 'Elle relance ta mise à 6 BB.', options: O3, answer: 0, expl: 'Tu n’as que hauteur as et ta mise n’a pas fonctionné : on abandonne.', ref: 16 },
  ] },
  { title: 'AKs en HJ', steps: [
    { pos: 'HJ', hole: 'Ah Kh', text: 'Tout le monde se couche jusqu’à toi.', options: O3, answer: 2, expl: 'AK est une main premium : on relance.', ref: 12 },
    { pos: 'HJ', hole: 'Ah Kh', board: 'Kd 9c 4h', pot: '5,5 BB', text: 'Seule la grosse blinde a suivi. Elle checke.', options: O2, answer: 1, expl: 'Top paire, meilleur kicker : mise pour la valeur.', ref: 16 },
    { pos: 'HJ', hole: 'Ah Kh', board: 'Kd 9c 4h 2c', pot: '11,5 BB', text: 'Elle suit. Turn : 2♣. Elle checke.', options: O2, answer: 1, expl: 'Rien n’a changé : continue à miser pour la valeur.', ref: 16 },
  ] },
  { title: '99 en UTG+1', steps: [
    { pos: 'UTG+1', hole: '9c 9d', text: 'Le joueur UTG se couche, c’est à toi.', options: O3, answer: 2, expl: '99 fait partie de la charte des positions précoces (77+) : on relance.', ref: 12 },
    { pos: 'UTG+1', hole: '9c 9d', board: '8h 6h 3c', pot: '6,5 BB', text: 'Le bouton a suivi, les blindes se sont couchées. Tu parles en premier.', options: O2, answer: 1, expl: 'Surpaire sur un board coordonné : mise pour la valeur et pour ne pas offrir de carte gratuite aux tirages.', ref: 16 },
    { pos: 'UTG+1', hole: '9c 9d', board: '8h 6h 3c Kh', pot: '14,5 BB', text: 'Il a suivi. Turn : K♥, troisième cœur. Tu parles en premier.', options: O2, answer: 0, expl: 'Le roi et la couleur possible font de ta paire de 9 une main moyenne : checke.', ref: 13 },
  ] },
  { title: 'Tirage couleur au flop', steps: [
    { pos: 'BTN', hole: 'Qh Jh', text: 'Le HJ relance à 2,5 BB, tout le monde se couche jusqu’à toi.', options: O3, answer: 0, expl: 'Face à une relance, la charte ne joue que QQ+, AK, les paires 77+, AQs, AJs et KQs. QJs n’en fait pas partie : on se couche.', ref: 12 },
    { pos: 'BB', hole: 'Kd Td', text: 'Plus tard. Tu es grosse blinde, le bouton relance à 2,5 BB.', options: O3, answer: 1, expl: 'KTs se défend en grosse blinde : on suit.', ref: 12 },
    { pos: 'BB', hole: 'Kd Td', board: 'Ad 7d 3s', pot: '5,5 BB', text: 'Tu checkes, le bouton mise 2 BB.', options: O3, answer: 1, expl: 'Tirage couleur au roi : 9 outs, environ 19 % à la turn seule et 35 % jusqu’à la river. Il faut 2 ÷ 9,5 = 21 %, et si tu touches tu gagneras souvent davantage : suivre est correct.', ref: 15 },
  ] },
];

function stepItems(h: Hand, prefix: string, silent: boolean): ChoiceItem[] {
  return h.steps.map((s, k) => {
    const lines = [<><span className="tag-street">{s.board ? ['Flop', 'Flop', 'Flop', 'Flop', 'Turn', 'River'][s.board.split(' ').length] : 'Préflop'}</span>{s.text}</>];
    return {
      kind: 'choice', id: `${prefix}-${k}`, silent,
      prompt: <>{h.title} · Tu es <strong>{s.pos}</strong> avec <Inline cs={s.hole} /></>,
      scene: (
        <div className="stack">
          {s.board && <div className="row" style={{ justifyContent: 'center' }}><CardRow cs={s.board} size="sm" />{s.pot && <span className="pill">Pot : {s.pot}</span>}</div>}
          <Narr lines={lines} />
        </div>
      ),
      options: s.options, columns: s.options.length === 2 ? 2 : 3, answer: s.answer,
      insight: `${h.title}, ${s.board ? ['', '', '', 'flop', 'turn', 'river'][s.board.split(' ').length] : 'préflop'} : ${s.expl} (Leçon ${s.ref}.)`,
      feedback: <>{s.expl} <span className="muted">Voir la leçon {s.ref}.</span></>,
      ref: s.ref,
    };
  });
}

const L17: Lesson = {
  id: 17, module: 5,
  title: 'Jouer une main complète',
  objective: 'Enchaîner seul les décisions, du préflop à la river.',
  defi: {
    intro: <p>Trois mains, à jouer en entier. Tu décides à chaque tour. Aucune correction pendant le jeu : le débriefing complet t’attend au bilan.</p>,
    items: () => HANDS_DEFI.flatMap((h, i) => stepItems(h, `l17-${i}`, true)),
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box">
          <h3>Les quatre questions à te poser à chaque décision</h3>
          <ol className="steps mt">
            <li><strong>Ma position</strong> : je parle avant ou après ? (leçon 11)</li>
            <li><strong>Ma main par rapport au board</strong> : forte, moyenne ou faible ? (leçon 13)</li>
            <li><strong>Le pot et le prix</strong> : combien je paie, quelles sont mes chances ? (leçons 14 et 15)</li>
            <li><strong>Pourquoi je mise</strong> : pour être payé, ou pour faire coucher ? (leçon 16)</li>
          </ol>
        </div>
      </div>
    ),
  },
  training: {
    intro: <p>Trois nouvelles mains, avec correction à chaque décision cette fois.</p>,
    items: () => {
      const hs = sample(HANDS_TRAINING, 3);
      return hs.flatMap((h, i) => stepItems(h, `l17t${i}`, false));
    },
  },
  fiche: {
    essentiel: [
      'À chaque décision : ma position, ma main par rapport au board, le pot et le prix, la raison de ma mise.',
      'Préflop : suis la charte. Relance ou couche-toi.',
      'Postflop : mise tes mains fortes, checke tes mains moyennes, abandonne quand le prix est trop cher.',
    ],
    blocks: [{ kind: 'steps', title: 'Les quatre questions', steps: ['Ma position : je parle avant ou après ?', 'Ma main par rapport au board : forte, moyenne ou faible ?', 'Le pot et le prix : combien je paie, quelles sont mes chances ?', 'Pourquoi je mise : pour être payé, ou pour faire coucher ?'] }],
    pieges: ['Jouer une main uniquement parce qu’on l’aime bien.', 'S’accrocher à une petite paire sur un board de cartes hautes.'],
  },
};

export const LESSONS_M5 = [L13, L14, L15, L16, L17];
