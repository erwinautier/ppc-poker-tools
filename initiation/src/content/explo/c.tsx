/** Exploration · Module C · Penser en ranges (leçons C9 à C11). */
import { useMemo, useState } from 'react';
import type { ChoiceItem, Item, Lesson, NumberItem } from '../types';
import { CardRow, Inline } from '../../components/Cards';
import { Basics, RangeCompare, RangeGrid, compareRanges, pct } from '../../components/Explo';
import { T } from '../../components/Term';
import { Narr, sample, trueFalse, withIds } from '../helpers';
import { type Card, cardLabel, cards, draw, pick, rankOf, shuffle } from '../../lib/cards';
import { BB_CALL, OPEN, parseRange, pct as rangePct } from '../../lib/chart';
import { le, postflopOrder, seatOrder, strongDetail } from '../../lib/theory';

const M = 13; // module C

// ════════════════════════════════════════════════════════════════════════════
// C9 · De la main à la range
// ════════════════════════════════════════════════════════════════════════════

type Shape = 'Linear (merged)' | 'Polarized' | 'Capped';
const SHAPES: Shape[] = ['Linear (merged)', 'Polarized', 'Capped'];
const SHAPE_FR: Record<Shape, string> = {
  'Linear (merged)': 'les meilleures mains, d’un seul bloc, sans trou',
  Polarized: 'des mains très fortes et des bluffs, rien au milieu',
  Capped: 'des mains moyennes, sans les toutes meilleures',
};
const SHAPE_RANGES: Record<Shape, string[]> = {
  'Linear (merged)': ['TT+, AQs+, AKo', '99+, ATs+, KJs+, QJs, AJo+, KQo', '66+, A8s+, KTs+, QTs+, JTs, ATo+, KJo+'],
  Polarized: ['QQ+, AKs, AKo, A5s, A4s, A3s, 76s, 65s', 'KK+, AKs, A5s, A4s, K9s, 87s, 76s', 'JJ+, AKs, AKo, A5s, A4s, A3s, A2s, 65s, 54s'],
  Capped: [
    '77, 88, 99, TT, JJ, AQs, AJs, ATs, KQs, KJs, QJs, JTs, AQo',
    '22, 33, 44, 55, 66, 77, 88, 99, TT, A9s, ATs, AJs, KTs, KJs, QTs, QJs, JTs, T9s, 98s, AJo, KQo',
    [...BB_CALL].join(', '),
  ],
};
/** Actions et forme de range qu'elles produisent en général. */
const ACTION_SHAPE: [string, Shape, string][] = [
  ['Open UTG', 'Linear (merged)', 'Un open prend les meilleures mains jusqu’à un certain seuil : la range est linéaire.'],
  ['Open BTN', 'Linear (merged)', 'Plus large qu’UTG, mais toujours « les meilleures mains d’abord » : linéaire.'],
  ['3-bet avec seulement de la value (QQ+, AK)', 'Linear (merged)', 'Uniquement le haut de la range, d’un seul bloc : linéaire.'],
  ['3-bet du BTN avec quelques bluffs (A5s, 76s…)', 'Polarized', 'Des monstres et des bluffs, et les mains moyennes se contentent de payer : polarisée.'],
  ['Mise au pot à la river', 'Polarized', 'Une grosse mise à la river, c’est des nuts ou des bluffs : les mains moyennes préfèrent checker.'],
  ['Cold call d’un open', 'Capped', 'Avec AA ou KK, on aurait 3-bet : la range du cold call est plafonnée.'],
  ['Défense de la BB par un simple call', 'Capped', 'Les meilleures mains de la BB 3-bet : celles qui paient sont plafonnées.'],
];

function SpecGrid({ spec }: { spec: string }) {
  return <RangeGrid set={parseRange(spec)} />;
}

