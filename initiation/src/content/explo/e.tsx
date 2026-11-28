/** Exploration · Module E · Bonus tournoi (leçons E15 et E16). */
import type { ChoiceItem, EstimateItem, Item, Lesson, NumberItem } from '../types';
import { IcmTable, pct } from '../../components/Explo';
import { T } from '../../components/Term';
import { trueFalse, withIds } from '../helpers';
import { pick, shuffle } from '../../lib/cards';
import { icm, priceNeeded } from '../../lib/theory';

const M = 15; // module E

const n1 = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const n2 = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const eur = (x: number) => `${Math.round(x).toLocaleString('fr-FR')} €`;
const signed = (x: number) => `${x < 0 ? '−' : ''}${n2(Math.abs(x))}`;

// ════════════════════════════════════════════════════════════════════════════
// E15 · Jouer court
// ════════════════════════════════════════════════════════════════════════════

/**
 * Prix pour payer un tapis après une petite relance : open o avec S BB, un joueur qui couvre fait tapis, les blindes se couchent.
 * Pot « avant la mise » : les deux relances de o et les blindes ; « mise » à payer : S − o.
 */
const priceAfterOpen = (S: number, o = 2.2) => priceNeeded(S - o, 2 * o + 1.5);
/** EV d'un open-shove de S BB depuis le BTN : F = fréquence de fold des blindes, E = équité quand la BB paie. */
const shoveEV = (S: number, F: number, E: number) => F * 1.5 + (1 - F) * (E * (2 * S + 0.5) - S);

