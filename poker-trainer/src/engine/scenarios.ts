import { OPENING_RANGES, BB_DEFENSE_VS_BTN } from './ranges';
import type { Position } from './ranges';

export type Module = 'range' | 'pot-odds' | 'board-texture' | 'sizing';

export interface ActionOption {
  id: string;
  label: string;
}

export interface PotOddsData {
  outs: number;
  equityPercent: number;
  potOddsPercent: number;
  callAmount: number;
  totalPot: number;
}

export interface BoardTextureData {
  texture: 'dry' | 'wet' | 'semi-wet' | 'monotone';
  connected: boolean;
  twoTone: boolean;
  monotone: boolean;
  rangeAdvantage: 'raiser' | 'caller' | 'neutral';
}

export interface SizingData {
  recommendedSizingLabel: string;
  recommendedSizingBB: number;
  potBB: number;
}

export interface TrainingScenario {
  id: string;
  module: Module;
  title: string;
  situation: string;
  heroPosition: Position;
  heroHand: [string, string];
  board?: string[];
  potBB: number;
  heroStackBB: number;
  villainBetBB?: number;
  villainPosition?: Position;
  options: ActionOption[];
  correctOptionId: string;
  feedback: {
    correct: string;
    incorrect: string;
    explanation: string;
  };
  rangeToShow?: Set<string>;
  potOddsData?: PotOddsData;
  boardTextureData?: BoardTextureData;
  sizingData?: SizingData;
}