function shapeItem(id: string, shape: Shape, spec: string, insight?: string): ChoiceItem {
  return {
    kind: 'choice', id, prompt: 'Quelle est la forme de cette range ?',
    scene: <div style={{ maxWidth: 260, margin: '0 auto', width: '100%' }}><SpecGrid spec={spec} /></div>,
    options: SHAPES, columns: 1, answer: SHAPES.indexOf(shape), insight,
    feedback: <><strong>{shape}</strong> : {SHAPE_FR[shape]}.</>,
  };
}

const WHO_GRIDS: [string, Set<string>][] = [
  ['Open UTG', OPEN.precoce],
  ['Open BTN', OPEN.bouton],
  ['3-bet (QQ+, AK)', parseRange('QQ+, AKs, AKo')],
];
function whoGridItem(id: string, k: number, insight?: string): ChoiceItem {
  const [name, set] = WHO_GRIDS[k];
  return {
    kind: 'choice', id, prompt: 'Cette range est jouée par un joueur du club (chartes de l’Initiation). C’est laquelle ?',
    scene: <div style={{ maxWidth: 260, margin: '0 auto', width: '100%' }}><RangeGrid set={set} /></div>,
    options: WHO_GRIDS.map(w => w[0]), columns: 1, answer: k, insight,
    feedback: `${name} : environ ${rangePct(set)} % des mains de départ.`,
  };
}
function actionShapeItem(id: string): ChoiceItem {
  const [action, shape, why] = pick(ACTION_SHAPE);
  return { kind: 'choice', id, prompt: <>Quelle forme a en général la range d’un joueur qui fait : <strong>{action}</strong> ?</>, options: SHAPES, columns: 1, answer: SHAPES.indexOf(shape), feedback: why };
}
function shapeToActionItem(id: string): ChoiceItem {
  const shape = pick(SHAPES);
  const good = pick(ACTION_SHAPE.filter(a => a[1] === shape));
  const bad = sample(ACTION_SHAPE.filter(a => a[1] !== shape), 2);
  const opts = shuffle([good, ...bad]);
  return {
    kind: 'choice', id, prompt: 'Quelle action produit en général cette forme de range ?',
    scene: <div style={{ maxWidth: 260, margin: '0 auto', width: '100%' }}><SpecGrid spec={pick(SHAPE_RANGES[shape])} /></div>,
    options: opts.map(o => o[0]), columns: 1, answer: opts.indexOf(good), feedback: <><strong>{shape}</strong>. {good[2]}</>,
  };
}
const CAPPED_Q: ChoiceItem = {
  kind: 'choice', id: '', prompt: 'L’UTG ouvre, le CO paie seulement (cold call). Quelle main est la plus rare dans la range du CO ?',
  options: ['AA', 'TT', 'AJs', 'KQs'], columns: 2, answer: 0,
  feedback: 'Avec AA, le CO aurait presque toujours 3-bet : sa range de cold call est capped.',
};