function evWhy(S: number, F: number, E: number) {
  const pot = 2 * S + 0.5;
  return `EV = ${pct(F)} × 1,5 + ${pct(1 - F)} × (${pct(E)} × ${n1(pot)} − ${S}) = ${n2(F * 1.5)} ${(1 - F) * (E * pot - S) >= 0 ? '+' : '−'} ${n2(Math.abs((1 - F) * (E * pot - S)))} = ${signed(shoveEV(S, F, E))} BB.`;
}
function shoveChoice(id: string): ChoiceItem {
  for (;;) {
    const S = pick([8, 10, 12, 15]);
    const F = pick([0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const E = pick([0.3, 0.35, 0.4, 0.45, 0.5, 0.55]);
    const ev = shoveEV(S, F, E);
    if (Math.abs(ev) < 0.3) continue;
    return {
      kind: 'choice', id,
      prompt: `Tu fais tapis ${S} BB au BTN (blindes 0,5 / 1, sans ante). Les blindes se couchent ${pct(F)} du temps ; quand la BB paie, tu as ${pct(E)} d’équité. Ce shove est-il rentable ?`,
      options: ['Oui, EV positive', 'Non, EV négative'], columns: 2, answer: ev > 0 ? 0 : 1, feedback: evWhy(S, F, E),
    };
  }
}
function shoveNumber(id: string): NumberItem {
  const S = 10;
  const F = pick([0.4, 0.5, 0.6, 0.7]);
  const E = pick([0.3, 0.4, 0.5]);
  return {
    kind: 'number', id, prompt: `Tapis de 10 BB au BTN. Les blindes se couchent ${pct(F)} du temps ; payé, tu as ${pct(E)} d’équité. Quelle est l’EV de ton shove, en BB ?`,
    unit: 'BB', tolerance: 0.1, answer: Math.round(shoveEV(S, F, E) * 100) / 100, feedback: evWhy(S, F, E),
  };
}
function priceAfterOpenNumber(id: string): NumberItem {
  const S = pick([8, 10, 12, 15, 20]);
  const p = priceAfterOpen(S);
  return {
    kind: 'number', id, prompt: `Tu as ${S} BB. Tu relances à 2,2 BB, un joueur qui te couvre fait tapis, les blindes se couchent. Quelle équité te faut-il pour payer ?`,
    unit: '%', tolerance: 1.5, answer: Math.round(p * 1000) / 10,
    feedback: `Tu paies ${n1(S - 2.2)} pour un pot final de ${n1(2 * S + 1.5)} : ${pct(p, 1)}.`,
  };
}
const ZONES = ['Push/fold (moins de 10 à 12 BB)', 'Resteal (15 à 25 BB)', 'Jeu « normal » (au-delà de 25 à 30 BB)'];
function zoneItem(id: string): ChoiceItem {
  const [S, k] = pick([[6, 0], [8, 0], [9, 0], [17, 1], [20, 1], [22, 1], [40, 2], [50, 2], [60, 2]] as [number, number][]);
  return { kind: 'choice', id, prompt: `Tu as ${S} BB de tapis effectif. Dans quelle zone de jeu es-tu (repères usuels) ?`, options: ZONES, columns: 1, answer: k, feedback: `${S} BB → ${ZONES[k]}.` };
}
function effItem(id: string): NumberItem {
  const a = pick([30, 40, 55, 80]), b = pick([8, 12, 18, 25]);
  return { kind: 'number', id, prompt: `Tu as ${a} BB, ton adversaire ${b} BB. Quel est le tapis effectif entre vous ?`, unit: 'BB', answer: b, feedback: `Le tapis effectif est le plus petit des deux : on ne peut pas perdre plus que ce que l’adversaire peut miser (${b} BB).` };
}

const E15: Lesson = {
  id: 115, code: 'E15', parcours: 'exploration', module: M, bonus: true,
  title: 'Jouer court',
  objective: 'Comprendre pourquoi on joue « tapis ou rien » avec un petit tapis, et calculer l’EV d’un shove.',
  defi: {
    intro: <p>En tournoi, les tapis raccourcissent. Que change un tapis de 9 ou 10 BB ? Fais les calculs étape par étape.</p>,
    items: () => [
      {
        kind: 'number', id: 'e15-1', prompt: 'Tu as 9 BB au CO. Tu relances à 2,2 BB ; le BTN, qui te couvre, fait tapis, les blindes se couchent. Quelle équité te faut-il pour payer ?',
        unit: '%', tolerance: 2, answer: Math.round(priceAfterOpen(9) * 1000) / 10,
        insight: 'Avec 9 BB, après une petite relance, il ne faut qu’environ 35 % d’équité pour payer un tapis.',
        feedback: `Tu paies 6,8 pour un pot final de 19,5 (2,2 + 9 + 1,5 de blindes + 6,8) : ${pct(priceAfterOpen(9), 1)}.`,
      },
      {
        kind: 'choice', id: 'e15-2', prompt: 'Qu’en conclure ?',
        options: ['Relancer petit puis se coucher gaspille 2,2 BB : mieux vaut faire tapis directement, ou se coucher', 'Il faut relancer encore plus petit', 'Il vaut mieux limper'], columns: 1, answer: 0,
        insight: 'Sous 10 à 12 BB, on joue en push/fold : tapis ou rien.',
        feedback: 'La plupart des mains que tu ouvres ont au moins 35 % contre un tapis : tu devrais payer de toute façon. Autant faire tapis tout de suite : tu gagnes aussi les fois où tout le monde se couche.',
      },
      {
        kind: 'number', id: 'e15-3', prompt: 'Autre coup : tu fais tapis 10 BB au BTN (blindes 0,5 / 1, sans ante). Si tout le monde se couche, combien gagnes-tu ?',
        unit: 'BB', tolerance: 0, answer: 1.5, feedback: 'Les deux blindes : 0,5 + 1 = 1,5 BB.',
      },
      {
        kind: 'number', id: 'e15-4', prompt: 'La SB se couche, la BB paie. Quel est le pot à l’abattage ?',
        unit: 'BB', tolerance: 0, answer: 20.5, feedback: 'Tes 10 BB, les 10 BB de la BB et la petite blinde morte : 20,5 BB.',
      },
      {
        kind: 'choice', id: 'e15-5', prompt: 'Les blindes se couchent 60 % du temps ; quand la BB paie, tu as 40 % d’équité. Ce shove est-il rentable ?',
        options: ['Oui, EV positive', 'Non, EV négative'], columns: 2, answer: shoveEV(10, 0.6, 0.4) > 0 ? 0 : 1,
        insight: 'EV d’un shove = fold × blindes + call × (équité × pot final − tapis).',
        feedback: evWhy(10, 0.6, 0.4),
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box prose">
          <h3>L’<T k="x-ev">EV</T> d’un shove</h3>
          <p className="center"><strong>EV = F × blindes + (1 − F) × (E × pot final − tapis)</strong></p>
          <p>F : fréquence à laquelle tout le monde se couche (la <T k="x-foldeq">fold equity</T>). E : ton équité quand tu es payé. Pour 10 BB au BTN : EV = F × 1,5 + (1 − F) × (E × 20,5 − 10).</p>
        </div>
        <table className="tbl">
          <thead><tr><th><T k="x-eff">Tapis effectif</T></th><th>Zone de jeu (repères usuels)</th></tr></thead>
          <tbody>
            <tr><td>Plus de 25 à 30 BB</td><td>Jeu « normal » : open, 3-bet, call</td></tr>
            <tr><td>15 à 25 BB</td><td>Resteal : le 3-bet à tapis sur un open devient l’arme principale</td></tr>
            <tr><td>Moins de 10 à 12 BB</td><td><T k="x-pushfold">Push/fold</T> : tapis ou rien</td></tr>
          </tbody>
        </table>
        <table className="tbl">
          <thead><tr><th>Ton tapis</th><th className="r">Équité pour payer un tapis après un open à 2,2 BB</th></tr></thead>
          <tbody>{[8, 10, 12, 15, 20, 30].map(S => <tr key={S}><td>{S} BB</td><td className="r">{pct(priceAfterOpen(S))}</td></tr>)}</tbody>
        </table>
        <p className="muted small">Les zones de tapis sont des repères, pas des lois : les antes, la structure et les adversaires les déplacent. Les formules, elles, sont exactes.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([shoveChoice(''), shoveChoice(''), shoveChoice(''), shoveNumber(''), priceAfterOpenNumber(''), zoneItem(''), zoneItem(''), effItem('')]), 'e15t'),
  },
  fiche: {
    essentiel: [
      'EV d’un shove = F × blindes + (1 − F) × (E × pot final − tapis).',
      'Avec moins de 10 à 12 BB : push/fold. Relancer petit puis se coucher gaspille des jetons.',
      'Entre 15 et 25 BB : le resteal (3-bet à tapis) est l’arme principale (repère usuel).',
      'Le tapis effectif est le plus petit des deux tapis engagés.',
    ],
    blocks: [
      { kind: 'table', title: 'Zones de tapis (repères usuels)', head: ['Tapis', 'Zone'], rows: [['> 25-30 BB', 'Jeu normal'], ['15-25 BB', 'Resteal'], ['< 10-12 BB', 'Push/fold']] },
      { kind: 'text', title: 'Exemple : 10 BB au BTN', text: 'EV = F × 1,5 + (1 − F) × (E × 20,5 − 10). Avec F = 60 % et E = 40 % : +0,18 BB.' },
    ],
    pieges: ['Relancer à 2,2 BB avec 9 BB puis se coucher face au tapis.', 'Oublier la fold equity dans le calcul d’un shove.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// E16 · L'ICM
// ════════════════════════════════════════════════════════════════════════════

const PRIZE = 1000;
const PAY3 = [0.5, 0.3, 0.2];
const NAMES3 = ['Toi', 'Bob', 'Carla'];
const STACKS3 = [5000, 3000, 2000];
const ICM3 = icm(STACKS3, PAY3.map(p => p * PRIZE));
// Carla (2 000) joue un coin flip pour tout son tapis contre toi.
const CARLA_WIN = icm([3000, 3000, 4000], PAY3.map(p => p * PRIZE))[2];
const CARLA_LOSE = PAY3[2] * PRIZE;
const CARLA_AVG = (CARLA_WIN + CARLA_LOSE) / 2;
const BUBBLE = { names: ['Alice', 'Bob', 'Carla', 'David'], stacks: [4000, 3000, 2000, 1000] };
const ICM_BUBBLE = icm(BUBBLE.stacks, PAY3.map(p => p * PRIZE));

function icmEst(id: string, who: number, insight?: string): EstimateItem {
  return {
    kind: 'estimate', id,
    prompt: who === 0
      ? `Table finale à 3. Prize pool : 1 000 € (500 / 300 / 200). Tapis : toi 5 000, Bob 3 000, Carla 2 000. Combien vaut ton tapis en argent ?`
      : `Et le tapis de Carla (2 000 jetons, soit 20 % des jetons) ?`,
    min: 200, max: 500, step: 5, unit: '€', tolerance: 25, answer: Math.round(ICM3[who]), insight,
    feedback: <IcmTable names={NAMES3} stacks={STACKS3} payouts={PAY3} prize={PRIZE} />,
  };
}
function huNumber(id: string): NumberItem {
  const [p1, p2] = pick([[600, 400], [700, 300], [650, 350]]);
  const a = pick([3000, 4000, 6000, 7000, 8000]);
  const total = 10000;
  const ev = icm([a, total - a], [p1, p2])[0];
  return {
    kind: 'number', id, prompt: `Il reste deux joueurs. Il reste à payer ${p1} € au 1er et ${p2} € au 2e. Tu as ${a.toLocaleString('fr-FR')} jetons sur ${total.toLocaleString('fr-FR')}. Combien vaut ton tapis ?`,
    unit: '€', tolerance: 5, answer: Math.round(ev),
    feedback: `Tu as ${pct(a / total)} de chances de finir 1er : ${p2} + ${pct(a / total)} × (${p1} − ${p2}) = ${eur(ev)}.`,
  };
}
function icm3Est(id: string): EstimateItem {
  const stacks = pick([[6000, 2500, 1500], [4000, 4000, 2000], [7000, 2000, 1000], [3500, 3500, 3000], [5000, 4000, 1000]]);
  const who = pick([0, 1, 2]);
  const ev = icm(stacks, PAY3.map(p => p * PRIZE));
  const total = stacks.reduce((x, y) => x + y, 0);
  return {
    kind: 'estimate', id, prompt: `Table finale à 3, paiements 500 / 300 / 200 €. Tapis : ${stacks.map((s, i) => `${NAMES3[i]} ${s.toLocaleString('fr-FR')}`).join(', ')}. Combien vaut ${who === 0 ? 'ton tapis' : `le tapis de ${NAMES3[who]}`} (${pct(stacks[who] / total)} des jetons) ?`,
    min: 200, max: 500, step: 5, unit: '€', tolerance: 25, answer: Math.round(ev[who]),
    feedback: <IcmTable names={NAMES3} stacks={stacks} payouts={PAY3} prize={PRIZE} />,
  };
}

const E16: Lesson = {
  id: 116, code: 'E16', parcours: 'exploration', module: M, bonus: true,
  title: 'L’ICM',
  objective: 'Comprendre pourquoi, en fin de tournoi, les jetons ne valent pas leur nombre.',
  defi: {
    intro: <p>Table finale à trois. Tes jetons représentent la moitié du jeu : valent-ils la moitié de l’argent ? L’app calcule la valeur de chaque tapis avec le modèle <T k="x-icm">ICM</T>.</p>,
    items: () => [
      icmEst('e16-1', 0, `Avec 50 % des jetons, le chip leader ne vaut que ${pct(ICM3[0] / PRIZE, 1)} du prize pool.`),
      icmEst('e16-2', 2, `Avec 20 % des jetons, Carla vaut ${pct(ICM3[2] / PRIZE, 1)} du prize pool : les petits tapis valent plus que leurs jetons.`),
      {
        kind: 'choice', id: 'e16-3', prompt: 'Carla (2 000) peut jouer tout son tapis contre toi sur un coin flip à 50/50. En argent, ce coup est pour elle…',
        options: ['Gagnant en moyenne', 'Neutre : c’est du 50/50', 'Perdant en moyenne'], columns: 1, answer: 2,
        insight: 'Perdre des jetons coûte plus d’argent qu’en gagner n’en rapporte.',
        feedback: `Victoire : ${eur(CARLA_WIN)} (+${eur(CARLA_WIN - ICM3[2])}). Défaite : 3e, ${eur(CARLA_LOSE)} (−${eur(ICM3[2] - CARLA_LOSE)}). En moyenne : ${eur(CARLA_AVG)}, contre ${eur(ICM3[2])} si elle évite le coup.`,
      },
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <IcmTable names={NAMES3} stacks={STACKS3} payouts={PAY3} prize={PRIZE} />
        <div className="key-box prose">
          <h3>Ce que dit l’ICM</h3>
          <ul>
            <li><strong>Les jetons ne valent pas leur nombre</strong> : le chip leader vaut moins que sa part de jetons, les petits tapis plus.</li>
            <li><strong>En perdre coûte plus qu’en gagner ne rapporte</strong> : un coin flip neutre en jetons est perdant en argent.</li>
            <li><strong>La <T k="x-bubble">bulle</T> met la pression sur les tapis moyens</strong> : ils peuvent tout perdre alors que le petit tapis risque de sauter avant eux. Il leur faut plus d’équité pour payer un tapis : c’est la <T k="x-riskpremium">risk premium</T>.</li>
          </ul>
        </div>
        <p className="small">À la bulle (4 joueurs, 3 payés), le plus petit tapis garde une vraie valeur :</p>
        <IcmTable names={BUBBLE.names} stacks={BUBBLE.stacks} payouts={PAY3} prize={PRIZE} />
        <p className="muted small">Modèle de Malmuth-Harville : la probabilité de finir 1er est la part des jetons, puis on recommence avec les joueurs restants.</p>
      </div>
    ),
  },
  training: {
    items: () => withIds(shuffle<Item>([huNumber(''), huNumber(''), icm3Est(''), icm3Est(''), icm3Est(''),
      trueFalse('', 'Doubler son tapis double sa valeur en argent.', false, 'Faux : en fin de tournoi, la valeur grossit moins vite que les jetons.'),
      trueFalse('', 'Le chip leader vaut, en argent, moins que sa part des jetons.', true, `Vrai : par exemple 50 % des jetons ≈ ${pct(ICM3[0] / PRIZE)} du prize pool.`),
      trueFalse('', 'À la bulle, le plus petit tapis vaut zéro.', false, `Faux : dans l’exemple, 1 000 jetons sur 10 000 valent ${eur(ICM_BUBBLE[3])}.`),
    ]), 'e16t'),
  },
  fiche: {
    essentiel: [
      'ICM : la valeur en argent d’un tapis dépend des paiements, pas seulement des jetons.',
      'Le chip leader vaut moins que sa part de jetons ; les petits tapis valent plus.',
      'Un coin flip neutre en jetons est perdant en argent.',
      'À la bulle, les tapis moyens subissent le plus de pression (risk premium).',
    ],
    blocks: [{ kind: 'table', title: 'Table finale 5 000 / 3 000 / 2 000, prize pool 1 000 € (500 / 300 / 200)', head: ['Joueur', 'Jetons', 'Valeur ICM'], rows: NAMES3.map((n, i) => [n, STACKS3[i].toLocaleString('fr-FR'), eur(ICM3[i])]) }],
    pieges: ['Croire que 50 % des jetons valent 50 % de l’argent.', 'Prendre un coin flip « neutre » en fin de tournoi sans y être obligé.'],
  },
};

export const LESSONS_E = [E15, E16];
