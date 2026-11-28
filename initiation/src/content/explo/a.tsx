/** Exploration · Module A · Parler poker (leçons A1 à A4). */
import { useState } from 'react';
import type { ChoiceItem, Item, Lesson, MultiItem, SeatItem } from '../types';
import { CardRow, Inline } from '../../components/Cards';
import { PokerTable } from '../../components/PokerTable';
import { T } from '../../components/Term';
import { Narr, Scene, sample, withIds } from '../helpers';
import { type Card, draw, pick, randInt, rankOf, shuffle } from '../../lib/cards';
import { Le, SEAT_GROUP, au, boardTexture, draws, duP, le, madeHand, postflopOrder, seatName, seatOfName, seatOrder } from '../../lib/theory';

const M = 11; // module A

// ════════════════════════════════════════════════════════════════════════════
// A1 · Les places (seats)
// ════════════════════════════════════════════════════════════════════════════

const tableLabels = (n: number, button: number) => [...Array(n).keys()].map(s => seatName(s, button, n));

function SeatTour({ done }: { done: (a: { correct: null; answer: string }) => void }) {
  const sizes = [9, 8, 7, 6];
  const [i, setI] = useState(0);
  const n = sizes[i];
  return (
    <div className="stack">
      <div className="row between"><strong>Table à {n} joueurs</strong><span className="muted small">Ordre de parole : {seatOrder(n).join(' → ')}</span></div>
      <PokerTable spec={{ n, button: 0, labels: tableLabels(n, 0), showBlinds: true }} />
      {i < sizes.length - 1
        ? <button className="btn" onClick={() => setI(i + 1)}>Table à {sizes[i + 1]} joueurs →</button>
        : <button className="btn primary" onClick={() => done({ correct: null, answer: 'tables observées' })}>J’ai repéré la logique</button>}
    </div>
  );
}

function tapSeatItem(id: string, n: number, names: string[], prompt?: string): SeatItem {
  const b = randInt(0, n - 1);
  return {
    kind: 'seats', id,
    prompt: prompt ?? <>Table à {n} joueurs. Touche {names.length > 1 ? 'dans l’ordre les places' : 'la place'} <strong>{names.join(', ')}</strong>.</>,
    table: { n, button: b, labels: Array(n).fill('?'), showBlinds: true },
    tokens: names, solution: names.map(nm => seatOfName(nm, b, n)),
    feedback: `À ${n} joueurs, dans l’ordre de parole : ${seatOrder(n).join(', ')}.`,
  };
}

function ipItem(id: string): ChoiceItem {
  const n = pick([6, 8, 9]);
  const order = postflopOrder(n);
  const [x, y] = sample(order, 2);
  const later = order.indexOf(x) > order.indexOf(y) ? x : y;
  return {
    kind: 'choice', id, prompt: <>Au flop, <strong>{x}</strong> contre <strong>{y}</strong> (table à {n}) : qui est <T k="x-ip">IP</T> ?</>,
    options: [x, y], columns: 2, answer: later === x ? 0 : 1,
    feedback: `Après le flop, l’ordre de parole est ${order.join(', ')} : ${later} parle après, il est IP.`,
  };
}

function groupItem(id: string): ChoiceItem {
  const s = pick(seatOrder(9));
  const opts = ['EP', 'MP', 'LP', 'Blinds'];
  return { kind: 'choice', id, prompt: <>À quel groupe appartient <strong>{s}</strong> ?</>, options: opts, columns: 2, answer: opts.indexOf(SEAT_GROUP[s]), feedback: `${s} : ${SEAT_GROUP[s]}. EP = UTG, UTG+1, UTG+2 · MP = LJ, HJ · LP = CO, BTN · Blinds = SB, BB.` };
}