const C9: Lesson = {
  id: 109, code: 'C9', parcours: 'exploration', module: M,
  title: 'De la main à la range',
  objective: 'Raisonner sur l’ensemble des mains adverses et reconnaître la forme d’une range.',
  defi: {
    intro: <p>Ton adversaire n’a pas « une main » : selon ses actions, il peut en avoir beaucoup. Regarde ces grilles et essaie d’en deviner l’origine, puis la forme.</p>,
    items: () => [
      whoGridItem('c9-1', 0, 'Une range d’open UTG est étroite : environ 7 % des mains.'),
      whoGridItem('c9-2', 1, 'Une range d’open BTN est large : environ un tiers des mains.'),
      whoGridItem('c9-3', 2, 'Une range de 3-bet « value seulement » ne garde que le très haut.'),
      shapeItem('c9-4', 'Linear (merged)', SHAPE_RANGES['Linear (merged)'][1], 'Linear (merged) : les meilleures mains, d’un seul bloc.'),
      shapeItem('c9-5', 'Polarized', SHAPE_RANGES.Polarized[0], 'Polarized : des mains très fortes et des bluffs, sans mains moyennes.'),
      shapeItem('c9-6', 'Capped', SHAPE_RANGES.Capped[0], 'Capped : les meilleures mains en sont absentes.'),
      { ...CAPPED_Q, id: 'c9-7', insight: 'Un cold call contient rarement AA : la range est plafonnée.' },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <p>Chaque action <strong>retire des mains</strong> de la <T k="x-range">range</T> adverse : un open UTG élimine déjà 93 % des mains ; un call, une relance ou un check au flop en retirent d’autres. On ne devine pas une main, on suit une range.</p>
        <div className="grid3">
          {SHAPES.map(s => (
            <div key={s} className="stack" style={{ gap: 4 }}>
              <SpecGrid spec={SHAPE_RANGES[s][0]} />
              <strong className="small">{s}</strong>
              <span className="muted small">{SHAPE_FR[s]}</span>
            </div>
          ))}
        </div>
        <div className="key-box prose">
          <h3>Les trois formes</h3>
          <ul>
            <li><strong><T k="x-linear">Linear (merged)</T></strong> : les meilleures mains jusqu’à un seuil. Typique d’un open.</li>
            <li><strong><T k="x-polar">Polarized</T></strong> : des nuts et des bluffs, rien au milieu. Typique d’un 3-bet avec bluffs ou d’une grosse mise à la river.</li>
            <li><strong><T k="x-capped">Capped</T></strong> : les toutes meilleures mains manquent. Typique d’un simple call (cold call, défense de BB) : avec AA, on relance.</li>
          </ul>
        </div>
        <Basics refs={[[12, 'Ouvrir, suivre ou se coucher']]} />
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      ...sample(SHAPES, 3).map(s => shapeItem('', s, pick(SHAPE_RANGES[s]))),
      actionShapeItem(''), actionShapeItem(''), shapeToActionItem(''), shapeToActionItem(''), CAPPED_Q,
      trueFalse('', 'Une range polarisée contient surtout des mains moyennes.', false, 'Faux : elle contient des mains très fortes et des bluffs, pas de mains moyennes.'),
    ]), 'c9t'),
  },
  fiche: {
    essentiel: [
      'On ne joue pas contre une main, mais contre une range : chaque action en retire des mains.',
      'Linear (merged) : les meilleures mains d’un seul bloc (un open).',
      'Polarized : nuts et bluffs, rien au milieu (3-bet avec bluffs, grosse mise river).',
      'Capped : les meilleures mains manquent (cold call, défense BB par un call).',
    ],
    blocks: [{ kind: 'table', title: 'Les trois formes de range', head: ['Forme', 'Contenu', 'Action typique'], widths: [40, 75, 65], rows: [
      ['Linear (merged)', 'Les meilleures mains jusqu’à un seuil', 'Open, 3-bet value'],
      ['Polarized', 'Nuts + bluffs, rien au milieu', '3-bet avec bluffs, overbet river'],
      ['Capped', 'Sans les toutes meilleures mains', 'Cold call, call en BB'],
    ] }],
    pieges: ['Mettre une seule main à l’adversaire (« il a AK »).', 'Oublier qu’un simple call a rarement AA ou KK.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// C10 · Range advantage et nut advantage
// ════════════════════════════════════════════════════════════════════════════

const BB_FLAT = [...BB_CALL].join(', ');
const MATCHUPS = [
  { a: { name: 'UTG (open)', spec: [...OPEN.precoce].join(', ') }, b: { name: 'BB (défense)', spec: BB_FLAT } },
  { a: { name: 'BTN (open)', spec: [...OPEN.bouton].join(', ') }, b: { name: 'BB (défense)', spec: BB_FLAT } },
];
const short = (name: string) => name.split(' ')[0];

/** Deux questions sur un flop (qui a le plus d'équité ? qui a le plus de mains très fortes ?), puis le comparateur tranche. */
function AdvQuiz({ m, board, done }: { m: typeof MATCHUPS[number]; board: Card[]; done: (x: { correct: boolean; answer: string; expected: string }) => void }) {
  const truth = useMemo(() => compareRanges(m.a.spec, m.b.spec, board, 8000), [m, board]);
  const [eq, setEq] = useState<0 | 1 | null>(null);
  const [nut, setNut] = useState<0 | 1 | null>(null);
  const [shown, setShown] = useState(false);
  const names = [short(m.a.name), short(m.b.name)];
  const eqT = truth.equityA >= 0.5 ? 0 : 1, nutT = truth.nutShareA >= truth.nutShareB ? 0 : 1;
  const validate = () => {
    setShown(true);
    done({ correct: eq === eqT && nut === nutT, answer: `équité : ${names[eq!]}, nuts : ${names[nut!]}`, expected: `équité : ${names[eqT]}, nuts : ${names[nutT]}` });
  };
  const btns = (v: 0 | 1 | null, set: (x: 0 | 1) => void, truthV: 0 | 1) => (
    <div className="row">
      {names.map((n, i) => (
        <button key={n} className={`opt ${v === i ? 'sel' : ''} ${shown && truthV === i ? 'good' : ''} ${shown && v === i && truthV !== i ? 'bad' : ''}`} disabled={shown} onClick={() => set(i as 0 | 1)}>{n}</button>
      ))}
    </div>
  );
  return (
    <div className="stack">
      <RangeCompare a={m.a} b={m.b} board={board} run={shown} />
      <div className="stack" style={{ gap: 4 }}>
        <span className="small"><strong>Range advantage</strong> : qui a le plus d’équité avec toute sa range ?</span>
        {btns(eq, setEq, eqT)}
        <span className="small"><strong>Nut advantage</strong> : qui a la plus grande part de mains très fortes (deux paires ou mieux) ?</span>
        {btns(nut, setNut, nutT)}
      </div>
      {!shown && <button className="btn primary" disabled={eq === null || nut === null} onClick={validate}>Lancer le comparateur</button>}
    </div>
  );
}
function advItem(id: string, mi: number, board: string, insight?: string, feedback?: string): Item {
  const b = cards(board);
  return { kind: 'custom', id, prompt: <>{MATCHUPS[mi].a.name.split(' ')[0]} a ouvert, la BB a payé. Flop <Inline cs={board} /></>, render: done => <AdvQuiz m={MATCHUPS[mi]} board={b} done={done} />, insight, feedback };
}

/**
 * Flop aléatoire non pairé où l'avantage demandé est net. La bonne réponse est tirée d'abord
 * (agresseur ou BB, une fois sur deux), pour ne pas toujours désigner l'agresseur.
 */
function advTrainingItem(id: string): ChoiceItem {
  const want = pick([0, 1] as const);
  const kind = pick(['range', 'nut'] as const);
  for (let tries = 0; ; tries++) {
    const board = draw(3);
    const ranks = board.map(rankOf);
    if (new Set(ranks).size < 3) continue;
    const strict = tries < 400; // au-delà, on accepte un cas net quel que soit le camp
    // la BB ne prend le range advantage que contre l'open large du BTN, sur les flops bas
    const mi = kind === 'range' && want === 1 && strict ? 1 : pick([0, 1]);
    if (kind === 'range' && want === 1 && strict && Math.max(...ranks) > 6) continue;
    const m = MATCHUPS[mi];
    const ra = parseRange(m.a.spec), rb = parseRange(m.b.spec);
    if (kind === 'nut') {
      const sa = strongDetail(ra, board).share, sb = strongDetail(rb, board).share;
      if (Math.abs(sa - sb) < 0.025 || Math.max(sa, sb) < 1.6 * Math.min(sa, sb)) continue;
      const ans = sa > sb ? 0 : 1;
      if (strict && ans !== want) continue;
      return {
        kind: 'choice', id, prompt: <>Qui a le <strong>nut advantage</strong> (la plus grande part de deux paires ou mieux) ?</>,
        scene: <RangeCompare a={m.a} b={m.b} board={board} run={false} />,
        options: [m.a.name, m.b.name], columns: 2, answer: ans,
        feedback: <>Mains très fortes : {short(m.a.name)} {pct(sa, 1)} de sa range, {short(m.b.name)} {pct(sb, 1)}.</>,
      };
    }
    const e = compareRanges(m.a.spec, m.b.spec, board, 3000).equityA;
    if (Math.abs(e - 0.5) < 0.035) continue;
    const ans = e > 0.5 ? 0 : 1;
    if (strict && ans !== want) continue;
    return {
      kind: 'choice', id, prompt: <>Qui a le <strong>range advantage</strong> (le plus d’équité avec toute sa range) ?</>,
      scene: <RangeCompare a={m.a} b={m.b} board={board} run={false} />,
      options: [m.a.name, m.b.name], columns: 2, answer: ans,
      feedback: <>Équité simulée : {short(m.a.name)} ≈ {pct(e)}, {short(m.b.name)} ≈ {pct(1 - e)}.</>,
    };
  }
}

const ADV_BOARDS = ['As Kd 7c', 'Kh 8d 3c', '7h 6h 5c'];
/** Tableau calculé à l'affichage : équité et part de mains très fortes, board par board. */
function AdvTable({ mi }: { mi: number }) {
  const m = MATCHUPS[mi];
  const rows = useMemo(() => [...ADV_BOARDS, '6d 5s 4c', 'Qs Js Td'].map(bd => ({ bd, ...compareRanges(m.a.spec, m.b.spec, cards(bd), 8000) })), [m]);
  const [a, b] = [short(m.a.name), short(m.b.name)];
  return (
    <table className="tbl">
      <thead><tr><th>Flop</th><th className="r">Équité {a}</th><th className="r">Nuts {a}</th><th className="r">Nuts {b}</th></tr></thead>
      <tbody>{rows.map(r => (
        <tr key={r.bd}><td>{cards(r.bd).map(cardLabel).join(' ')}</td><td className="r">{pct(r.equityA)}</td><td className="r">{pct(r.nutShareA, 1)}</td><td className="r">{pct(r.nutShareB, 1)}</td></tr>
      ))}</tbody>
    </table>
  );
}

const C10: Lesson = {
  id: 110, code: 'C10', parcours: 'exploration', module: M,
  title: 'Range advantage et nut advantage',
  objective: 'Distinguer qui a le plus d’équité et qui a le plus de mains très fortes sur un board.',
  defi: {
    intro: <p>L’UTG ouvre, la BB défend (chartes de l’Initiation). Sur trois flops, devine qui a le plus d’<strong>équité</strong> avec toute sa range, et qui a la plus grande part de <strong>mains très fortes</strong>. Le comparateur simule ensuite des milliers de mains.</p>,
    items: () => [
      advItem('c10-1', 0, ADV_BOARDS[0], 'Sur un flop haut (A-K-7), l’agresseur préflop a les deux avantages.', 'AA, KK, AK : la range d’open UTG touche très fort ce flop.'),
      advItem('c10-2', 0, ADV_BOARDS[1], 'Sur K-8-3, l’UTG garde les deux avantages.', 'La range UTG contient tous les rois forts et les overpairs.'),
      advItem('c10-3', 0, ADV_BOARDS[2], 'Sur un flop bas et connecté, la BB récupère le nut advantage, même si l’UTG garde plus d’équité.', 'La BB a des sets (55, 66, 77), des deux paires (76s, 75s, 65s) et des suites (98s) ; l’UTG n’a que le set de 7 et beaucoup d’overpairs.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <p>UTG (open) contre BB (défense), calculés en direct :</p>
        <AdvTable mi={0} />
        <div className="key-box prose">
          <h3>Deux avantages différents</h3>
          <ul>
            <li><strong><T k="x-rangeadv">Range advantage</T></strong> : la range qui a le plus d’équité, toutes mains confondues.</li>
            <li><strong><T k="x-nutadv">Nut advantage</T></strong> : la range qui contient la plus grande part de mains très fortes (deux paires, sets, suites…).</li>
          </ul>
          <p>Sur les boards <strong>hauts</strong>, l’agresseur préflop a en général les deux. Sur les boards <strong>bas et connectés</strong>, le défenseur récupère le nut advantage : ses petites paires et ses connecteurs y font des sets et des suites, alors que la range d’open touche surtout avec des overpairs.</p>
          <p>Une range d’open UTG est si forte qu’elle garde plus d’équité presque partout. Une range d’open plus large, comme celle du BTN, perd aussi le range advantage sur les boards bas :</p>
        </div>
        <AdvTable mi={1} />
        <p className="muted small">« Nuts » : part de la range (en combos) qui fait deux paires ou mieux sur ce flop.</p>
      </div>
    ),
  },
  training: { items: () => Array.from({ length: 8 }, (_, i) => advTrainingItem(`c10t${i}`)) },
  fiche: {
    essentiel: [
      'Range advantage : la range qui a le plus d’équité, toutes mains confondues.',
      'Nut advantage : la range qui a la plus grande part de mains très fortes (deux paires ou mieux).',
      'Boards hauts : l’agresseur préflop a en général les deux avantages.',
      'Boards bas et connectés : le défenseur récupère le nut advantage ; contre un open large, il prend aussi l’équité.',
    ],
    blocks: [{ kind: 'table', title: 'UTG (open) contre BB (défense), exemples', head: ['Flop', 'Range advantage', 'Nut advantage'], rows: [
      ['A-K-7', 'UTG', 'UTG'], ['K-8-3', 'UTG', 'UTG'], ['7-6-5 (deux cœurs)', 'UTG', 'BB'], ['6-5-4', 'UTG', 'BB'],
    ] }],
    pieges: ['Confondre « plus d’équité » et « plus de mains très fortes ».', 'Croire que l’agresseur préflop a toujours l’avantage, quel que soit le board.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// C11 · Position et initiative
// ════════════════════════════════════════════════════════════════════════════

const me = (s: string) => <strong style={{ color: 'var(--ppc-or)' }}>{s}</strong>;

const IP_HAND: NumberItem = {
  kind: 'number', id: 'c11-1', unit: 'sur 3',
  prompt: 'Tu es au BTN avec A♠J♠, la BB a payé ton open. Sur tes 3 décisions, combien en as-tu prises en connaissant déjà l’action de la BB ?',
  scene: <Narr lines={[
    <>Flop <Inline cs="Ks 7d 2c" /></>, <>BB : check</>, <>{me('Toi')} : mise 2 BB</>, <>BB : suit</>,
    <>Turn <Inline cs="5h" /></>, <>BB : check</>, <>{me('Toi')} : check</>,
    <>River <Inline cs="Jd" /></>, <>BB : mise 4 BB</>, <>{me('Toi')} : suit</>,
  ]} />,
  answer: 3, insight: 'En position (IP), chacune de tes décisions est prise en connaissant l’action adverse.',
  feedback: 'Les trois : la BB parle toujours avant toi après le flop.',
};
const OOP_HAND: NumberItem = {
  kind: 'number', id: 'c11-2', unit: 'sur 4',
  prompt: 'Même main, mais cette fois tu es en BB face au BTN. Sur tes 4 décisions, combien en as-tu prises en connaissant déjà l’action du BTN ?',
  scene: <Narr lines={[
    <>Flop <Inline cs="Ks 7d 2c" /></>, <>{me('Toi')} : check</>, <>BTN : mise 2 BB</>, <>{me('Toi')} : suit</>,
    <>Turn <Inline cs="5h" /></>, <>{me('Toi')} : check</>, <>BTN : check</>,
    <>River <Inline cs="Jd" /></>, <>{me('Toi')} : mise 4 BB</>, <>BTN : suit</>,
  ]} />,
  answer: 1, insight: 'Hors de position (OOP), tu ouvres chaque tour sans savoir ce que fera l’adversaire.',
  feedback: 'Une seule : le call au flop. Tes trois autres décisions ont été prises « à l’aveugle ».',
};

type Line = { steps: [string, string][]; aggressor: string };
/** Séquence d'un coup à deux joueurs, du préflop au flop, avec le dernier agresseur. */
function randomLine(): { a: string; b: string; ip: string; oop: string; pre: [string, string][]; flop: Card[]; line: Line } {
  const order = seatOrder(8);
  const [i, j] = sample([...Array(order.length).keys()], 2).sort((x, y) => x - y);
  const a = order[i], b = order[j];
  const pf = postflopOrder(8);
  const [oop, ip] = pf.indexOf(a) < pf.indexOf(b) ? [a, b] : [b, a];
  const three = Math.random() < 0.4;
  const pre: [string, string][] = three ? [[a, 'relance à 2,5 BB'], [b, '3-bet à 8 BB'], [a, 'suit']] : [[a, 'relance à 2,5 BB'], [b, 'suit']];
  const lines: Line[] = [
    { steps: [[oop, 'check'], [ip, 'mise'], [oop, 'suit']], aggressor: ip },
    { steps: [[oop, 'mise'], [ip, 'suit']], aggressor: oop },
    { steps: [[oop, 'check'], [ip, 'mise'], [oop, 'check-raise'], [ip, 'suit']], aggressor: oop },
    { steps: [[oop, 'mise'], [ip, 'relance'], [oop, 'suit']], aggressor: ip },
  ];
  return { a, b, ip, oop, pre, flop: draw(3), line: pick(lines) };
}
function lineScene(pre: [string, string][], flop: Card[] | null, steps: [string, string][]) {
  return <Narr lines={[<span className="muted">Les autres joueurs se couchent.</span>, ...pre.map(([p, x]) => <>{p} : {x}</>), ...(flop ? [<>Flop <CardRow cs={flop} size="xs" /></>, ...steps.map(([p, x]) => <>{p} : {x}</>)] : [])]} />;
}
function initiativeItem(id: string): ChoiceItem {
  const r = randomLine();
  const opts = [r.a, r.b];
  return {
    kind: 'choice', id, prompt: 'Qui a l’initiative au turn ?', scene: lineScene(r.pre, r.flop, r.line.steps),
    options: opts, columns: 2, answer: opts.indexOf(r.line.aggressor),
    feedback: `Le dernier agresseur (la dernière mise ou relance) est ${le(r.line.aggressor)} : c’est lui qui a l’initiative.`,
  };
}
function preflopInitiativeItem(id: string): ChoiceItem {
  const r = randomLine();
  const opts = [r.a, r.b];
  const agg = r.pre.length === 3 ? r.b : r.a;
  return {
    kind: 'choice', id, prompt: 'Qui a l’initiative au flop ?', scene: lineScene(r.pre, null, []),
    options: opts, columns: 2, answer: opts.indexOf(agg),
    feedback: `Le dernier à avoir relancé préflop est ${le(agg)}.`,
  };
}
function ipItem(id: string): ChoiceItem {
  const r = randomLine();
  const opts = [r.a, r.b];
  return {
    kind: 'choice', id, prompt: 'Qui sera en position (IP) après le flop ?', scene: lineScene(r.pre, null, []),
    options: opts, columns: 2, answer: opts.indexOf(r.ip),
    feedback: `Après le flop, l’ordre de parole est ${postflopOrder(8).join(', ')} : ${le(r.ip)} parle après ${le(r.oop)}.`,
  };
}

const C11: Lesson = {
  id: 111, code: 'C11', parcours: 'exploration', module: M,
  title: 'Position et initiative',
  objective: 'Mesurer ce que rapporte la position, et savoir qui a l’initiative.',
  defi: {
    intro: <p>La même main, jouée une fois en position et une fois hors de position. Compte les décisions que tu prends en sachant déjà ce qu’a fait l’adversaire. Puis désigne qui mène le coup.</p>,
    items: () => [
      IP_HAND,
      OOP_HAND,
      {
        kind: 'choice', id: 'c11-3', prompt: 'Le CO ouvre, la BB paie. Flop : la BB check, le CO mise, la BB suit. Qui a l’initiative au turn ?',
        options: ['CO', 'BB'], columns: 2, answer: 0, insight: 'L’initiative appartient au dernier agresseur.', feedback: 'Le CO a relancé préflop et misé au flop : il reste le dernier agresseur.',
      },
      {
        kind: 'choice', id: 'c11-4', prompt: 'Le CO ouvre, la BB paie. Flop : la BB check, le CO mise, la BB relance (check-raise), le CO suit. Qui a l’initiative au turn ?',
        options: ['CO', 'BB'], columns: 2, answer: 1, insight: 'Un check-raise fait passer l’initiative à celui qui relance.', feedback: 'La BB a fait la dernière relance : l’initiative est passée de son côté.',
      },
      {
        kind: 'choice', id: 'c11-5', prompt: 'Le BTN ouvre, la SB fait un 3-bet, le BTN suit. Après le flop, qui est en position, et qui a l’initiative ?',
        options: ['BTN en position, SB a l’initiative', 'SB en position, BTN a l’initiative', 'BTN a les deux', 'SB a les deux'], columns: 1, answer: 0,
        insight: 'Position et initiative sont indépendantes : on peut avoir l’une sans l’autre.', feedback: 'Le BTN parle toujours en dernier après le flop ; la SB a fait la dernière relance.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Ce que donne la position (IP)</h3>
          <ul>
            <li><strong>L’information</strong> : tu décides en connaissant déjà l’action adverse (3 décisions sur 3 contre 1 sur 4 dans le défi).</li>
            <li><strong>Le contrôle du pot</strong> : tu peux checker derrière pour voir la carte suivante gratuitement, ou miser quand l’adversaire montre de la faiblesse.</li>
            <li><strong>Une meilleure <T k="x-realize">réalisation de l’équité</T></strong> : tu vois plus souvent l’abattage avec tes mains moyennes et tes tirages.</li>
          </ul>
          <h3><T k="x-initiative">L’initiative</T></h3>
          <p>Elle appartient au <strong>dernier agresseur</strong> : celui qui a fait la dernière mise ou relance. Un check-raise la fait changer de camp. Position et initiative sont indépendantes.</p>
        </div>
        <Basics refs={[[11, 'La position, un avantage']]} />
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      ipItem(''), ipItem(''), ipItem(''), initiativeItem(''), initiativeItem(''), initiativeItem(''), preflopInitiativeItem(''),
      trueFalse('', 'Un check-raise fait passer l’initiative au joueur qui relance.', true, 'Vrai : il devient le dernier agresseur.'),
    ]), 'c11t'),
  },
  fiche: {
    essentiel: [
      'IP : on parle après l’adversaire ; OOP : on parle avant lui.',
      'La position donne l’information, le contrôle du pot et une meilleure réalisation de l’équité.',
      'L’initiative appartient au dernier agresseur (dernière mise ou relance).',
      'Un check-raise change l’initiative de camp ; position et initiative sont indépendantes.',
    ],
    blocks: [{ kind: 'steps', title: 'Ordre de parole après le flop (table à 8)', steps: postflopOrder(8) }],
    pieges: ['Croire que le relanceur préflop garde l’initiative après un check-raise.', 'Jouer autant de mains OOP qu’IP.'],
  },
};

export const LESSONS_C = [C9, C10, C11];
