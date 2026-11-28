/** Exploration · Module B · Les chiffres qui comptent (leçons B5 à B8). */
import type { ChoiceItem, EstimateItem, Item, Lesson, NumberItem } from '../types';
import { CardRow, Inline } from '../../components/Cards';
import { ComboList } from '../../components/Explo';
import { T } from '../../components/Term';
import { Duel } from '../lessons/m4';
import { sample, trueFalse, withIds } from '../helpers';
import { type Card, RANK_CHARS, SUIT_CHARS, cards, draw, pick, randInt, rankLabel, rankOf, shuffle } from '../../lib/cards';
import { equityRun, share } from '../../lib/sims';
import { combosOf } from '../../lib/theory';

const M = 12; // module B

function duelItem(id: string, a: string, b: string, insight: string | undefined, feedback: string, board?: string): Item {
  return {
    kind: 'custom', id, prompt: board ? 'À tapis au flop : quelle main est favorite ?' : 'À tapis préflop : quelle main est favorite ?',
    render: done => <Duel a={cards(a)} b={cards(b)} board={board ? cards(board) : []} done={done} />,
    insight, feedback,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// B5 · Les confrontations préflop
// ════════════════════════════════════════════════════════════════════════════

type Family = 'Paire contre paire inférieure' | 'Paire contre deux overcards' | 'Paire contre une over et une under' | 'Paire contre deux undercards' | 'Main dominée' | 'Deux overcards contre deux undercards';
const FAMILIES: Family[] = ['Paire contre paire inférieure', 'Paire contre deux overcards', 'Paire contre une over et une under', 'Paire contre deux undercards', 'Main dominée', 'Deux overcards contre deux undercards'];

const card = (r: number, used: Set<string>) => {
  for (const s of shuffle([...SUIT_CHARS])) { const c = RANK_CHARS[r] + s; if (!used.has(c)) { used.add(c); return c; } }
  throw new Error('plus de cartes');
};
/** Deux mains qui illustrent une famille de duel. */
function familyHands(f: Family): [Card[], Card[]] {
  const u = new Set<string>();
  const pair = (r: number) => [card(r, u), card(r, u)];
  switch (f) {
    case 'Paire contre paire inférieure': { const [hi, lo] = sample([...Array(13).keys()], 2).sort((a, b) => b - a); return [pair(hi), pair(lo)]; }
    case 'Paire contre deux overcards': { const p = randInt(0, 9); const [x, y] = sample([...Array(12 - p).keys()].map(k => k + p + 1), 2); return [pair(p), [card(x, u), card(y, u)]]; }
    case 'Paire contre une over et une under': { const p = randInt(1, 11); return [pair(p), [card(randInt(p + 1, 12), u), card(randInt(0, p - 1), u)]]; }
    case 'Paire contre deux undercards': { const p = randInt(3, 12); const [x, y] = sample([...Array(p).keys()], 2); return [pair(p), [card(x, u), card(y, u)]]; }
    case 'Main dominée': { const [k, hi, lo] = sample([...Array(13).keys()], 3).sort((m, n) => n - m); return [[card(k, u), card(hi, u)], [card(k, u), card(lo, u)]]; }
    default: { const [a, b, c, d] = sample([...Array(13).keys()], 4).sort((m, n) => n - m); return [[card(a, u), card(b, u)], [card(c, u), card(d, u)]]; }
  }
}
const BUCKETS = ['Coin flip (50/50 à 57/43)', '≈ 60/40 à 65/35', '≈ 70/30', '≈ 80/20 ou plus'];
function bucketOf(e: number): number | null {
  const f = Math.max(e, 1 - e);
  const edges = [0.585, 0.665, 0.765];
  if (edges.some(x => Math.abs(f - x) < 0.015)) return null;
  return f < edges[0] ? 0 : f < edges[1] ? 1 : f < edges[2] ? 2 : 3;
}
const hand = (cs: Card[]) => cs.join(' ');
function familyItem(id: string): ChoiceItem {
  const f = pick(FAMILIES);
  const [a, b] = familyHands(f);
  const opts = shuffle([f, ...sample(FAMILIES.filter(x => x !== f), 3)]);
  return { kind: 'choice', id, prompt: <>À quelle famille appartient ce duel : <Inline cs={hand(a)} /> contre <Inline cs={hand(b)} /> ?</>, options: opts, columns: 1, answer: opts.indexOf(f), feedback: `${f}.` };
}
function bucketItem(id: string): ChoiceItem {
  for (;;) {
    const [a, b] = familyHands(pick(FAMILIES));
    const e = share(equityRun(a, b, [], 8000), 'a');
    const k = bucketOf(e);
    if (k === null) continue;
    const fav = e >= 0.5 ? a : b;
    return {
      kind: 'choice', id, prompt: <>Duel à tapis préflop : <Inline cs={hand(a)} /> contre <Inline cs={hand(b)} />. Quel est l’écart environ ?</>,
      options: BUCKETS, columns: 1, answer: k,
      feedback: <>Favori : <Inline cs={hand(fav)} /> avec environ {Math.round(Math.max(e, 1 - e) * 100)} %.</>,
    };
  }
}

const PRE_TABLE: [string, string, string][] = [
  ['Paire contre paire inférieure', 'KK contre 77', '≈ 80/20'],
  ['Paire contre deux overcards', 'QQ contre AKo · 22 contre AKo', '≈ 57/43 · ≈ 53/47'],
  ['Paire contre une over et une under', 'JJ contre A9o', '≈ 72/28'],
  ['Paire contre deux undercards', 'JJ contre T9s', '≈ 81/19'],
  ['Main dominée', 'AK contre AQ', '≈ 74/26'],
  ['Deux overcards contre deux undercards', 'AKo contre 87s', '≈ 58/42'],
  ['Paire contre une de ses cartes', 'AA contre AKo · KK contre AKo', '≈ 93/7 · ≈ 70/30'],
];

const B5: Lesson = {
  id: 105, code: 'B5', parcours: 'exploration', module: M,
  title: 'Les confrontations préflop',
  objective: 'Connaître les grands repères à tapis : 80/20, 70/30, coin flip…',
  defi: {
    intro: <p>Huit duels à tapis. Choisis le favori, puis regarde la simulation trancher. Essaie de repérer des « familles » de duels.</p>,
    items: () => [
      duelItem('b5-1', 'Kh Kd', '7s 7c', 'Paire contre paire inférieure : ≈ 80/20.', 'La paire inférieure doit trouver un brelan (ou mieux) : environ une fois sur cinq.'),
      duelItem('b5-2', 'Qh Qd', 'As Kc', 'Paire contre deux overcards : ≈ 57/43 pour QQ, un coin flip un peu favorable à la paire.', 'La paire est déjà faite ; AK a six outs pour une paire meilleure.'),
      duelItem('b5-3', '2h 2d', 'As Kc', 'Même une paire de 2 reste (légèrement) favorite face à AK : ≈ 53/47.', 'C’est le coin flip type : presque pile ou face.'),
      duelItem('b5-4', 'Jh Jd', 'As 9c', 'Paire contre une over et une under : ≈ 72/28.', 'Seul l’as fait peur aux valets : trois outs « directs ».'),
      duelItem('b5-5', 'Jh Jd', 'Ts 9s', 'Paire contre deux undercards : ≈ 80/20, même face à des connecteurs assortis.', 'T9s a des tirages, mais aucune carte haute.'),
      duelItem('b5-6', 'As Kc', 'Ad Qh', 'Main dominée (même carte, moins bon kicker) : ≈ 74/26.', 'Quand les deux touchent un as, AK gagne au kicker.'),
      duelItem('b5-7', 'As Kc', '8d 7d', 'Deux overcards contre deux undercards : ≈ 58/42.', 'Les petites cartes connectées gardent de bonnes chances.'),
      duelItem('b5-8', 'Ah Ad', 'As Kc', 'Une paire contre une main qui contient une de ses cartes : AA ≈ 93/7 contre AK.', 'AK n’a quasiment que des suites et des couleurs pour gagner.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Famille</th><th>Exemple</th><th className="r">Équité</th></tr></thead>
          <tbody>{PRE_TABLE.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td className="r">{r[2]}</td></tr>)}</tbody>
        </table>
        <div className="key-box prose">
          <h3>Trois repères à retenir</h3>
          <ul>
            <li><strong>80/20</strong> : paire contre paire inférieure, ou contre deux cartes plus basses.</li>
            <li><strong>70/30</strong> : paire contre une over et une under ; et la main <T k="x-dominated">dominée</T> ne gagne qu’une fois sur quatre.</li>
            <li><strong><T k="x-flip">Coin flip</T></strong> : paire contre deux <T k="x-overcards">overcards</T>, de 53/47 à 57/43 en faveur de la paire.</li>
          </ul>
        </div>
        <p className="muted small">Chiffres calculés par simulation (200 000 boards par duel). Ils bougent d’un ou deux points selon les couleurs exactes des cartes.</p>
      </div>
    ),
  },
  training: { items: () => withIds(shuffle<Item>([familyItem(''), familyItem(''), familyItem(''), familyItem(''), bucketItem(''), bucketItem(''), bucketItem(''), bucketItem(''), bucketItem('')]), 'b5t') },
  fiche: {
    essentiel: [
      'Paire contre paire inférieure : ≈ 80/20. Paire contre deux undercards : ≈ 80/20.',
      'Paire contre une over et une under : ≈ 70/30. Main dominée : ≈ 74/26.',
      'Paire contre deux overcards : coin flip, de 53/47 à 57/43 pour la paire.',
      'Deux overcards contre deux undercards : ≈ 58/42 ; AA contre AK : ≈ 93/7.',
    ],
    blocks: [{ kind: 'table', title: 'Les familles de duels préflop', head: ['Famille', 'Exemple', 'Équité'], widths: [70, 70, 40], rows: PRE_TABLE.map(r => [...r]) }],
    pieges: ['Croire qu’AK est favori face à une petite paire : c’est l’inverse, de peu.', 'Sous-estimer la domination : AQ contre AK, c’est une chance sur quatre.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// B6 · Toucher le flop
// ════════════════════════════════════════════════════════════════════════════

const N = 2000;
const freq = (trial: () => boolean) => () => { let k = 0; for (let i = 0; i < N; i++) if (trial()) k++; return k / N; };
function est(id: string, prompt: string, answer: number, tolerance: number, max: number, step: number, simulate: () => number, feedback: string, insight?: string): EstimateItem {
  return { kind: 'estimate', id, prompt, min: 0, max, step, answer, tolerance, unit: '%', simulate, simLabel: 'Simulation en direct', feedback, insight };
}
const setMining = (call: number): NumberItem => ({
  kind: 'number', id: '', prompt: `Tu paies ${call} BB pour voir le flop avec 5-5, uniquement pour toucher un set (1 fois sur 8,5). Combien dois-tu gagner en moyenne quand tu touches, pour être à l’équilibre ?`,
  answer: Math.round(call * 7.5 * 10) / 10, tolerance: Math.max(1, call * 0.5), unit: 'BB',
  feedback: `Sur 8,5 fois, tu perds ${call} BB 7,5 fois et tu touches 1 fois : il faut gagner 7,5 × ${call} = ${Math.round(call * 7.5 * 10) / 10} BB quand tu touches.`,
});

const B6: Lesson = {
  id: 106, code: 'B6', parcours: 'exploration', module: M,
  title: 'Toucher le flop',
  objective: 'Savoir à quelle fréquence le flop aide ta main, et le calcul du set mining.',
  defi: {
    intro: <p>Estime au curseur, puis une simulation en direct donne la réponse. Les écarts entre l’intuition et la réalité sont souvent surprenants.</p>,
    items: () => [
      est('b6-1', 'Avec une paire servie, combien de fois sur 100 fais-tu un set (ou mieux) au flop ?', 12, 3, 50, 1, freq(() => draw(3, ['5s', '5h']).some(c => c[0] === '5')), '≈ 11,8 % : une fois sur 8,5.', 'Une paire servie touche son set environ 1 fois sur 8,5.'),
      est('b6-2', 'Avec A-K, combien de fois sur 100 touches-tu au moins une paire (un as ou un roi) au flop ?', 32, 5, 100, 1, freq(() => draw(3, ['As', 'Kd']).some(c => c[0] === 'A' || c[0] === 'K')), '≈ 32 % : AK manque le flop deux fois sur trois.', 'Une main non appariée touche au moins une paire environ 1 fois sur 3.'),
      est('b6-3', 'Avec deux cartes assorties, combien de fois sur 100 le flop te donne-t-il exactement un tirage couleur ?', 11, 3, 50, 1, freq(() => draw(3, ['Ah', 'Kh']).filter(c => c[1] === 'h').length === 2), '≈ 10,9 %.', 'Tirage couleur au flop avec des cartes assorties : ≈ 11 %.'),
      est('b6-4', 'Et combien de fois sur 100 la couleur est-elle déjà faite au flop ?', 0.8, 1, 10, 0.5, freq(() => draw(3, ['Ah', 'Kh']).every(c => c[1] === 'h')), '≈ 0,8 % : moins d’une fois sur 100.', 'Couleur faite au flop : moins d’1 fois sur 100.'),
      est('b6-5', 'Tu as Q-Q. Combien de fois sur 100 au moins un as ou un roi tombe-t-il au flop ?', 41, 6, 100, 1, freq(() => draw(3, ['Qs', 'Qh']).some(c => c[0] === 'A' || c[0] === 'K')), '≈ 41 % : un flop sur deux, ou presque, amène une overcard.', 'Avec QQ, une overcard tombe au flop ≈ 4 fois sur 10.'),
      { ...setMining(3), id: 'b6-6', insight: 'Set mining : pour payer seulement pour le set, il faut gagner en moyenne 7,5 fois la mise quand on touche.' },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Ta main</th><th>Au flop</th><th className="r">Fréquence</th></tr></thead>
          <tbody>
            <tr><td>Paire servie</td><td>Set ou mieux</td><td className="r">11,8 % (1 sur 8,5)</td></tr>
            <tr><td>Deux cartes différentes</td><td>Au moins une paire avec tes cartes</td><td className="r">32 %</td></tr>
            <tr><td>Deux cartes assorties</td><td>Tirage couleur</td><td className="r">10,9 %</td></tr>
            <tr><td>Deux cartes assorties</td><td>Couleur faite</td><td className="r">0,8 %</td></tr>
            <tr><td>QQ</td><td>Au moins un as ou un roi</td><td className="r">41 %</td></tr>
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>Le calcul du <T k="x-setmining">set mining</T></h3>
          <p>Le set arrive 1 fois sur 8,5 : sur 8,5 essais, tu perds ta mise 7,5 fois. Pour être à l’équilibre, il faut donc gagner en moyenne <strong>7,5 fois la mise</strong> quand le set tombe. C’est un calcul exact.</p>
          <p>Les règles « 15 à 20 fois le tapis restant » que l’on entend souvent sont des usages prudents : on ne gagne pas toujours tout quand on touche, ce sont les <T k="x-implied">implied odds</T>.</p>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      trueFalse('', 'Avec une paire servie, on fait un set au flop environ une fois sur 8.', true, 'Vrai : 11,8 %, une fois sur 8,5.'),
      trueFalse('', 'AK touche au moins une paire au flop une fois sur deux.', false, 'Faux : environ une fois sur trois (32 %).'),
      trueFalse('', 'Avec des cartes assorties, la couleur est faite au flop environ une fois sur dix.', false, 'Faux : 0,8 %. C’est le tirage couleur qui arrive ≈ une fois sur dix.'),
      trueFalse('', 'Avec QQ, une overcard tombe au flop presque une fois sur deux.', true, 'Vrai : ≈ 41 %.'),
      trueFalse('', 'Pour du set mining pur, il faut gagner en moyenne au moins 7,5 fois sa mise quand on touche.', true, 'Vrai : 7,5 pertes pour 1 gain sur 8,5 essais.'),
      { ...setMining(pick([2, 2.5, 4])), id: '' },
      { ...setMining(pick([5, 6])), id: '' },
      trueFalse('', 'Une main non appariée manque le flop (aucune paire avec ses cartes) environ deux fois sur trois.', true, 'Vrai : elle touche ≈ 32 % du temps.'),
    ]), 'b6t'),
  },
  fiche: {
    essentiel: [
      'Paire servie : set ou mieux au flop 11,8 % (1 sur 8,5).',
      'Main non appariée : au moins une paire avec ses cartes ≈ 32 %.',
      'Cartes assorties : tirage couleur ≈ 11 %, couleur faite ≈ 0,8 %.',
      'Set mining : gagner en moyenne 7,5 fois la mise quand on touche (calcul exact) ; 15-20 fois est un usage prudent.',
    ],
    blocks: [{ kind: 'table', title: 'Fréquences au flop', head: ['Ta main', 'Au flop', 'Fréquence'], widths: [55, 85, 40], rows: [
      ['Paire servie', 'Set ou mieux', '11,8 %'], ['Deux cartes différentes', 'Au moins une paire', '32 %'], ['Assorties', 'Tirage couleur', '10,9 %'],
      ['Assorties', 'Couleur faite', '0,8 %'], ['QQ', 'Un as ou un roi', '41 %'],
    ] }],
    pieges: ['Payer cher « pour le set » sans regarder ce que l’on gagnera quand il tombe.', 'Croire qu’une main assortie fait souvent couleur.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// B7 · Les duels postflop
// ════════════════════════════════════════════════════════════════════════════

const POST_DUELS: [string, string, string, string][] = [
  ['7c 7h', 'As Ad', 'Ks 7d 2c', 'Set contre overpair : ≈ 91/9.'],
  ['6h 5h', 'Ks Qd', 'Kh 8h 3c', 'Tirage couleur contre top pair : ≈ 40/60.'],
  ['6s 5s', 'Ac Kc', 'Kd 8c 7h', 'OESD contre TPTK : ≈ 32/68.'],
  ['Jh Th', 'As Ad', '9h 8h 2c', 'Combo draw contre overpair : le tirage est favori, ≈ 56/44.'],
  ['As Kd', 'Qc Jh', 'Qd 7s 2c', 'Deux overcards contre une paire : ≈ 23/77 (6 outs).'],
  ['8s 8c', 'Ah Kh', '8h 5h 2c', 'Set contre tirage couleur max + overcards : ≈ 74/26.'],
  ['Ah 5h', 'Ks Qd', 'Kh 8h 3c', 'NFD avec une overcard contre top pair : ≈ 46/54.'],
  ['Qh Qc', 'Jd Td', 'Js 9d 2c', 'Overpair contre top pair : ≈ 77/23.'],
  ['Kh Kd', 'Ah Qh', 'Qs 8h 3h', 'Overpair contre top pair + tirage couleur max : ≈ 51/49, un vrai coin flip.'],
  ['Td 9d', '6s 6c', '8d 7c 2s', 'OESD + deux overcards contre une petite paire : ≈ 46/54.'],
];

const B7: Lesson = {
  id: 107, code: 'B7', parcours: 'exploration', module: M,
  title: 'Les duels postflop',
  objective: 'Savoir quand un tirage est favori, et ce que valent deux overcards.',
  defi: {
    intro: <p>Tout le monde est à tapis au flop. Choisis la main favorite, puis la simulation distribue la turn et la river des milliers de fois.</p>,
    items: () => POST_DUELS.slice(0, 6).map(([a, b, bd, ins], i) => duelItem(`b7-${i + 1}`, a, b, ins, ins, bd)),
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Duel au flop</th><th className="r">Équité</th></tr></thead>
          <tbody>
            <tr><td>Set contre overpair</td><td className="r">≈ 91/9</td></tr>
            <tr><td>Set contre tirage couleur max + overcards</td><td className="r">≈ 74/26</td></tr>
            <tr><td>Combo draw (15 outs) contre overpair</td><td className="r">≈ 56/44, le tirage est favori</td></tr>
            <tr><td>Top pair + tirage couleur max contre overpair</td><td className="r">≈ 49/51</td></tr>
            <tr><td>Overpair contre top pair</td><td className="r">≈ 77/23</td></tr>
            <tr><td>NFD avec une overcard contre top pair</td><td className="r">≈ 46/54</td></tr>
            <tr><td>Tirage couleur contre top pair</td><td className="r">≈ 40/60</td></tr>
            <tr><td>OESD contre top pair</td><td className="r">≈ 32/68</td></tr>
            <tr><td>Deux overcards contre une paire</td><td className="r">≈ 23/77</td></tr>
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Un gros tirage (≈ 15 outs) est <strong>favori</strong> face à une paire, même une overpair.</li>
            <li>Un tirage couleur seul vaut ≈ 35-40 % à tapis au flop ; une overcard en plus le rapproche du 50/50.</li>
            <li>Deux overcards ≈ 6 outs ≈ une chance sur quatre.</li>
          </ul>
        </div>
        <p className="muted small"><T k="x-equity">Equity</T> calculée par simulation (150 000 turns et rivers par duel).</p>
      </div>
    ),
  },
  training: { items: () => withIds(sample(POST_DUELS, 7).map(([a, b, bd, ins]) => (Math.random() < 0.5 ? duelItem('', a, b, undefined, ins, bd) : duelItem('', b, a, undefined, ins, bd))), 'b7t') },
  fiche: {
    essentiel: [
      'Set contre overpair : ≈ 91/9.',
      'Combo draw (≈ 15 outs) contre une paire : le tirage est favori.',
      'Tirage couleur seul : ≈ 35-40 % ; avec une overcard, proche de 50/50.',
      'OESD : ≈ 32 % ; deux overcards (6 outs) : ≈ 23 %.',
    ],
    blocks: [{ kind: 'table', title: 'Duels à tapis au flop', head: ['Duel', 'Équité'], widths: [120, 60], rows: [
      ['Set contre overpair', '≈ 91/9'], ['Set contre NFD + overcards', '≈ 74/26'], ['Combo draw contre overpair', '≈ 56/44'],
      ['NFD + overcard contre top pair', '≈ 46/54'], ['Tirage couleur contre top pair', '≈ 40/60'], ['OESD contre top pair', '≈ 32/68'], ['Deux overcards contre une paire', '≈ 23/77'],
    ] }],
    pieges: ['Se coucher automatiquement avec un combo draw face à une mise : il est souvent favori.', 'Compter les overcards comme des outs « propres » quand le board est dangereux.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// B8 · Les combos et les bloqueurs
// ════════════════════════════════════════════════════════════════════════════

function comboItem(id: string, code: string, dead: Card[], prompt: React.ReactNode, insight?: string, scene?: React.ReactNode): NumberItem {
  const n = combosOf(code, dead).length;
  return { kind: 'number', id, prompt, scene, answer: n, unit: 'combos', insight, feedback: <ComboList code={code} dead={dead} /> };
}

function randomComboItem(id: string): NumberItem {
  for (;;) {
    const d = draw(5);
    const hole = d.slice(0, 2), board = d.slice(2);
    const dead = [...hole, ...board];
    const kind = pick(['set', 'unpaired', 'pair']);
    let code: string;
    if (kind === 'set') code = pick(board)[0].repeat(2);
    else if (kind === 'pair') { const r = pick([...RANK_CHARS].filter(x => !board.some(c => c[0] === x))); code = r + r; }
    else {
      const [x, y] = [pick([...hole, ...board])[0], pick([...RANK_CHARS])];
      if (x === y) continue;
      code = rankOf(x + 's') > rankOf(y + 's') ? x + y : y + x;
    }
    // notation VO des ranges : TT, T6, AK…
    const what = kind === 'set' ? <>de <strong>set de {rankLabel(code[0])}</strong> ({code})</> : <>de <strong>{code}</strong>{code[0] !== code[1] ? ' (assortis et dépareillés)' : ''}</>;
    return comboItem(id, code, dead, <>Tu as <Inline cs={hole.join(' ')} />. Combien de combos {what} ton adversaire peut-il avoir ?</>, undefined, <CardRow cs={board} />);
  }
}

/** Exemple de la fiche, compté par le moteur : A♠K♦ sur K♣7♦2♥. */
const B8_EXAMPLE: [string, string][] = [['AA', 'AA'], ['KK', 'KK (set)'], ['77', '77 (set)'], ['AK', 'AK'], ['72', '72 (deux paires)']];

const B8: Lesson = {
  id: 108, code: 'B8', parcours: 'exploration', module: M,
  title: 'Les combos et les bloqueurs',
  objective: 'Compter les combos d’une main, et l’effet de tes cartes (blockers).',
  defi: {
    intro: <p>Une main comme « AK » n’est pas une seule main : c’est un ensemble de combos de cartes. Combien y en a-t-il ? Et que changent tes propres cartes ?</p>,
    items: () => [
      comboItem('b8-1', 'AK', [], 'Combien de combos différents de AK existe-t-il (assortis et dépareillés) ?', 'Une main non appariée = 4 × 4 = 16 combos.'),
      comboItem('b8-2', 'AKs', [], 'Et de AK assortis (AKs) ?', 'Assortie : 4 combos ; dépareillée : 12.'),
      comboItem('b8-3', 'AA', [], 'Combien de combos de AA ?', 'Une paire : 6 combos (choisir 2 as parmi 4).'),
      comboItem('b8-4', 'AA', cards('As Kd'), <>Tu as <Inline cs="As Kd" />. Combien de combos de AA reste-t-il à ton adversaire ?</>, 'Tenir un as divise par deux les AA possibles (6 → 3) : c’est un blocker.'),
      comboItem('b8-5', 'AK', cards('As Kd'), <>Toujours avec <Inline cs="As Kd" />, combien de combos de AK ?</>, 'Il reste 3 as et 3 rois : 3 × 3 = 9 combos de AK.'),
      comboItem('b8-6', 'KK', cards('As Kd Kc 7d 2h'), <>Tu as <Inline cs="As Kd" /> sur le flop <Inline cs="Kc 7d 2h" />. Combien de combos de set de rois ?</>, 'Il ne reste que deux rois (K♥, K♠) : un seul combo de set de rois.', <CardRow cs="Kc 7d 2h" />),
      comboItem('b8-7', '77', cards('As Kd Kc 7d 2h'), 'Et de set de 7 (77) ?', 'Il reste trois 7 : 3 combos de set.'),
      comboItem('b8-8', 'AK', cards('As Kd Kc 7d 2h'), 'Et de AK ?', 'Trois as et deux rois restants : 3 × 2 = 6 combos.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Main</th><th className="r">Combos</th></tr></thead>
          <tbody>
            <tr><td>Paire (AA)</td><td className="r">6</td></tr>
            <tr><td>Assortie (AKs)</td><td className="r">4</td></tr>
            <tr><td>Dépareillée (AKo)</td><td className="r">12</td></tr>
            <tr><td>Non appariée (AK)</td><td className="r">16</td></tr>
            <tr><td>Toutes les mains</td><td className="r">1 326</td></tr>
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>Compter avec les <T k="x-blocker">blockers</T></h3>
          <p>On compte les cartes encore disponibles de chaque valeur, en retirant les tiennes et celles du board :</p>
          <ul>
            <li>non appariée : cartes restantes de la 1re valeur × cartes restantes de la 2e ;</li>
            <li>paire : n × (n − 1) ÷ 2 avec n cartes restantes (4 → 6, 3 → 3, 2 → 1).</li>
          </ul>
        </div>
        <ComboList code="AK" dead={cards('As Kd Kc')} />
        <p className="muted small">Les <T k="x-combo-n">combos</T> sont la base de la lecture de ranges : la leçon C9 s’en sert.</p>
      </div>
    ),
  },
  training: { items: () => Array.from({ length: 8 }, (_, i) => randomComboItem(`b8t${i}`)) },
  fiche: {
    essentiel: [
      'Paire : 6 combos ; assortie : 4 ; dépareillée : 12 ; non appariée : 16 ; total 1 326.',
      'Non appariée : (cartes restantes de la 1re valeur) × (cartes restantes de la 2e).',
      'Paire : n × (n − 1) ÷ 2 avec n cartes restantes : 4 → 6, 3 → 3, 2 → 1.',
      'Tes cartes et le board retirent des combos à l’adversaire : ce sont des blockers.',
    ],
    blocks: [
      { kind: 'cards', title: 'Exemple', rows: [{ label: 'Ta main', cards: 'As Kd' }, { label: 'Le flop', cards: 'Kc 7d 2h' }] },
      { kind: 'table', title: 'Combos restants pour l’adversaire', head: ['Main adverse', 'Combos'], rows: B8_EXAMPLE.map(([c, l]) => [l, String(combosOf(c, cards('As Kd Kc 7d 2h')).length)]) },
    ],
    pieges: ['Compter 16 combos de AK alors qu’on tient un as.', 'Oublier les cartes du board dans le décompte.'],
  },
};

export const LESSONS_B = [B5, B6, B7, B8];
