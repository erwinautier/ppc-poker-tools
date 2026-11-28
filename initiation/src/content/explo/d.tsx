/** Exploration · Module D · Le sizing : les maths (leçons D12 à D14). */
import { useState } from 'react';
import type { ChoiceItem, EstimateItem, Item, Lesson, NumberItem } from '../types';
import { Basics, BluffSim, GeoCalc, SizingCalc, pct } from '../../components/Explo';
import { T } from '../../components/Term';
import { trueFalse, withIds } from '../helpers';
import { pick, shuffle } from '../../lib/cards';
import { alpha, bluffShare, geometricFraction, mdf, priceNeeded } from '../../lib/theory';

const M = 14; // module D

const r1 = (x: number) => Math.round(x * 10) / 10;
const n1 = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const FRACS: [string, number][] = [['1/3 du pot', 1 / 3], ['1/2 pot', 1 / 2], ['3/4 du pot', 3 / 4], ['Pot', 1], ['2 × pot', 2]];

function PotBet({ pot, bet, label = 'Mise adverse' }: { pot: number; bet: number; label?: string }) {
  return (
    <div className="scene">
      <div className="tiles">
        <div className="tile"><div className="muted small">Pot</div><div className="tv">{n1(pot)}</div></div>
        <div className="tile"><div className="muted small">{label}</div><div className="tv">{n1(bet)}</div></div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// D12 · Le prix d'une mise
// ════════════════════════════════════════════════════════════════════════════

const priceWhy = (pot: number, bet: number) =>
  `Il paie ${n1(bet)} pour remporter un pot final de ${n1(pot + 2 * bet)} (le pot, la mise et son call) : ${n1(bet)} ÷ ${n1(pot + 2 * bet)} = ${n1(priceNeeded(bet, pot) * 100)} %.`;

function priceEst(id: string, bet: number, insight?: string): EstimateItem {
  return {
    kind: 'estimate', id, prompt: `Pot de 100, ton adversaire mise ${bet}. De combien d’équité as-tu besoin, au minimum, pour suivre ?`,
    scene: <PotBet pot={100} bet={bet} />, min: 0, max: 60, step: 1, unit: '%', tolerance: 4,
    answer: r1(priceNeeded(bet, 100) * 100), insight, feedback: priceWhy(100, bet),
  };
}
function priceNumber(id: string): NumberItem {
  const pot = pick([40, 60, 80, 100, 120, 150, 200, 300]);
  const bet = Math.round(pot * pick([1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5, 2]));
  return { kind: 'number', id, prompt: `Pot de ${pot}, mise de ${bet}. Quelle équité faut-il pour suivre ?`, scene: <PotBet pot={pot} bet={bet} />, unit: '%', tolerance: 1.5, answer: r1(priceNeeded(bet, pot) * 100), feedback: priceWhy(pot, bet) };
}
function ratioNumber(id: string): NumberItem {
  const x = pick([1.5, 2, 2.5, 3, 4, 5]);
  return {
    kind: 'number', id, prompt: `Le pot t’offre une cote de ${n1(x)} contre 1 (${n1(x)}:1). Quelle équité te faut-il pour suivre ?`, unit: '%', tolerance: 1.5,
    answer: r1(100 / (x + 1)), feedback: `Tu paies 1 pour gagner ${n1(x)} : il faut gagner 1 fois sur ${n1(x + 1)}, soit 1 ÷ ${n1(x + 1)} = ${n1(100 / (x + 1))} %.`,
  };
}
function drawCallItem(id: string): ChoiceItem {
  for (;;) {
    const outs = pick([4, 8, 9, 12, 15]);
    const eq = outs / 46;
    const pot = pick([60, 80, 100, 120]);
    const bet = Math.round(pot * pick([1 / 4, 1 / 3, 1 / 2, 3 / 4, 1]));
    const price = priceNeeded(bet, pot);
    if (Math.abs(eq - price) < 0.04) continue;
    const call = eq > price;
    return {
      kind: 'choice', id,
      prompt: `Turn. Tu as un tirage à ${outs} outs (il reste 46 cartes inconnues). Pot de ${pot}, ton adversaire fait tapis pour ${bet} : plus aucune mise n’est possible ensuite. Tu suis ?`,
      options: ['Je suis', 'Je me couche'], columns: 2, answer: call ? 0 : 1,
      feedback: `Équité : ${outs} ÷ 46 = ${pct(eq)}. Prix : ${pct(price)}. ${call ? 'L’équité dépasse le prix : on suit.' : 'L’équité est sous le prix : on se couche.'}`,
    };
  }
}

const PRICE_ROWS = FRACS.map(([l, f]) => [l, pct(priceNeeded(f, 1)), `${n1((1 + f) / f)} contre 1`]);

const D12: Lesson = {
  id: 112, code: 'D12', parcours: 'exploration', module: M,
  title: 'Le prix d’une mise',
  objective: 'Savoir quelle équité il faut pour suivre une mise, quelle que soit sa taille.',
  defi: {
    intro: <p>Un pot de 100, et quatre mises de tailles différentes. Pour chacune, estime l’équité minimale dont tu as besoin pour suivre. Cherche la règle derrière tes réponses.</p>,
    items: () => [
      priceEst('d12-1', 50, 'Face à une mise de demi-pot, il faut 25 % d’équité.'),
      priceEst('d12-2', 100, 'Face à une mise au pot, il faut 33 %.'),
      priceEst('d12-3', 33, 'Face à une petite mise (1/3 du pot), il suffit de 20 %.'),
      priceEst('d12-4', 200, 'Même face à une mise de 2 fois le pot, 40 % suffisent.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Le prix d’une mise (<T k="x-potodds">pot odds</T>)</h3>
          <p className="center"><strong>équité nécessaire = mise ÷ (pot + 2 × mise)</strong></p>
          <p>On paie la mise pour remporter le pot final : le pot de départ, la mise adverse et son propre call.</p>
        </div>
        <table className="tbl">
          <thead><tr><th>Mise</th><th className="r">Équité nécessaire</th><th className="r">Cote</th></tr></thead>
          <tbody>{PRICE_ROWS.map(r => <tr key={r[0]}><td>{r[0]}</td><td className="r">{r[1]}</td><td className="r">{r[2]}</td></tr>)}</tbody>
        </table>
        <div className="key-box prose">
          <h3>Des cotes aux pourcentages</h3>
          <p>Une cote de <strong>x contre 1</strong> (x:1) : tu paies 1 pour gagner x. Il faut gagner 1 fois sur x + 1, soit <strong>1 ÷ (x + 1)</strong>. Exemples : 2:1 → 33 % ; 3:1 → 25 % ; 4:1 → 20 %.</p>
        </div>
        <p className="small">Calculatrice : fais varier la mise.</p>
        <SizingCalc show={['price']} />
        <Basics refs={[[15, 'La cote du pot']]} />
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      priceNumber(''), priceNumber(''), priceNumber(''), ratioNumber(''), ratioNumber(''), drawCallItem(''), drawCallItem(''),
      trueFalse('', 'Face à une mise au pot, il faut 50 % d’équité pour suivre.', false, 'Faux : 100 ÷ (100 + 200) = 33 %.'),
    ]), 'd12t'),
  },
  fiche: {
    essentiel: [
      'Équité nécessaire pour suivre = mise ÷ (pot + 2 × mise).',
      '1/3 du pot : 20 % · 1/2 pot : 25 % · 3/4 : 30 % · pot : 33 % · 2 × pot : 40 %.',
      'Cote x:1 → équité nécessaire 1 ÷ (x + 1).',
      'Tirage : comparer ses outs (outs ÷ cartes inconnues) au prix offert.',
    ],
    blocks: [{ kind: 'table', title: 'Le prix des mises', head: ['Mise', 'Équité nécessaire', 'Cote'], rows: PRICE_ROWS }],
    pieges: ['Diviser la mise par le pot de départ au lieu du pot final.', 'Oublier que plus aucune mise possible = pas d’implied odds.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// D13 · Bluff et défense
// ════════════════════════════════════════════════════════════════════════════

function alphaNumber(id: string): NumberItem {
  const pot = pick([60, 80, 100, 120, 150]);
  const bet = Math.round(pot * pick([1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5]));
  return {
    kind: 'number', id, prompt: `Tu bluffes ${bet} dans un pot de ${pot}. Ton adversaire doit se coucher au moins combien de fois sur 100 pour que ce bluff soit rentable ?`,
    scene: <PotBet pot={pot} bet={bet} label="Ton bluff" />, unit: '%', tolerance: 1.5, answer: r1(alpha(bet, pot) * 100),
    feedback: `Tu risques ${bet} pour gagner ${pot} : ${bet} ÷ (${pot} + ${bet}) = ${n1(alpha(bet, pot) * 100)} %.`,
  };
}
function mdfNumber(id: string): NumberItem {
  const pot = pick([60, 80, 100, 120, 150]);
  const bet = Math.round(pot * pick([1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 2]));
  return {
    kind: 'number', id, prompt: `Pot de ${pot}, mise adverse de ${bet}. Quelle part minimale de ta range dois-tu continuer (call ou relance) pour que ses bluffs ne soient pas rentables d’office ?`,
    scene: <PotBet pot={pot} bet={bet} />, unit: '%', tolerance: 1.5, answer: r1(mdf(bet, pot) * 100),
    feedback: `MDF = pot ÷ (pot + mise) = ${pot} ÷ ${pot + bet} = ${n1(mdf(bet, pot) * 100)} %.`,
  };
}
function bluffCount(id: string): NumberItem {
  const [label, f, mult] = pick([['la moitié du pot', 1 / 2, 3], ['le pot', 1, 2], ['deux fois le pot', 2, 3]] as [string, number, number][]);
  const value = mult * pick([2, 3, 4, 5]);
  const bluffs = value * (f / (1 + f));
  return {
    kind: 'number', id, prompt: `À la river, tu mises ${label} avec ${value} combos de value. Combien de combos de bluff au maximum pour que ton adversaire soit indifférent entre payer et se coucher ?`,
    unit: 'bluffs', tolerance: 0.5, answer: bluffs,
    feedback: `Part de bluffs = mise ÷ (pot + 2 × mise) = ${pct(bluffShare(f, 1))} de la range de mise, soit ${n1(bluffs)} bluffs pour ${value} value.`,
  };
}

const D13_ROWS = FRACS.map(([l, f]) => [l, pct(alpha(f, 1)), pct(mdf(f, 1)), pct(bluffShare(f, 1)), `${n1((1 + f) / f)} : 1`]);

const D13: Lesson = {
  id: 113, code: 'D13', parcours: 'exploration', module: M,
  title: 'Bluff et défense',
  objective: 'Connaître les trois formules exactes : alpha, MDF et ratio value / bluff.',
  defi: {
    intro: <p>Trois questions, du côté de celui qui bluffe puis de celui qui défend. Estime, puis regarde la simulation.</p>,
    items: () => [
      {
        kind: 'estimate', id: 'd13-1', prompt: 'Tu bluffes 100 dans un pot de 100. Ton adversaire doit se coucher au moins combien de fois sur 100 pour que ton bluff soit rentable ?',
        scene: <PotBet pot={100} bet={100} label="Ton bluff" />, min: 0, max: 100, step: 1, unit: '%', tolerance: 5, answer: 50,
        insight: 'Un bluff au pot doit réussir 1 fois sur 2 ; un bluff de demi-pot, 1 fois sur 3.',
        feedback: (
          <div className="stack" style={{ gap: 6 }}>
            <span>Tu risques 100 pour gagner 100 : il faut réussir 50 % du temps. Au-dessus, tu gagnes ; en dessous, tu perds.</span>
            <BluffSim pot={100} bet={100} fold={0.6} />
            <BluffSim pot={100} bet={100} fold={0.4} />
          </div>
        ),
      },
      {
        kind: 'estimate', id: 'd13-2', prompt: 'Et un bluff de demi-pot (50 dans un pot de 100) ?',
        scene: <PotBet pot={100} bet={50} label="Ton bluff" />, min: 0, max: 100, step: 1, unit: '%', tolerance: 5, answer: r1(alpha(50, 100) * 100),
        feedback: 'Tu risques 50 pour gagner 100 : 50 ÷ 150 = 33 %.',
      },
      {
        kind: 'estimate', id: 'd13-3', prompt: 'Côté défense. Pot de 100, ton adversaire mise 50. Quelle part minimale de ta range dois-tu continuer pour que ses bluffs ne soient pas rentables d’office ?',
        scene: <PotBet pot={100} bet={50} />, min: 0, max: 100, step: 1, unit: '%', tolerance: 5, answer: r1(mdf(50, 100) * 100),
        insight: 'La MDF (minimum defense frequency) face à un demi-pot : 67 %.',
        feedback: 'Si tu te couches plus d’un tiers du temps, ses bluffs de demi-pot gagnent quoi qu’il ait : MDF = 100 ÷ 150 = 67 %.',
      },
      {
        kind: 'number', id: 'd13-4', prompt: 'À la river, tu mises le pot avec 10 combos de value. Combien de combos de bluff au maximum pour que ton adversaire soit indifférent entre payer et se coucher ?',
        unit: 'bluffs', tolerance: 0.5, answer: 5, insight: 'Une mise au pot polarisée à la river : 2 mains de value pour 1 bluff.',
        feedback: 'Il paie 1 pour gagner 2 (33 % d’équité nécessaire) : il faut 1 bluff pour 2 value, soit 5 bluffs pour 10 value.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Trois formules exactes</h3>
          <ul>
            <li><strong><T k="x-alpha">Alpha</T></strong> : un bluff doit réussir <strong>mise ÷ (pot + mise)</strong> du temps.</li>
            <li><strong><T k="x-mdf">MDF</T></strong> : il faut continuer avec au moins <strong>pot ÷ (pot + mise)</strong> de sa range.</li>
            <li><strong><T k="x-ratio">Ratio value / bluff</T></strong> : à la river, une mise polarisée contient <strong>mise ÷ (pot + 2 × mise)</strong> de bluffs ; au pot, 2 value pour 1 bluff.</li>
          </ul>
          <p>Ces formules sont exactes dans un cadre simple : le bluff ne gagne jamais s’il est payé. En pratique, on s’adapte à ses adversaires : contre un joueur qui ne se couche jamais, on bluffe moins ; contre un joueur qui se couche trop, plus.</p>
        </div>
        <table className="tbl">
          <thead><tr><th>Mise</th><th className="r">Alpha</th><th className="r">MDF</th><th className="r">Bluffs</th><th className="r">Value : bluff</th></tr></thead>
          <tbody>{D13_ROWS.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'r' : ''}>{c}</td>)}</tr>)}</tbody>
        </table>
        <SizingCalc />
        <p className="muted small">La <T k="x-foldeq">fold equity</T> est la part de tes gains qui vient des fois où l’adversaire se couche.</p>
        <Basics refs={[[16, 'Pourquoi miser ? Valeur et bluff']]} />
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([
      alphaNumber(''), alphaNumber(''), mdfNumber(''), mdfNumber(''), bluffCount(''), bluffCount(''),
      trueFalse('', 'Un bluff de demi-pot doit réussir au moins une fois sur deux pour être rentable.', false, 'Faux : une fois sur trois suffit (50 ÷ 150).'),
      trueFalse('', 'Plus la mise est grosse, plus la MDF est basse.', true, 'Vrai : face au pot, MDF 50 % ; face à 2 × pot, 33 %.'),
    ]), 'd13t'),
  },
  fiche: {
    essentiel: [
      'Alpha (réussite nécessaire d’un bluff) = mise ÷ (pot + mise).',
      'MDF (défense minimale) = pot ÷ (pot + mise).',
      'Part de bluffs d’une mise polarisée river = mise ÷ (pot + 2 × mise) ; au pot : 2 value pour 1 bluff.',
      'Formules exactes dans un cadre simple ; en pratique, on s’adapte aux adversaires.',
    ],
    blocks: [{ kind: 'table', title: 'Alpha, MDF et bluffs selon la mise', head: ['Mise', 'Alpha', 'MDF', 'Bluffs', 'Value : bluff'], rows: D13_ROWS }],
    pieges: ['Confondre alpha (côté bluffeur) et MDF (côté défenseur).', 'Appliquer la MDF à la lettre contre un joueur qui ne bluffe jamais.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// D14 · SPR et géométrie
// ════════════════════════════════════════════════════════════════════════════

/** Trois mises égales d'une fraction f du pot : ce qui reste derrière à chaque tour. */
function threeBets(pot: number, stack: number, f: number) {
  const rows: { pot: number; bet: number; left: number }[] = [];
  let p = pot, left = stack;
  for (let i = 0; i < 3; i++) { const bet = Math.min(left, p * f); rows.push({ pot: p, bet, left: left - bet }); p += 2 * bet; left -= bet; }
  return rows;
}
const TWO_THIRDS = threeBets(6, 50, 2 / 3);
const GEO_6_50 = geometricFraction(6, 50, 3);

function GeoQuiz({ pot, stack, done }: { pot: number; stack: number; done: (x: { correct: boolean; answer: string; expected: string }) => void }) {
  const [f, setF] = useState(0.5);
  const [shown, setShown] = useState(false);
  const geo = geometricFraction(pot, stack, 3);
  return (
    <div className="stack">
      <GeoCalc pot={pot} stack={stack} initial={0.5} onPick={setF} reveal={shown} />
      {!shown && (
        <button className="btn primary" onClick={() => { setShown(true); done({ correct: Math.abs(f - geo) <= 0.04, answer: `${Math.round(f * 100)} % du pot`, expected: `${Math.round(geo * 100)} % du pot` }); }}>
          Valider cette taille
        </button>
      )}
    </div>
  );
}

/** Fractions usuelles et SPR pour lesquels elles sont exactement géométriques en trois mises. */
const GEO_SPR: [number, number][] = [1 / 3, 1 / 2, 3 / 4, 1].map(f => [f, ((1 + 2 * f) ** 3 - 1) / 2]);
function geoChoice(id: string): ChoiceItem {
  const k = Math.floor(Math.random() * GEO_SPR.length);
  const [f, spr] = GEO_SPR[k];
  const pot = pick([6, 8, 10, 12, 20]);
  const stack = Math.round(pot * spr * 10) / 10;
  const opts = GEO_SPR.map(([g]) => `${Math.round(g * 100)} % du pot`);
  return {
    kind: 'choice', id, prompt: `Pot de ${pot} BB au flop, tapis effectif ${n1(stack)} BB. Quelle taille, la même à chaque tour, met tout le monde à tapis à la river en trois mises ?`,
    options: opts, columns: 2, answer: k,
    feedback: `SPR = ${n1(stack)} ÷ ${pot} ≈ ${n1(spr)}. Avec ${Math.round(f * 100)} % du pot, le pot est multiplié par ${n1(1 + 2 * f)} à chaque tour et le tapis part pile à la river.`,
  };
}
function sprNumber(id: string): NumberItem {
  const pot = pick([4, 5, 6, 8, 10, 12, 20]);
  const stack = pick([20, 25, 30, 40, 50, 60, 80, 100]);
  return { kind: 'number', id, prompt: `Pot de ${pot} BB au flop, tapis effectif ${stack} BB. Quel est le SPR ?`, tolerance: 0.15, answer: r1(stack / pot), feedback: `SPR = tapis effectif ÷ pot = ${stack} ÷ ${pot} = ${n1(stack / pot)}.` };
}
function growthNumber(id: string): NumberItem {
  const pot = pick([4, 6, 8, 10, 12]);
  const [label, f, each] = pick([['la moitié du pot', 1 / 2, 'Chaque mise d’un demi-pot'], ['le pot', 1, 'Chaque mise au pot']] as [string, number, string][]);
  const streets = pick([1, 2]);
  const ans = pot * (1 + 2 * f) ** streets;
  return {
    kind: 'number', id, prompt: `Pot de ${pot} BB au flop. Au flop${streets === 2 ? ' et à la turn' : ''}, un joueur mise ${label} et l’autre paie. Quel est le pot au début de ${streets === 2 ? 'la river' : 'la turn'} ?`,
    unit: 'BB', tolerance: 0.5, answer: ans, feedback: `${each}, suivie, multiplie le pot par ${n1(1 + 2 * f)} : ${pot} × ${n1(1 + 2 * f)}${streets === 2 ? ` × ${n1(1 + 2 * f)}` : ''} = ${n1(ans)} BB.`,
  };
}

const GEO_TABLE = [1, 2, 3, 5, 8, 13].map(s => [String(s), pct(geometricFraction(1, s, 3))]);

const D14: Lesson = {
  id: 114, code: 'D14', parcours: 'exploration', module: M,
  title: 'SPR et géométrie',
  objective: 'Mesurer la profondeur du coup (SPR) et trouver la taille qui met à tapis en trois mises.',
  defi: {
    intro: <p>Pot de 6 BB au flop, tapis effectifs de 50 BB. Tu veux miser à chaque tour et être payé. Jusqu’où va le pot ?</p>,
    items: () => [
      {
        kind: 'choice', id: 'd14-1', prompt: 'Tu mises 2/3 du pot au flop, à la turn et à la river, et tu es payé à chaque fois. Es-tu à tapis à la river ?',
        options: ['Oui, avant même la river', 'Oui, pile à la river', 'Non, il reste des jetons derrière'], columns: 1, answer: 2,
        insight: 'Le pot grossit vite, mais 2/3 du pot ne suffit pas pour mettre 50 BB en trois mises dans un pot de 6.',
        feedback: (
          <table className="tbl">
            <thead><tr><th>Tour</th><th className="r">Pot</th><th className="r">Mise</th><th className="r">Reste</th></tr></thead>
            <tbody>{TWO_THIRDS.map((r, i) => <tr key={i}><td>{['Flop', 'Turn', 'River'][i]}</td><td className="r">{n1(r.pot)}</td><td className="r">{n1(r.bet)}</td><td className="r">{n1(r.left)}</td></tr>)}</tbody>
          </table>
        ),
      },
      {
        kind: 'custom', id: 'd14-2', prompt: 'Cherche au curseur la taille (la même à chaque tour) qui met tout le monde à tapis exactement à la river.',
        render: done => <GeoQuiz pot={6} stack={50} done={done} />,
        insight: `La taille géométrique : environ ${Math.round(GEO_6_50 * 100)} % du pot à chaque tour, ici.`,
        feedback: `Exactement ${Math.round(GEO_6_50 * 100)} % du pot : c’est le geometric sizing.`,
      },
      {
        kind: 'number', id: 'd14-3', prompt: 'Le SPR (stack-to-pot ratio) se calcule ainsi : tapis effectif ÷ pot au flop. Quel est-il ici (50 BB, pot de 6 BB) ?',
        tolerance: 0.15, answer: r1(50 / 6), insight: 'SPR = tapis effectif ÷ pot au flop.', feedback: '50 ÷ 6 ≈ 8,3.',
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>Trois idées</h3>
          <ul>
            <li>Le <strong><T k="x-spr">SPR</T></strong> vaut <strong>tapis effectif ÷ pot au flop</strong>. Il mesure la profondeur du coup.</li>
            <li>Le pot grossit de façon exponentielle : une mise d’une fraction f du pot, suivie, le multiplie par <strong>1 + 2 × f</strong> (×2 pour un demi-pot, ×3 pour un pot).</li>
            <li>Le <strong><T k="x-geo">geometric sizing</T></strong> est la taille, la même à chaque tour, qui met tout le monde à tapis à la river.</li>
          </ul>
        </div>
        <table className="tbl">
          <thead><tr><th>SPR au flop</th><th className="r">Taille géométrique (3 mises)</th></tr></thead>
          <tbody>{GEO_TABLE.map(r => <tr key={r[0]}><td>{r[0]}</td><td className="r">{r[1]} du pot</td></tr>)}</tbody>
        </table>
        <GeoCalc pot={6} stack={50} initial={2 / 3} />
        <p className="small">Un usage répandu, pas une loi : avec un SPR bas (sous 3 ou 4), une top pair est souvent <T k="x-committed">engagée</T> (pot-committed) ; avec un SPR élevé, il faut une main plus forte pour mettre tout son tapis.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([sprNumber(''), sprNumber(''), growthNumber(''), growthNumber(''), geoChoice(''), geoChoice(''), geoChoice(''),
      trueFalse('', 'Trois mises au pot suivies multiplient le pot par 9.', false, 'Faux : par 3 × 3 × 3 = 27.'),
    ]), 'd14t'),
  },
  fiche: {
    essentiel: [
      'SPR = tapis effectif ÷ pot au flop.',
      'Une mise de f × pot, suivie, multiplie le pot par 1 + 2f : ×2 (demi-pot), ×3 (pot).',
      'Geometric sizing : la même fraction à chaque tour pour être à tapis à la river.',
      'Usage : SPR sous 3-4, une top pair est souvent engagée.',
    ],
    blocks: [{ kind: 'table', title: 'Taille géométrique selon le SPR (3 mises)', head: ['SPR', 'Fraction du pot'], rows: GEO_TABLE }],
    pieges: ['Penser que le pot grossit « de la mise » : il grossit de deux fois la mise.', 'Miser petit au flop puis devoir surmiser à la river.'],
  },
};

export const LESSONS_D = [D12, D13, D14];