export const SCENARIOS: TrainingScenario[] = [
  // ─── RANGE MODULE ────────────────────────────────────────────────────────────
  {
    id: 'R1',
    module: 'range',
    title: 'Open BTN avec 9-8 offsuit',
    situation:
      'Partie 6-max, blindes 1/2 BB. UTG, HJ et CO ont fold. Vous êtes au BTN, action à vous.',
    heroPosition: 'BTN',
    heroHand: ['9s', '8h'],
    potBB: 3,
    heroStackBB: 100,
    options: [
      { id: 'open', label: 'Open raise à 2.5 BB' },
      { id: 'fold', label: 'Fold' },
    ],
    correctOptionId: 'open',
    feedback: {
      correct: 'Exact ! 98o est dans la range d\'open du BTN.',
      incorrect: '98o est une main jouable sur le BTN (range ~40%).',
      explanation:
        'Le BTN joue en position post-flop contre les deux blindes. La range d\'open BTN inclut tous les connecteurs comme 98o, les suited aces, et les petites paires. Profitez de votre avantage positionnel pour jouer large.',
    },
    rangeToShow: OPENING_RANGES['BTN'],
  },
  {
    id: 'R2',
    module: 'range',
    title: 'UTG avec Q-J offsuit',
    situation:
      'Partie 6-max, blindes 1/2 BB. Vous êtes UTG — le premier à parler. Quelle est votre action ?',
    heroPosition: 'UTG',
    heroHand: ['Qc', 'Jd'],
    potBB: 3,
    heroStackBB: 100,
    options: [
      { id: 'open', label: 'Open raise à 3 BB' },
      { id: 'fold', label: 'Fold' },
    ],
    correctOptionId: 'fold',
    feedback: {
      correct: 'Bien vu ! QJo est un fold depuis UTG en 6-max.',
      incorrect: 'QJo peut sembler fort, mais UTG impose une range très serrée.',
      explanation:
        'Depuis UTG, vous devrez jouer post-flop sans avantage de position contre 5 joueurs. QJo est souvent dominé (AQ, AJ, KJ, QQ+) et difficile à défendre out-of-position. La range UTG tourne autour de 12–14 % : paires 88+, suited broadways, AK/AQ offsuit.',
    },
    rangeToShow: OPENING_RANGES['UTG'],
  },
  {
    id: 'R3',
    module: 'range',
    title: 'Défense BB avec T-7 suited',
    situation:
      'BTN ouvre à 2.5 BB. SB fold. Vous êtes BB avec T♥7♥. Pot actuel : 3.5 BB. À payer : 1.5 BB.',
    heroPosition: 'BB',
    heroHand: ['Th', '7h'],
    potBB: 3.5,
    heroStackBB: 98.5,
    villainBetBB: 2.5,
    villainPosition: 'BTN',
    options: [
      { id: 'fold', label: 'Fold' },
      { id: 'call', label: 'Call 1.5 BB' },
      { id: '3bet', label: '3-bet à 9 BB' },
    ],
    correctOptionId: 'call',
    feedback: {
      correct: 'Parfait ! T7s a suffisamment d\'équité pour défendre la BB.',
      incorrect: 'T7s mérite un call en BB. Les pot odds sont excellentes ici.',
      explanation:
        'Calcul des pot odds : vous payez 1.5 BB pour un pot de 5 BB total → 1.5/5 = 30 % d\'équité requise. T7s en suited a ~35 % d\'équité face à la range d\'open BTN. De plus, vous fermez l\'action.',
    },
    rangeToShow: BB_DEFENSE_VS_BTN,
  },

  // ─── POT ODDS MODULE ─────────────────────────────────────────────────────────
  {
    id: 'P1',
    module: 'pot-odds',
    title: 'Nut flush draw — mise = pot',
    situation:
      'Flop. Vous avez la nut flush draw. Le villain mise pot (10 BB dans 10 BB). Call ou fold ?',
    heroPosition: 'BTN',
    heroHand: ['Ah', 'Kh'],
    board: ['8h', '5h', '2c'],
    potBB: 10,
    heroStackBB: 90,
    villainBetBB: 10,
    options: [
      { id: 'fold', label: 'Fold' },
      { id: 'call', label: 'Call 10 BB' },
      { id: 'raise', label: 'Raise à 30 BB' },
    ],
    correctOptionId: 'call',
    feedback: {
      correct: 'Bien calculé ! Vous avez assez d\'équité pour suivre.',
      incorrect: 'Vous avez 9 outs flush — repassez le calcul des pot odds !',
      explanation:
        'Pot odds : vous payez 10 BB pour 30 BB total → 10/30 = 33 % d\'équité nécessaire.\nVos outs : 9 cartes couleur restantes × 4 (règle des 4, 2 cartes à venir) = 36 %.\n36 % > 33 % → Call profitable !',
    },
    potOddsData: {
      outs: 9,
      equityPercent: 36,
      potOddsPercent: 33,
      callAmount: 10,
      totalPot: 30,
    },
  },
  {
    id: 'P2',
    module: 'pot-odds',
    title: 'Gutshot seul — demi-mise',
    situation:
      'Flop. Vous avez un gutshot (quinte intérieure). Le villain mise 5 BB dans 10 BB. Call ou fold ?',
    heroPosition: 'CO',
    heroHand: ['Qs', '8s'],
    board: ['Jd', '9h', '4c'],
    potBB: 10,
    heroStackBB: 95,
    villainBetBB: 5,
    options: [
      { id: 'call', label: 'Call 5 BB' },
      { id: 'fold', label: 'Fold' },
    ],
    correctOptionId: 'fold',
    feedback: {
      correct: 'Correct ! Un gutshot seul ne suffit pas pour ce call.',
      incorrect: 'Attention : seulement 4 outs ici. Refaites le calcul !',
      explanation:
        'Outs : Q-J-9-8 en main, il vous faut un Dix pour Q-J-T-9-8. Seulement 4 outs.\nRègle des 4 : 4 × 4 = 16 % d\'équité.\nPot odds : 5 / (5 + 10 + 5) = 5/20 = 25 % nécessaire.\n16 % < 25 % → Fold. Un gutshot seul ne rentabilise quasiment jamais un call.',
    },
    potOddsData: {
      outs: 4,
      equityPercent: 16,
      potOddsPercent: 25,
      callAmount: 5,
      totalPot: 20,
    },
  },
  {
    id: 'P3',
    module: 'pot-odds',
    title: 'Combo draw — surenchère villain',
    situation:
      'Flop. Vous avez quinte + couleur draw. Le villain surbide 15 BB dans 10 BB. Call ?',
    heroPosition: 'BTN',
    heroHand: ['Jh', 'Th'],
    board: ['9h', '8h', '4c'],
    potBB: 10,
    heroStackBB: 85,
    villainBetBB: 15,
    options: [
      { id: 'fold', label: 'Fold' },
      { id: 'call', label: 'Call 15 BB' },
      { id: 'raise', label: 'Raise all-in' },
    ],
    correctOptionId: 'call',
    feedback: {
      correct: 'Excellent ! Ce combo draw est extrêmement puissant.',
      incorrect: 'Votre combo draw a bien plus d\'équité que vous ne pensez !',
      explanation:
        'Outs quinte : 4×Q + 4×7 = 8 outs.\nOuts couleur : 13 cœurs − 2 (main) − 2 (board) = 9 restants.\nQ♥ et 7♥ comptent dans les deux → 8 + 9 − 2 = 15 outs.\nRègle des 4 : 15 × 4 = 60 % d\'équité.\nPot odds : 15 / (10 + 15 + 15) = 15/40 = 37.5 %.\n60 % >> 37.5 % → Call très rentable !',
    },
    potOddsData: {
      outs: 15,
      equityPercent: 60,
      potOddsPercent: 37.5,
      callAmount: 15,
      totalPot: 40,
    },
  },

  // ─── BOARD TEXTURE MODULE ─────────────────────────────────────────────────────
  {
    id: 'BT1',
    module: 'board-texture',
    title: 'Analyser K-7-2 rainbow',
    situation:
      'Vous avez raise CO, BB a call. Flop : K♦7♠2♥. Quel type de board et qui a l\'avantage de range ?',
    heroPosition: 'CO',
    heroHand: ['Ac', 'Jc'],
    board: ['Kd', '7s', '2h'],
    potBB: 10,
    heroStackBB: 95,
    options: [
      { id: 'dry-raiser', label: 'Board sec → avantage au raiser' },
      { id: 'wet-caller', label: 'Board wet → avantage au caller' },
      { id: 'neutral', label: 'Board neutre → équilibré' },
      { id: 'depends', label: 'Dépend des ranges exactes' },
    ],
    correctOptionId: 'dry-raiser',
    feedback: {
      correct: 'Parfait ! K72 rainbow est le board sec par excellence.',
      incorrect: 'K72 rainbow favorise nettement le preflop raiser.',
      explanation:
        'K72 rainbow : 3 cartes non-connectées, 3 couleurs → aucun draw possible.\nLe CO a plus de KK, AA, AK, AQ dans sa range. Le BB ne défend que peu de K-x marginaux.\nStratégie : c-bet fréquemment à petit sizing (25–33 %). Votre avantage de range permet de bet large avec toute votre range.',
    },
    boardTextureData: {
      texture: 'dry',
      connected: false,
      twoTone: false,
      monotone: false,
      rangeAdvantage: 'raiser',
    },
  },
  {
    id: 'BT2',
    module: 'board-texture',
    title: 'Stratégie sur board 9-8-7 two-tone',
    situation:
      'Vous avez raise CO, BTN a call. Flop : 9♥8♥7♣. Quelle est votre stratégie c-bet optimale ?',
    heroPosition: 'CO',
    heroHand: ['Ah', 'Kd'],
    board: ['9h', '8h', '7c'],
    potBB: 10,
    heroStackBB: 95,
    options: [
      { id: 'small', label: 'C-bet 25 % (petit bet)' },
      { id: 'large', label: 'C-bet 75 % (protection)' },
      { id: 'check', label: 'Check — BTN a l\'avantage' },
      { id: 'overbet', label: 'C-bet 100 %+ (overbet)' },
    ],
    correctOptionId: 'check',
    feedback: {
      correct: 'Très bien ! Ce board avantage clairement la range du caller BTN.',
      incorrect: 'Ce board connecté two-tone favorise la range du BTN.',
      explanation:
        'La range BTN (call vs CO) contient beaucoup de 9x, 8x, 7x et suited connectors (T9s, J9s, 87s…) qui connectent fortement ici.\nVous avez A-K high card, aucun avantage structurel sur ce flop.\nStratégie : checker pour contrôler le pot. Tirez de la valeur plus tard sur des cartes A ou K favorables.',
    },
    boardTextureData: {
      texture: 'wet',
      connected: true,
      twoTone: true,
      monotone: false,
      rangeAdvantage: 'caller',
    },
  },
  {
    id: 'BT3',
    module: 'board-texture',
    title: 'Sizing sur board monotone A♥6♥3♥',
    situation:
      'Vous avez raise BTN, BB a call. Flop monotone : A♥6♥3♥. Vous avez A♠K♠ (paire d\'As, pas de couleur). Quelle sizing ?',
    heroPosition: 'BTN',
    heroHand: ['As', 'Ks'],
    board: ['Ah', '6h', '3h'],
    potBB: 10,
    heroStackBB: 95,
    options: [
      { id: 'large', label: 'Grand bet (75 %+) : j\'ai TPTK' },
      { id: 'small', label: 'Petit bet (25–33 %) : limiter l\'exposition' },
      { id: 'check', label: 'Check : trop dangereux' },
      { id: 'overbet', label: 'Overbet (150 %) : maximiser la valeur' },
    ],
    correctOptionId: 'small',
    feedback: {
      correct: 'Bien joué ! Un petit sizing est optimal sur ce board monotone.',
      incorrect: 'Sur un board monotone, votre TPTK est vulnérable à toutes les couleurs.',
      explanation:
        'A♥6♥3♥ monotone : n\'importe quelle carte cœur dans la main du villain donne un tirage ou une couleur complète.\nAvec A♠K♠, vous avez TPTK mais sans couleur → ne pas gonfler le pot.\nPetit bet (25–33 %) : restez dans le pot, contrôlez votre exposition si le villain a une couleur.',
    },
    boardTextureData: {
      texture: 'monotone',
      connected: false,
      twoTone: false,
      monotone: true,
      rangeAdvantage: 'raiser',
    },
  },

  // ─── SIZING MODULE ────────────────────────────────────────────────────────────
  {
    id: 'S1',
    module: 'sizing',
    title: 'Value bet sur board sec',
    situation:
      'Vous avez K♥Q♠ (TPTK) sur K♦7♠2♥ rainbow. Pot : 10 BB. Quelle sizing pour votre c-bet ?',
    heroPosition: 'CO',
    heroHand: ['Kh', 'Qs'],
    board: ['Kd', '7s', '2h'],
    potBB: 10,
    heroStackBB: 95,
    options: [
      { id: 'small', label: '3 BB (30 %) — petit bet polarisé' },
      { id: 'medium', label: '5 BB (50 %) — bet moyen' },
      { id: 'large', label: '8 BB (80 %) — grand bet protection' },
      { id: 'overbet', label: '15 BB (150 %) — overbet' },
    ],
    correctOptionId: 'small',
    feedback: {
      correct: 'Excellent ! Le petit sizing est optimal sur ce board sec.',
      incorrect: 'Sur un board sec sans draws, le petit sizing (25–33 %) est préférable.',
      explanation:
        'Sur K72 rainbow, aucun draw n\'est possible. Vous pouvez donc :\n• Bet small (25–33 %) avec TOUTE votre range d\'avantage (mains fortes et bluffs inclus)\n• Ce sizing permet de bet fréquemment sans risquer beaucoup par street\n• Gardez les gros sizings pour les boards wet ou pour représenter des holdings spécifiques',
    },
    sizingData: {
      recommendedSizingLabel: '25–33 % du pot',
      recommendedSizingBB: 3,
      potBB: 10,
    },
  },
  {
    id: 'S2',
    module: 'sizing',
    title: 'Bluff au turn — choisir la taille',
    situation:
      'Board K♦7♠2♥ → 4♣ (turn). Pot : 22 BB. Vous avez A♥J♠ (aucune paire, aucun draw). Vous décidez de bluffer. Quelle sizing ?',
    heroPosition: 'CO',
    heroHand: ['Ah', 'Js'],
    board: ['Kd', '7s', '2h', '4c'],
    potBB: 22,
    heroStackBB: 82,
    options: [
      { id: 'small', label: '7 BB (32 %) — petit bluff' },
      { id: 'medium', label: '12 BB (55 %) — bet moyen' },
      { id: 'large', label: '18 BB (82 %) — grand bet' },
      { id: 'check', label: 'Passer — abandonner le bluff' },
    ],
    correctOptionId: 'large',
    feedback: {
      correct: 'Parfait ! Les bluffs doivent être de grande taille pour maximiser le fold equity.',
      incorrect: 'Quand vous bluffez, un grand sizing force le fold de mains médiocres.',
      explanation:
        'Lorsque vous bluffez :\n• Un petit bluff donne au villain des pot odds attractives pour call avec draws ou paires médiocres\n• Un grand bet (75–100 %+) oblige le villain à avoir une main très forte pour justifier un call\n• Sur K-7-2-4 très sec, la range de villain est surtout K-x et mains manquées → le gros bet les force à fold',
    },
    sizingData: {
      recommendedSizingLabel: '75–100 % du pot',
      recommendedSizingBB: 18,
      potBB: 22,
    },
  },
  {
    id: 'S3',
    module: 'sizing',
    title: 'Value bet river après double call',
    situation:
      'River J♣8♦4♠2♥A♣. Villain a call flop et turn. Pot : 42 BB. Vous avez A♦K♥ (paire d\'As). Quelle sizing river ?',
    heroPosition: 'BTN',
    heroHand: ['Ad', 'Kh'],
    board: ['Jc', '8d', '4s', '2h', 'Ac'],
    potBB: 42,
    heroStackBB: 58,
    options: [
      { id: 'small', label: '10 BB (24 %) — thin value' },
      { id: 'medium', label: '21 BB (50 %) — bet moyen' },
      { id: 'large', label: '35 BB (83 %) — grand bet' },
      { id: 'check', label: 'Check-call si villain bet' },
    ],
    correctOptionId: 'medium',
    feedback: {
      correct: 'Bien calibré ! 50 % est le sizing optimal ici.',
      incorrect: 'Avec une paire d\'As river après deux calls, visez un sizing médium.',
      explanation:
        'Après deux calls (flop + turn), la range de villain contient : J-x, 8-x, petites paires, peut-être un set ou two pair.\nAvec A♦K♥ (paire d\'As river) :\n• Trop petit (24 %) : laisse de la valeur sur la table\n• Trop grand (83 %) : ne sera call que par des mains qui vous battent (sets, AJ, two pair)\n• Médium (50 %) : extrait valeur des J-x, 8-x qui espèrent une main gagnante',
    },
    sizingData: {
      recommendedSizingLabel: '45–55 % du pot',
      recommendedSizingBB: 21,
      potBB: 42,
    },
  },
];

export const MODULE_LABELS: Record<Module, string> = {
  range: 'Ranges',
  'pot-odds': 'Pot Odds',
  'board-texture': 'Texture de Board',
  sizing: 'Sizing',
};

export const MODULE_COLORS: Record<Module, { bg: string; text: string; border: string }> = {
  range: { bg: '#7c3aed', text: '#fff', border: '#6d28d9' },
  'pot-odds': { bg: '#2563eb', text: '#fff', border: '#1d4ed8' },
  'board-texture': { bg: '#059669', text: '#fff', border: '#047857' },
  sizing: { bg: '#d97706', text: '#fff', border: '#b45309' },
};

export const POSITION_COLORS: Record<Position, { bg: string; text: string }> = {
  BTN: { bg: '#f59e0b', text: '#78350f' },
  CO: { bg: '#f97316', text: '#7c2d12' },
  HJ: { bg: '#eab308', text: '#713f12' },
  UTG: { bg: '#ef4444', text: '#7f1d1d' },
  SB: { bg: '#38bdf8', text: '#0c4a6e' },
  BB: { bg: '#3b82f6', text: '#1e3a8a' },
};