const A1: Lesson = {
  id: 101, code: 'A1', parcours: 'exploration', module: M,
  title: 'Les places (seats)',
  objective: 'Nommer chaque siège comme à la table : UTG, LJ, HJ, CO, BTN…',
  defi: {
    intro: <p>Les joueurs ne disent jamais « troisième à parler » : ils disent « le HJ ». Observe comment les places se nomment selon la taille de la table, puis place-les toi-même.</p>,
    items: () => [
      { kind: 'custom', id: 'a1-1', prompt: 'Quatre tables, de 9 à 6 joueurs. Repère ce qui ne change jamais.', render: done => <SeatTour done={done} />, insight: 'UTG parle toujours en premier ; CO, HJ et LJ sont toujours les trois places juste avant le bouton.' },
      tapSeatItem('a1-2', 8, ['LJ', 'HJ', 'CO']),
      tapSeatItem('a1-3', 9, ['UTG', 'UTG+1', 'UTG+2']),
      {
        kind: 'choice', id: 'a1-4', prompt: 'Quand on passe de 7 à 6 joueurs, quelle place disparaît ?',
        options: ['LJ', 'HJ', 'UTG'], columns: 3, answer: 0,
        insight: 'Quand la table rétrécit, on retire UTG+2, puis UTG+1, puis LJ : UTG, HJ, CO, BTN et les blindes restent.',
        feedback: 'À 6 joueurs : UTG, HJ, CO, BTN, SB, BB. Le LJ a disparu.',
      },
      {
        kind: 'choice', id: 'a1-5', prompt: <>Au flop, le HJ contre la BB : qui est <strong>IP</strong> (in position) ?</>,
        options: ['HJ', 'BB'], columns: 2, answer: 0,
        insight: 'IP (in position) : parler après l’adversaire après le flop. Les blindes sont presque toujours OOP.',
        feedback: 'Après le flop, les blindes parlent en premier : le HJ parle après la BB, il est IP.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>La règle des noms</h3>
          <ul>
            <li><T k="x-utg">UTG</T> parle <strong>toujours en premier</strong> préflop.</li>
            <li><T k="x-co">CO</T>, <T k="x-hj">HJ</T> et <T k="x-lj">LJ</T> sont <strong>toujours</strong> les trois places juste avant le bouton.</li>
            <li>UTG+1 puis UTG+2 s’intercalent quand la table s’agrandit.</li>
          </ul>
        </div>
        <table className="tbl">
          <thead><tr><th>Joueurs</th><th>Ordre de parole préflop</th></tr></thead>
          <tbody>{[9, 8, 7, 6].map(n => <tr key={n}><td>{n}</td><td>{seatOrder(n).join(' · ')}</td></tr>)}</tbody>
        </table>
        <table className="tbl">
          <thead><tr><th>Groupe</th><th>Places</th></tr></thead>
          <tbody>
            <tr><td><T k="x-groups">EP</T> (early)</td><td>UTG, UTG+1, UTG+2</td></tr>
            <tr><td>MP (middle)</td><td>LJ, HJ</td></tr>
            <tr><td>LP (late)</td><td>CO, BTN</td></tr>
            <tr><td>Blinds</td><td>SB, BB</td></tr>
          </tbody>
        </table>
        <p className="muted small"><T k="x-ip">IP</T> (in position) : parler après l’adversaire au flop, à la turn et à la river. <T k="x-oop">OOP</T> (out of position) : parler avant. Le BTN est toujours IP après le flop.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      ((n: number) => tapSeatItem('', n, [pick(['LJ', 'HJ', 'CO'].filter(x => seatOrder(n).includes(x)))]))(pick([6, 7, 8, 9])),
      tapSeatItem('', pick([8, 9]), [pick(['UTG+1', 'LJ', 'HJ'])]),
      tapSeatItem('', 6, ['UTG']),
      ipItem(''), ipItem(''), ipItem(''),
      groupItem(''), groupItem(''),
    ]), 'a1t'),
  },
  fiche: {
    essentiel: [
      'UTG parle toujours en premier ; CO, HJ et LJ sont toujours les trois places avant le bouton.',
      'UTG+1 et UTG+2 s’ajoutent quand la table grandit ; on les retire en premier quand elle rétrécit.',
      'Groupes : EP (UTG…), MP (LJ, HJ), LP (CO, BTN), Blinds (SB, BB).',
      'IP = parler après l’adversaire après le flop ; OOP = parler avant.',
    ],
    blocks: [{ kind: 'table', title: 'Les places selon la taille de la table', head: ['Joueurs', 'Ordre de parole préflop'], widths: [25, 155], rows: [9, 8, 7, 6].map(n => [String(n), seatOrder(n).join(' · ')]) }],
    pieges: ['Appeler « MP » n’importe quelle place du milieu : à 8 joueurs, ce sont le LJ et le HJ.', 'Croire que la SB est en position : après le flop, les blindes parlent en premier.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// A2 · Les actions préflop
// ════════════════════════════════════════════════════════════════════════════

const PRE_ACTIONS = ['Open (RFI)', 'Limp', 'Iso-raise', 'Cold call', '3-bet', '4-bet', 'Squeeze', 'Steal', 'Resteal', 'Open-shove', 'Jam (re-shove)', 'Flat'];

type Step = [string, string];
interface Seq { steps: Step[]; answer: string; exclude?: string[]; why: string }

/** Séquences préflop à 8 joueurs ; la dernière action est celle à nommer. */
function preflopSeq(kind: string): Seq {
  const order = seatOrder(8);
  const early = ['UTG', 'UTG+1', 'LJ', 'HJ'];
  const idx = (s: string) => order.indexOf(s);
  const folds = (from: number, to: number): Step[] => order.slice(from, to).map(s => [s, 'fold'] as Step);
  const after = (s: string, k = 1) => order.slice(idx(s) + 1, idx(s) + 1 + k);
  switch (kind) {
    case 'open': { const s = pick(early); return { steps: [...folds(0, idx(s)), [s, 'relance à 2,5 BB']], answer: 'Open (RFI)', exclude: ['Steal'], why: `Tout le monde s’est couché jusqu’${au(s)}, qui est le premier à relancer : c’est un open (raise first in).` }; }
    case 'limp': { const s = pick(early); return { steps: [...folds(0, idx(s)), [s, 'suit 1 BB']], answer: 'Limp', why: `${Le(s)} entre en payant seulement la grosse blinde : il limpe.` }; }
    case 'iso': { const s = pick(['UTG', 'UTG+1']); const r = pick(after(s, 4).filter(x => x !== 'SB' && x !== 'BB')); return { steps: [...folds(0, idx(s)), [s, 'suit 1 BB'], ...folds(idx(s) + 1, idx(r)), [r, 'relance à 4 BB']], answer: 'Iso-raise', why: `${Le(r)} relance après un limper pour l’isoler : c’est un iso-raise.` }; }
    case 'cold': { const s = pick(['UTG', 'LJ']); const c = pick(['HJ', 'CO', 'BTN'].filter(x => idx(x) > idx(s))); return { steps: [...folds(0, idx(s)), [s, 'relance à 2,5 BB'], ...folds(idx(s) + 1, idx(c)), [c, 'suit 2,5 BB']], answer: 'Cold call', exclude: ['Flat'], why: `${Le(c)} paie une relance sans avoir rien investi auparavant : c’est un cold call.` }; }
    case '3bet': { const s = pick(['UTG', 'LJ', 'HJ']); const r = pick(['CO', 'BTN'].filter(x => idx(x) > idx(s))); return { steps: [...folds(0, idx(s)), [s, 'relance à 2,5 BB'], ...folds(idx(s) + 1, idx(r)), [r, 'relance à 8 BB']], answer: '3-bet', exclude: ['Resteal'], why: `${Le(r)} relance un open : c’est la 3e mise (BB, open, relance), un 3-bet.` }; }
    case '4bet': return { steps: [...folds(0, idx('HJ')), ['HJ', 'relance à 2,5 BB'], ['CO', 'relance à 8 BB'], ['BTN', 'fold'], ['SB', 'fold'], ['BB', 'fold'], ['HJ', 'relance à 20 BB']], answer: '4-bet', why: 'Le HJ relance le 3-bet du CO : c’est la 4e mise, un 4-bet.' };
    case 'squeeze': { const s = pick(['UTG', 'LJ']); return { steps: [...folds(0, idx(s)), [s, 'relance à 2,5 BB'], ...folds(idx(s) + 1, idx('CO')), ['CO', 'suit 2,5 BB'], ['BTN', 'relance à 11 BB']], answer: 'Squeeze', exclude: ['3-bet'], why: 'Le BTN relance après un open ET un call : il « presse » les deux joueurs, c’est un squeeze.' }; }
    case 'steal': { const s = pick(['CO', 'BTN', 'SB']); return { steps: [...folds(0, idx(s)), [s, 'relance à 2,5 BB']], answer: 'Steal', exclude: ['Open (RFI)'], why: `Un open depuis ${le(s)}, quand tout le monde s’est couché, vise d’abord les blindes : c’est un steal.` }; }
    case 'resteal': return { steps: [...folds(0, idx('BTN')), ['BTN', 'relance à 2,2 BB'], ['SB', 'fold'], ['BB', 'fait tapis (18 BB)']], answer: 'Resteal', exclude: ['3-bet', 'Jam (re-shove)'], why: 'La BB contre-attaque le steal du bouton en relançant (ici à tapis) : c’est un resteal.' };
    case 'openshove': { const s = pick(['HJ', 'CO', 'BTN']); return { steps: [...folds(0, idx(s)), [s, 'fait tapis (9 BB)']], answer: 'Open-shove', exclude: ['Jam (re-shove)', 'Steal'], why: `${Le(s)} est le premier à entrer, directement à tapis : c’est un open-shove.` }; }
    case 'jam': return { steps: [...folds(0, idx('LJ')), ['LJ', 'relance à 2,2 BB'], ['HJ', 'fold'], ['CO', 'fait tapis (14 BB)']], answer: 'Jam (re-shove)', exclude: ['3-bet', 'Open-shove', 'Resteal'], why: 'Le CO relance l’open à tapis : c’est un re-shove (jam).' };
    default: return { steps: [...folds(0, idx('CO')), ['CO', 'relance à 2,5 BB'], ['BTN', 'fold'], ['SB', 'relance à 9 BB'], ['BB', 'fold'], ['CO', 'suit']], answer: 'Flat', exclude: ['Cold call'], why: 'Le CO, déjà engagé, se contente de suivre le 3-bet au lieu de relancer : il « flat ».' };
  }
}

function seqItem(id: string, kind: string, insight?: string): ChoiceItem {
  const s = preflopSeq(kind);
  const pool = PRE_ACTIONS.filter(a => a !== s.answer && !(s.exclude ?? []).includes(a));
  const opts = shuffle([s.answer, ...sample(pool, 3)]);
  // les folds consécutifs sont regroupés sur une ligne
  const lines: { who: string; act: string }[] = [];
  for (const [p, act] of s.steps) {
    const prev = lines[lines.length - 1];
    if (act === 'fold' && prev && prev.act === 'fold') prev.who += `, ${p}`;
    else lines.push({ who: p, act });
  }
  const last = s.steps[s.steps.length - 1][0];
  return {
    kind: 'choice', id,
    prompt: <>Comment appelle-t-on l’action {duP(last)}<strong>{last}</strong> ?</>,
    scene: <Narr lines={lines.map((l, i) => <span key={i} style={{ opacity: l.act === 'fold' ? 0.55 : 1, fontWeight: i === lines.length - 1 ? 800 : 400 }}>{l.who} : {l.act}</span>)} />,
    options: opts, columns: 2, answer: opts.indexOf(s.answer), insight, feedback: s.why,
  };
}

const BVB: ChoiceItem = {
  kind: 'choice', id: '', prompt: 'Tout le monde se couche jusqu’à la SB, qui relance ; la BB suit. Comment appelle-t-on ce type de coup ?',
  options: ['BvB', 'Squeeze', 'Heads-up final', 'Steal raté'], columns: 2, answer: 0,
  feedback: 'Blind versus blind : un coup joué entre les deux blindes.',
};

const A2: Lesson = {
  id: 102, code: 'A2', parcours: 'exploration', module: M,
  title: 'Les actions préflop',
  objective: 'Nommer open, iso, 3-bet, squeeze, steal, resteal, jam…',
  defi: {
    intro: <p>Huit séquences préflop, comme on les raconte à la table. Pour chacune, nomme la dernière action. Tu ne connais pas tous les mots ? Devine grâce au contexte.</p>,
    items: () => [
      seqItem('a2-1', 'open', 'Open (RFI, raise first in) : être le premier à relancer.'),
      seqItem('a2-2', 'limp', 'Limp : entrer en payant seulement la grosse blinde.'),
      seqItem('a2-3', 'iso', 'Iso-raise : relancer après un limper pour jouer contre lui seul.'),
      seqItem('a2-4', 'cold', 'Cold call : payer une relance sans avoir rien investi avant.'),
      seqItem('a2-5', '3bet', '3-bet : la relance d’un open (BB = 1re mise, open = 2e).'),
      seqItem('a2-6', 'squeeze', 'Squeeze : un 3-bet face à un open ET au moins un call.'),
      seqItem('a2-7', '4bet', '4-bet : la relance d’un 3-bet.'),
      seqItem('a2-8', 'jam', 'Jam (re-shove) : relancer à tapis face à un open.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box">
          <h3>L’échelle des relances</h3>
          <p>La grosse blinde est la <strong>1re mise</strong>, l’open la <strong>2e</strong>, puis viennent le <T k="x-3bet">3-bet</T>, le <T k="x-4bet">4-bet</T>, le 5-bet… C’est pour ça que la première relance d’un open s’appelle « 3-bet ».</p>
        </div>
        <table className="tbl">
          <thead><tr><th>Terme</th><th>Ce que c’est</th></tr></thead>
          <tbody>
            <tr><td><T k="x-rfi">Open (RFI)</T></td><td>Premier à relancer</td></tr>
            <tr><td><T k="x-limp">Limp</T></td><td>Payer seulement la BB</td></tr>
            <tr><td><T k="x-iso">Iso-raise</T></td><td>Relancer après des limpers</td></tr>
            <tr><td><T k="x-coldcall">Cold call</T></td><td>Payer une relance sans avoir rien investi</td></tr>
            <tr><td><T k="x-flat">Flat</T></td><td>Suivre au lieu de relancer (ex. face à un 3-bet)</td></tr>
            <tr><td><T k="x-squeeze">Squeeze</T></td><td>3-bet après un open et un call</td></tr>
            <tr><td><T k="x-steal">Steal</T> / <T k="x-resteal">resteal</T></td><td>Open en fin de parole pour les blindes / 3-bet des blindes en réponse</td></tr>
            <tr><td><T k="x-openshove">Open-shove</T> / <T k="x-jam">jam</T></td><td>Ouvrir à tapis / relancer à tapis</td></tr>
            <tr><td><T k="x-bvb">BvB</T></td><td>Coup entre les deux blindes</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      ...['open', 'limp', 'iso', 'cold', '3bet', '4bet', 'squeeze', 'steal', 'resteal', 'openshove', 'jam', 'flat'].map(k => seqItem('', k)).slice(0, 12),
    ]).slice(0, 9).concat([BVB]), 'a2t'),
  },
  fiche: {
    essentiel: [
      'BB = 1re mise, open = 2e : la relance d’un open s’appelle donc un 3-bet.',
      'Squeeze = 3-bet face à un open et au moins un call.',
      'Steal = open depuis CO, BTN ou SB ; resteal = 3-bet des blindes face à un steal.',
      'Cold call = payer une relance sans avoir rien investi ; flat = suivre au lieu de relancer.',
    ],
    blocks: [{
      kind: 'table', title: 'Le vocabulaire préflop', head: ['Terme', 'Exemple'], widths: [40, 140],
      rows: [
        ['Open (RFI)', 'Tout le monde se couche, le HJ relance à 2,5 BB'], ['Limp', 'UTG paie seulement 1 BB'], ['Iso-raise', 'UTG limpe, le CO relance à 4 BB'],
        ['Cold call', 'UTG ouvre, le BTN paie 2,5 BB'], ['3-bet', 'LJ ouvre, le CO relance à 8 BB'], ['Squeeze', 'UTG ouvre, CO suit, BTN relance à 11 BB'],
        ['4-bet', 'HJ ouvre, CO 3-bet, HJ relance à 20 BB'], ['Steal / resteal', 'BTN ouvre ; la BB fait tapis en réponse'], ['Open-shove', 'Le CO entre directement à tapis'],
        ['Jam (re-shove)', 'LJ ouvre, le CO relance à tapis'], ['Flat', 'Le CO se contente de suivre le 3-bet de la SB'], ['BvB', 'La SB relance, la BB suit'],
      ],
    }],
    pieges: ['Appeler « 2-bet » la relance d’un open : c’est un 3-bet.', 'Confondre squeeze et simple 3-bet : il faut au moins un call entre l’open et la relance.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// A3 · Les actions postflop
// ════════════════════════════════════════════════════════════════════════════

const POST_ACTIONS = ['C-bet', 'Donk bet', 'Check-raise', 'Float', 'Delayed c-bet', 'Probe bet', 'Triple barrel', 'Double barrel', 'Overbet', 'Block bet', 'Check-back', 'Slowplay', 'Thin value', 'Bluff catcher'];

const POST_BANK: { lines: string[]; q: string; answer: string; why: string; insight: string }[] = [
  { lines: ['Préflop : le CO relance, la BB suit.', 'Flop : la BB checke, le CO mise 1/3 du pot.'], q: 'L’action du CO ?', answer: 'C-bet', why: 'Le relanceur préflop continue au flop : mise de continuation.', insight: 'C-bet : le relanceur préflop mise au flop.' },
  { lines: ['Préflop : le CO relance, la BB suit.', 'Flop : la BB mise tout de suite, avant que le CO ait parlé.'], q: 'L’action de la BB ?', answer: 'Donk bet', why: 'Le joueur hors de position mise « dans » l’agresseur préflop : donk bet.', insight: 'Donk bet : le joueur OOP mise avant l’agresseur du tour précédent.' },
  { lines: ['Flop : la BB checke, le BTN mise, la BB relance.'], q: 'L’action de la BB ?', answer: 'Check-raise', why: 'Checker puis relancer la mise adverse : check-raise.', insight: 'Check-raise : checker, puis relancer quand l’adversaire mise.' },
  { lines: ['Flop : la BB mise, le BTN (en position) suit avec une main faible, en comptant reprendre le pot plus tard.'], q: 'L’action du BTN ?', answer: 'Float', why: 'Suivre en position pour attaquer plus tard : float.', insight: 'Float : suivre en position avec l’idée de prendre le pot sur un tour suivant.' },
  { lines: ['Préflop : le BTN relance, la BB suit.', 'Flop : check, check.', 'Turn : la BB checke, le BTN mise.'], q: 'L’action du BTN à la turn ?', answer: 'Delayed c-bet', why: 'Le relanceur préflop saute le flop et mise à la turn : c-bet retardé.', insight: 'Delayed c-bet : le relanceur checke le flop puis mise la turn.' },
  { lines: ['Préflop : le BTN relance, la BB suit.', 'Flop : check, check.', 'Turn : la BB mise en premier.'], q: 'L’action de la BB à la turn ?', answer: 'Probe bet', why: 'Le relanceur a checké derrière au flop, le joueur OOP mise la turn : probe bet.', insight: 'Probe bet : mise OOP à la turn après un check-back du relanceur au flop.' },
  { lines: ['Le relanceur préflop mise au flop, mise à la turn, mise à la river.'], q: 'On dit qu’il fait un…', answer: 'Triple barrel', why: 'Trois mises sur trois tours : triple barrel.', insight: 'Double barrel : flop + turn ; triple barrel : flop + turn + river.' },
  { lines: ['Le relanceur préflop mise au flop et à la turn, puis checke la river.'], q: 'Au flop et à la turn, il a fait un…', answer: 'Double barrel', why: 'Deux mises successives : double barrel.', insight: 'Barrel : continuer à miser tour après tour.' },
  { lines: ['River : le pot fait 40 BB, le joueur mise 60 BB.'], q: 'Cette mise est un…', answer: 'Overbet', why: 'Une mise plus grosse que le pot : overbet.', insight: 'Overbet : miser plus que le pot.' },
  { lines: ['River, hors de position : le joueur mise 1/4 du pot avec une main moyenne, pour fixer lui-même le prix.'], q: 'Cette mise est un…', answer: 'Block bet', why: 'Petite mise OOP pour éviter de payer une mise plus grosse : block bet.', insight: 'Block bet : petite mise OOP pour fixer le prix.' },
  { lines: ['Turn : la BB checke, le BTN checke aussi.'], q: 'L’action du BTN ?', answer: 'Check-back', why: 'En position, checker après un check : check-back.', insight: 'Check-back : checker derrière en position.' },
  { lines: ['Flop : le joueur touche un set et se contente de checker et de suivre pour cacher sa force.'], q: 'Il fait du…', answer: 'Slowplay', why: 'Jouer passivement une main très forte : slowplay.', insight: 'Slowplay : jouer lentement une main très forte.' },
  { lines: ['River : le joueur mise une paire moyenne en espérant être payé par une paire plus faible.'], q: 'C’est une mise de…', answer: 'Thin value', why: 'Une valeur « fine » : sa main n’est qu’un peu devant les mains qui paient.', insight: 'Thin value : valeur avec une main juste devant les mains qui paient.' },
  { lines: ['River : ta main ne bat que les bluffs de l’adversaire, et perd contre toutes ses mises de valeur.'], q: 'Ta main est un…', answer: 'Bluff catcher', why: 'Elle ne sert qu’à attraper les bluffs : bluff catcher.', insight: 'Bluff catcher : main qui ne bat que les bluffs.' },
];

function postItem(id: string, x: typeof POST_BANK[number], withInsight: boolean): ChoiceItem {
  const opts = shuffle([x.answer, ...sample(POST_ACTIONS.filter(a => a !== x.answer && !(x.answer.includes('barrel') && a.includes('barrel'))), 3)]);
  return { kind: 'choice', id, prompt: x.q, scene: <Narr lines={x.lines} />, options: opts, columns: 2, answer: opts.indexOf(x.answer), feedback: x.why, insight: withInsight ? x.insight : undefined };
}

const A3: Lesson = {
  id: 103, code: 'A3', parcours: 'exploration', module: M,
  title: 'Les actions postflop',
  objective: 'Distinguer c-bet, donk, probe, float, barrel, overbet, block bet…',
  defi: {
    intro: <p>Des moments de mains, du flop à la river. Pour chacun, nomme l’action : le contexte (qui a relancé préflop, qui parle en premier) suffit souvent à deviner.</p>,
    items: () => POST_BANK.slice(0, 10).map((x, i) => postItem(`a3-${i + 1}`, x, true)),
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Terme</th><th>Qui</th><th>Quand</th></tr></thead>
          <tbody>
            <tr><td><T k="x-cbet">C-bet</T></td><td>Le relanceur préflop</td><td>Flop</td></tr>
            <tr><td><T k="x-delayed">Delayed c-bet</T></td><td>Le relanceur, après avoir checké le flop</td><td>Turn</td></tr>
            <tr><td><T k="x-donk">Donk bet</T></td><td>Le joueur OOP, avant l’agresseur</td><td>Flop, turn…</td></tr>
            <tr><td><T k="x-probe">Probe bet</T></td><td>Le joueur OOP, après un check-back au flop</td><td>Turn</td></tr>
            <tr><td><T k="x-xr">Check-raise</T></td><td>Celui qui a checké</td><td>Tous les tours</td></tr>
            <tr><td><T k="x-float">Float</T></td><td>Le joueur en position qui suit</td><td>Pour attaquer plus tard</td></tr>
            <tr><td><T k="x-barrel">Barrel</T></td><td>L’agresseur qui continue</td><td>Double : flop + turn ; triple : + river</td></tr>
            <tr><td><T k="x-overbet">Overbet</T> / <T k="x-block">block bet</T></td><td>Taille de mise</td><td>Plus que le pot / petite mise OOP</td></tr>
          </tbody>
        </table>
        <p className="muted small">Et aussi : <T k="x-checkback">check-back</T> (checker derrière en position), <T k="x-slowplay">slowplay</T>, <T k="x-thin">thin value</T>, <T k="x-bluffcatcher">bluff catcher</T>.</p>
      </div>
    ),
  },
  training: { items: () => withIds(sample(POST_BANK, 10).map(x => postItem('', x, false)), 'a3t') },
  fiche: {
    essentiel: [
      'C-bet : le relanceur préflop mise au flop ; delayed c-bet : il attend la turn.',
      'Donk bet : le joueur OOP mise avant l’agresseur ; probe bet : il mise la turn après un check-back.',
      'Float : suivre en position pour attaquer plus tard ; barrel : miser tour après tour.',
      'Overbet : plus que le pot ; block bet : petite mise OOP pour fixer le prix.',
    ],
    blocks: [{ kind: 'table', title: 'Qui, quand', head: ['Terme', 'Qui', 'Quand'], widths: [38, 82, 60], rows: [
      ['C-bet', 'Relanceur préflop', 'Flop'], ['Delayed c-bet', 'Relanceur (flop checké)', 'Turn'], ['Donk bet', 'Joueur OOP, avant l’agresseur', 'Flop, turn'],
      ['Probe bet', 'Joueur OOP après un check-back', 'Turn'], ['Check-raise', 'Celui qui a checké', 'Tous les tours'], ['Float', 'Joueur IP qui suit', 'Pour attaquer plus tard'],
      ['Double / triple barrel', 'L’agresseur', 'Flop + turn (+ river)'], ['Overbet', 'Tout joueur', 'Mise > pot'], ['Block bet', 'Joueur OOP', 'Petite mise, souvent river'],
    ] }],
    pieges: ['Appeler « c-bet » la mise d’un joueur qui n’a pas relancé préflop.', 'Confondre donk bet (avant l’agresseur) et probe bet (après son check-back).'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// A4 · Mains, tirages et boards
// ════════════════════════════════════════════════════════════════════════════

/** Tirage principal, ou null si la situation est ambiguë (double gutshot…). */
export function drawLabel(hole: Card[], board: Card[]): string | null {
  const d = draws(hole, board);
  const ranks = new Set([...hole, ...board].map(rankOf));
  if (ranks.has(12)) ranks.add(-1);
  // tirage ouvert : 4 rangs consécutifs avec une carte possible de chaque côté
  let open = false;
  for (let lo = 0; lo <= 8; lo++) if ([0, 1, 2, 3].every(k => ranks.has(lo + k))) open = true;
  if (d.straightOuts === 8 && !open) return null; // double gutshot : hors exercice
  if (d.flush && d.straightOuts >= 4) return 'Combo draw';
  if (d.nutFlush) return 'NFD (nut flush draw)';
  if (d.flush) return 'FD (flush draw)';
  if (d.straightOuts === 8) return 'OESD';
  if (d.straightOuts === 4) return 'Gutshot';
  if (d.straightOuts > 0) return null;
  if (d.backdoorFlush) return 'Backdoor flush draw';
  return 'Aucun tirage';
}

const HANDS = ['TPTK', 'Top pair', 'Second pair', 'Bottom pair', 'Overpair', 'Underpair', 'Set', 'Two pair', 'High card'];
const DRAWS = ['Combo draw', 'NFD (nut flush draw)', 'FD (flush draw)', 'OESD', 'Gutshot', 'Backdoor flush draw', 'Aucun tirage'];

function randomFlopDeal() {
  for (;;) {
    const d = draw(5);
    const hole = d.slice(0, 2), board = d.slice(2);
    if (new Set(board.map(rankOf)).size < 3) continue; // boards pairés exclus
    return { hole, board };
  }
}
function handItem(id: string): ChoiceItem {
  for (;;) {
    const { hole, board } = randomFlopDeal();
    const h = madeHand(hole, board);
    if (!HANDS.includes(h)) continue;
    if (h === 'High card' && Math.random() < 0.7) continue;
    const opts = shuffle([h, ...sample(HANDS.filter(x => x !== h), 3)]);
    return { kind: 'choice', id, prompt: <>Tu as <Inline cs={hole.join(' ')} />. Quelle est ta main sur ce flop ?</>, scene: <CardRow cs={board} />, options: opts, columns: 2, answer: opts.indexOf(h), feedback: `${h}.` };
  }
}
function drawItem(id: string): ChoiceItem {
  for (;;) {
    const { hole, board } = randomFlopDeal();
    // on ne demande pas « ton tirage » quand la main est déjà très forte (deux paires ou mieux)
    if (['Two pair', 'Set', 'Straight', 'Flush', 'Full house or better'].includes(madeHand(hole, board))) continue;
    const lbl = drawLabel(hole, board);
    if (!lbl || (lbl === 'Aucun tirage' && Math.random() < 0.8)) continue;
    const opts = shuffle([lbl, ...sample(DRAWS.filter(x => x !== lbl), 3)]);
    return { kind: 'choice', id, prompt: <>Tu as <Inline cs={hole.join(' ')} />. Quel est ton principal tirage ?</>, scene: <CardRow cs={board} />, options: opts, columns: 2, answer: opts.indexOf(lbl), feedback: `${lbl}.` };
  }
}
function textureItem(id: string): ChoiceItem {
  const { board } = randomFlopDeal();
  const t = boardTexture(board).suits;
  const opts = ['Rainbow', 'Two-tone', 'Monotone'];
  return { kind: 'choice', id, prompt: 'Ce flop est…', scene: <CardRow cs={board} size="lg" />, options: opts, columns: 3, answer: opts.indexOf(t[0].toUpperCase() + t.slice(1)), feedback: 'Rainbow : trois couleurs ; two-tone : deux cartes de la même couleur ; monotone : une seule couleur.' };
}

function scanItem(id: string, holeS: string, boardS: string, options: string[], answers: string[], insight: string): MultiItem {
  return {
    kind: 'multi', id, prompt: <>Tu as <Inline cs={holeS} />. Coche tout ce qui décrit ta main sur ce flop.</>,
    scene: <Scene><CardRow cs={boardS} /></Scene>, options, answers: answers.map(a => options.indexOf(a)), insight,
    feedback: `Bonne description : ${answers.join(' + ')}.`,
  };
}

const A4: Lesson = {
  id: 104, code: 'A4', parcours: 'exploration', module: M,
  title: 'Mains, tirages et boards',
  objective: 'Dire « TPTK avec un backdoor » ou « combo draw sur board two-tone ».',
  defi: {
    intro: <p>Le « scanner » : une main, un flop, et toutes les étiquettes qui s’appliquent. Coche ce qui te semble juste ; plusieurs réponses sont souvent possibles.</p>,
    items: () => [
      scanItem('a4-1', 'As Kd', 'Kc 7d 2h', ['TPTK', 'Top pair', 'Overpair', 'Set'], ['TPTK', 'Top pair'], 'TPTK : top pair avec le meilleur kicker possible (ici l’as).'),
      scanItem('a4-2', '7c 7h', 'Ks 7d 2c', ['Set', 'Trips', 'Underpair', 'Bottom pair'], ['Set'], 'Set : une paire en main + une carte du board. Les trips, c’est une carte en main + une paire au board.'),
      scanItem('a4-3', 'Qh Qc', 'Jd 8s 3h', ['Overpair', 'Top pair', 'Set', 'Underpair'], ['Overpair'], 'Overpair : paire servie plus haute que tout le board.'),
      scanItem('a4-4', 'Ah 5h', 'Kh 9h 2c', ['FD (flush draw)', 'NFD (nut flush draw)', 'Top pair', 'Gutshot'], ['FD (flush draw)', 'NFD (nut flush draw)'], 'NFD : tirage couleur avec la plus haute carte de la couleur.'),
      scanItem('a4-5', '9s 8s', '7d 6c 2h', ['OESD', 'Gutshot', 'Backdoor flush draw', 'Bottom pair'], ['OESD'], 'OESD : quatre cartes qui se suivent, ouvertes des deux côtés (8 outs).'),
      scanItem('a4-6', 'Jh Th', '9h 8c 2h', ['Combo draw', 'FD (flush draw)', 'OESD', 'Gutshot'], ['Combo draw', 'FD (flush draw)', 'OESD'], 'Combo draw : un tirage couleur et un tirage suite en même temps.'),
      scanItem('a4-7', '8d 7d', 'Kd 5c 2s', ['Backdoor flush draw', 'FD (flush draw)', 'Gutshot', 'Bottom pair'], ['Backdoor flush draw'], 'Backdoor : il faut la turn ET la river (trois cartes à la couleur au flop).'),
      { kind: 'choice', id: 'a4-8', prompt: 'Ce flop est…', scene: <CardRow cs="9h 8h 4h" size="lg" />, options: ['Rainbow', 'Two-tone', 'Monotone'], columns: 3, answer: 2, insight: 'Rainbow (3 couleurs), two-tone (2 cartes de la même couleur), monotone (une seule couleur).', feedback: 'Trois cœurs : monotone.' },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Mains faites</th><th>Exemple (flop K-7-2)</th></tr></thead>
          <tbody>
            <tr><td><T k="x-set">Set</T> / <T k="x-trips">trips</T></td><td>7-7 (set) ; sur K-7-7, A-7 fait des trips</td></tr>
            <tr><td><T k="x-overpair">Overpair</T></td><td>A-A, Q-Q sur J-8-3</td></tr>
            <tr><td><T k="x-tptk">TPTK</T> / top pair</td><td>A-K / K-Q</td></tr>
            <tr><td><T k="x-secondpair">Second / bottom pair</T></td><td>8-7 / A-2</td></tr>
          </tbody>
        </table>
        <table className="tbl">
          <thead><tr><th>Tirages</th><th>Outs</th></tr></thead>
          <tbody>
            <tr><td><T k="x-fd">FD / NFD</T></td><td>9</td></tr>
            <tr><td><T k="x-oesd">OESD</T></td><td>8</td></tr>
            <tr><td><T k="x-gutshot">Gutshot</T></td><td>4</td></tr>
            <tr><td><T k="x-combo">Combo draw</T></td><td>jusqu’à 15</td></tr>
            <tr><td><T k="x-backdoor">Backdoor</T></td><td>turn et river nécessaires</td></tr>
          </tbody>
        </table>
        <p className="muted small">Boards : <T k="x-rainbow">rainbow, two-tone, monotone</T> ; paired (une paire au board), connected (cartes proches) ; <T k="x-drywet">dry ou wet</T> selon le nombre de tirages possibles.</p>
      </div>
    ),
  },
  training: { items: () => withIds(shuffle<Item>([handItem(''), handItem(''), handItem(''), handItem(''), drawItem(''), drawItem(''), drawItem(''), textureItem(''), textureItem('')]), 'a4t') },
  fiche: {
    essentiel: [
      'Set : paire en main + carte du board (caché) ; trips : carte en main + paire au board.',
      'TPTK : top pair avec le meilleur kicker ; overpair : paire servie plus haute que le board.',
      'Tirages : FD 9 outs, OESD 8, gutshot 4, combo draw jusqu’à 15 ; backdoor = il faut deux cartes.',
      'Boards : rainbow, two-tone, monotone ; paired, connected ; dry ou wet.',
    ],
    blocks: [{ kind: 'cards', title: 'Exemples', rows: [
      { label: 'TPTK', cards: 'As Kd Kc 7d 2h', note: 'A-K sur K-7-2' },
      { label: 'Set', cards: '7c 7h Ks 7d 2c', note: '7-7 sur K-7-2' },
      { label: 'NFD', cards: 'Ah 5h Kh 9h 2c', note: 'A-5 de cœur sur K-9-2 deux cœurs' },
      { label: 'OESD', cards: '9s 8s 7d 6c 2h', note: '9-8 sur 7-6-2' },
      { label: 'Combo draw', cards: 'Jh Th 9h 8c 2h', note: 'couleur + suite ouverte' },
    ] }],
    pieges: ['Dire « brelan » sans préciser set ou trips : le set est bien plus caché.', 'Oublier qu’un tirage couleur peut ne pas être max (non-nut).'],
  },
};

export const LESSONS_A = [A1, A2, A3, A4];
