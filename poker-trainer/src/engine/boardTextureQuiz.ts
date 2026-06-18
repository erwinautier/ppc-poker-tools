// ── Types ─────────────────────────────────────────────────────────────────────

export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';
export type Suit = 's'|'h'|'d'|'c';

export interface Card {
  rank: Rank;
  suit: Suit;
  rankNum: number;
  isRed: boolean;
  symbol: string;
}

export type TextureLabel = 'Rainbow' | 'Tirage couleur' | 'Monotone' | 'Board pairé' | 'Double pairé';
export type WetnessLabel = 'Très sec' | 'Sec' | 'Semi-dynamique' | 'Dynamique' | 'Très dynamique';
export type RangeAdv = 'IP (BTN)' | 'OOP (BB)' | 'Neutre / Équitable';
export type QuizCategory = 'categorisation' | 'wetness' | 'range-adv' | 'action';

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  type: 'mcq' | 'tf';
  categoryLabel: string;
  question: string;
  // mcq
  options?: string[];
  correctIndex?: number;
  // tf
  correctBool?: boolean;
  explanation: string;
}

export interface BoardAnalysis {
  textureLabel: TextureLabel;
  hasFD: boolean;
  isMonotone: boolean;
  isPaired: boolean;
  isDoublePaired: boolean;
  hasConnects: boolean;    // possible straight draws
  isTwoToned: boolean;
  wetScore: number;        // 1-10
  wetnessLabel: WetnessLabel;
  rangeAdv: RangeAdv;
  maxRankNum: number;
  isHighBoard: boolean;    // max rank ≥ T (10)
  isLowBoard: boolean;     // max rank ≤ 8
}

export interface BoardQuiz {
  cards: Card[];
  analysis: BoardAnalysis;
  questions: QuizQuestion[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS: Suit[] = ['s','h','d','c'];
const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS: Suit[] = ['h','d'];
const RANK_VALUES: Record<Rank, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14,
};

// ── Card helpers ──────────────────────────────────────────────────────────────

function makeCard(rank: Rank, suit: Suit): Card {
  return {
    rank, suit,
    rankNum: RANK_VALUES[rank],
    isRed: RED_SUITS.includes(suit),
    symbol: SUIT_SYMBOLS[suit],
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(makeCard(rank, suit));
    }
  }
  return shuffle(deck);
}

// ── Board analysis ────────────────────────────────────────────────────────────

function analyzeBoard(cards: Card[]): BoardAnalysis {
  const suits = cards.map(c => c.suit);
  const rankNums = cards.map(c => c.rankNum).sort((a, b) => a - b);
  const maxRankNum = Math.max(...rankNums);

  // Suit analysis
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] ?? 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCounts));
  const isMonotone = maxSuit === 3;
  const isTwoToned = maxSuit === 2 && !isMonotone;
  const hasFD = isTwoToned || isMonotone;

  // Rank analysis (pairs)
  const rankCounts: Record<number, number> = {};
  for (const r of rankNums) rankCounts[r] = (rankCounts[r] ?? 0) + 1;
  const pairCount = Object.values(rankCounts).filter(v => v >= 2).length;
  const isPaired = pairCount >= 1;
  const isDoublePaired = pairCount >= 2;

  // Connectivity
  const uniqueRanks = [...new Set(rankNums)].sort((a, b) => a - b);
  const span = uniqueRanks.length >= 2 ? uniqueRanks[uniqueRanks.length - 1] - uniqueRanks[0] : 0;
  // Check for possible straight draws (within 4-gap span = possible OESD or gutshot)
  const hasConnects = !isPaired && span <= 4;

  // Texture label
  let textureLabel: TextureLabel;
  if (isDoublePaired) textureLabel = 'Double pairé';
  else if (isPaired) textureLabel = 'Board pairé';
  else if (isMonotone) textureLabel = 'Monotone';
  else if (isTwoToned) textureLabel = 'Tirage couleur';
  else textureLabel = 'Rainbow';

  // Wetness score 1-10
  let wetScore = 1;
  if (isMonotone) wetScore = 9;
  else if (isTwoToned && hasConnects) wetScore = 7;
  else if (isTwoToned) wetScore = 5;
  else if (hasConnects) wetScore = 4;
  else wetScore = 2;

  if (isPaired) wetScore = Math.max(1, wetScore - 1);

  let wetnessLabel: WetnessLabel;
  if (wetScore >= 8) wetnessLabel = 'Très dynamique';
  else if (wetScore >= 6) wetnessLabel = 'Dynamique';
  else if (wetScore >= 4) wetnessLabel = 'Semi-dynamique';
  else if (wetScore >= 3) wetnessLabel = 'Sec';
  else wetnessLabel = 'Très sec';

  const isHighBoard = maxRankNum >= 10;
  const isLowBoard = maxRankNum <= 8;

  // Range advantage (BTN vs BB, MTT context)
  let rangeAdv: RangeAdv;
  if (isMonotone) {
    // BB has more suited connectors; slight OOP edge
    rangeAdv = isHighBoard ? 'Neutre / Équitable' : 'OOP (BB)';
  } else if (isDoublePaired) {
    rangeAdv = 'Neutre / Équitable';
  } else if (isPaired && isHighBoard) {
    rangeAdv = 'IP (BTN)';
  } else if (isHighBoard) {
    rangeAdv = 'IP (BTN)';
  } else if (isLowBoard) {
    rangeAdv = 'OOP (BB)';
  } else {
    rangeAdv = 'Neutre / Équitable';
  }

  return {
    textureLabel, hasFD, isMonotone, isPaired, isDoublePaired,
    hasConnects, isTwoToned, wetScore, wetnessLabel, rangeAdv,
    maxRankNum, isHighBoard, isLowBoard,
  };
}

// ── Question generation ───────────────────────────────────────────────────────

let questionCounter = 0;
function qid() { return `q${++questionCounter}`; }

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildQuestions(_cards: Card[], a: BoardAnalysis): QuizQuestion[] {
  const pool: QuizQuestion[] = [];

  // ── Catégorisation ──────────────────────────────────────────────────────────

  // Pool A: texture QCM (varied phrasings)
  const texturePhrases = [
    'Quelle est la texture de ce board ?',
    'Comment classifieriez-vous ce flop ?',
    'Quel type de board est-ce ?',
  ];
  const textures: TextureLabel[] = ['Rainbow', 'Tirage couleur', 'Monotone', 'Board pairé', 'Double pairé'];
  const wrongTextures = textures.filter(t => t !== a.textureLabel);
  const texOpts = shuffle([a.textureLabel, ...shuffle(wrongTextures).slice(0, 3)]);
  pool.push({
    id: qid(), category: 'categorisation', type: 'mcq',
    categoryLabel: 'Catégorisation',
    question: pick(texturePhrases),
    options: texOpts,
    correctIndex: texOpts.indexOf(a.textureLabel),
    explanation: textureCatExplanation(a),
  });

  // Pool B: flush draw Vrai/Faux (2 variants, pick one)
  if (!a.isMonotone) {
    const fdVariants: QuizQuestion[] = [
      {
        id: qid(), category: 'categorisation', type: 'tf',
        categoryLabel: 'Catégorisation',
        question: 'Ce board contient un tirage couleur (deux cartes de la même couleur).',
        correctBool: a.hasFD,
        explanation: a.hasFD
          ? 'Exact — deux cartes partagent la même couleur, un tirage couleur est possible.'
          : 'Non — les trois cartes ont trois couleurs différentes (rainbow). Aucun tirage couleur possible.',
      },
      {
        id: qid(), category: 'categorisation', type: 'tf',
        categoryLabel: 'Catégorisation',
        question: a.hasFD
          ? 'Un joueur avec une carte de la couleur dominante a un tirage couleur sur ce board.'
          : 'Ce board est "rainbow" — toutes les couleurs sont différentes.',
        correctBool: true,
        explanation: a.hasFD
          ? 'Exact — avec deux cartes de la même couleur sur le board, une carte de cette couleur suffit pour un tirage couleur.'
          : 'Correct — board rainbow, aucun tirage couleur n\'est disponible.',
      },
    ];
    pool.push(pick(fdVariants));
  }

  // Pool C: board pairé Vrai/Faux
  const pairedVariants: QuizQuestion[] = [
    {
      id: qid(), category: 'categorisation', type: 'tf',
      categoryLabel: 'Catégorisation',
      question: 'Ce board est pairé (au moins deux cartes ont le même rang).',
      correctBool: a.isPaired,
      explanation: a.isPaired
        ? 'Correct — le board contient une paire, ce qui modifie les combinaisons possibles de full house et de carré.'
        : 'Non — les trois cartes ont des rangs différents, le board n\'est pas pairé.',
    },
    {
      id: qid(), category: 'categorisation', type: 'tf',
      categoryLabel: 'Catégorisation',
      question: a.isPaired
        ? 'Sur ce board pairé, les mains de full house et carré sont possibles.'
        : 'Sur ce board, un joueur peut compléter une quinte avec 5 cartes consécutives.',
      correctBool: a.isPaired ? true : a.hasConnects,
      explanation: a.isPaired
        ? 'Vrai — la paire sur le board ouvre des combinaisons de full house pour les joueurs avec une poche ou un trip.'
        : a.hasConnects
          ? 'Correct — les cartes sont suffisamment proches pour permettre des tirages quinte.'
          : 'Non — les cartes sont trop espacées pour former une quinte facilement.',
    },
  ];
  pool.push(pick(pairedVariants));

  // ── Wet / Dry ───────────────────────────────────────────────────────────────

  // Pool D: coordination QCM (varied phrasings)
  const wetPhrases = [
    'Comment évalueriez-vous la coordination de ce board ?',
    'Quel est le niveau de danger (tirages) sur ce board ?',
    'Quelle est la texture de ce flop en termes de coordination ?',
  ];
  const wetnessOpts: WetnessLabel[] = ['Très sec', 'Sec', 'Semi-dynamique', 'Dynamique', 'Très dynamique'];
  const wetOpts = shuffle([a.wetnessLabel, ...shuffle(wetnessOpts.filter(w => w !== a.wetnessLabel)).slice(0, 3)]);
  pool.push({
    id: qid(), category: 'wetness', type: 'mcq',
    categoryLabel: 'Coordination',
    question: pick(wetPhrases),
    options: wetOpts,
    correctIndex: wetOpts.indexOf(a.wetnessLabel),
    explanation: wetnessExplanation(a),
  });

  // Pool E: coordination Vrai/Faux (2 variants)
  const isWet = a.wetScore >= 6;
  const isDry = a.wetScore <= 3;
  const wetVFVariants: QuizQuestion[] = [
    {
      id: qid(), category: 'wetness', type: 'tf',
      categoryLabel: 'Coordination',
      question: 'Ce board est dynamique — il offre de nombreux tirages aux joueurs.',
      correctBool: isWet,
      explanation: isWet
        ? `Correct — board dynamique (score ${a.wetScore}/10). ${wetFactors(a)}`
        : `Non — ce board est plutôt sec et statique (score ${a.wetScore}/10). ${wetFactors(a)}`,
    },
    {
      id: qid(), category: 'wetness', type: 'tf',
      categoryLabel: 'Coordination',
      question: 'Ce board est sec (peu de tirages) — la texture est statique.',
      correctBool: isDry,
      explanation: isDry
        ? `Correct — board sec et statique (score ${a.wetScore}/10). ${wetFactors(a)}`
        : `Non — ce board est dynamique et offre des tirages (score ${a.wetScore}/10). ${wetFactors(a)}`,
    },
  ];
  pool.push(pick(wetVFVariants));

  // ── Avantage de range ───────────────────────────────────────────────────────

  // Pool F: range adv QCM (varied phrasings)
  const rangePhrases = [
    'Dans un spot BTN vs BB au flop, qui bénéficie de l\'avantage de range sur ce board ?',
    'Entre BTN (IP) et BB (OOP), qui a la range la mieux connectée à ce board ?',
    'Sur ce type de board en MTT, quel joueur a structurellement l\'avantage de range ?',
  ];
  const rangeOpts = shuffle(['IP (BTN)', 'OOP (BB)', 'Neutre / Équitable'] as RangeAdv[]);
  pool.push({
    id: qid(), category: 'range-adv', type: 'mcq',
    categoryLabel: 'Avantage de range',
    question: pick(rangePhrases),
    options: rangeOpts,
    correctIndex: rangeOpts.indexOf(a.rangeAdv),
    explanation: rangeAdvExplanation(a),
  });

  // Pool G: range adv Vrai/Faux
  const ipAdvantage = a.rangeAdv === 'IP (BTN)';
  const rangeVFVariants: QuizQuestion[] = [
    {
      id: qid(), category: 'range-adv', type: 'tf',
      categoryLabel: 'Avantage de range',
      question: 'BTN (IP) a l\'avantage de range sur ce board en MTT.',
      correctBool: ipAdvantage,
      explanation: ipAdvantage
        ? `Correct — ${rangeAdvExplanation(a)}`
        : `Non — ${rangeAdvExplanation(a)}`,
    },
    {
      id: qid(), category: 'range-adv', type: 'tf',
      categoryLabel: 'Avantage de range',
      question: a.isHighBoard
        ? 'Les boards hauts (avec T, J, Q, K, A) favorisent généralement IP (BTN) en MTT.'
        : 'Les boards bas (carte max ≤ 8) favorisent généralement OOP (BB) en MTT.',
      correctBool: true,
      explanation: a.isHighBoard
        ? 'Vrai — IP (BTN) ouvre avec une range chargée en grosses paires et AK/AQ qui connectent bien avec les hautes cartes.'
        : 'Vrai — BB défend avec beaucoup de mains basses connectées (54s, 65s, 87s) qui font sets et 2-pairs sur les boards bas.',
    },
  ];
  pool.push(pick(rangeVFVariants));

  // ── Action ──────────────────────────────────────────────────────────────────

  // Pool H: action QCM
  const { actionQ, actionOpts, actionAnswer, actionExplanation } = buildActionQuestion(a);
  const actionAllOpts = shuffle(actionOpts);
  pool.push({
    id: qid(), category: 'action', type: 'mcq',
    categoryLabel: 'Action recommandée',
    question: actionQ,
    options: actionAllOpts,
    correctIndex: actionAllOpts.indexOf(actionAnswer),
    explanation: actionExplanation,
  });

  // Pool I: sizing Vrai/Faux
  pool.push(buildSizingTF(a));

  // Pick 5 questions: guarantee 1 per category, then fill randomly
  const byCategory = (cat: QuizCategory) => pool.filter(q => q.category === cat);
  const guaranteed = [
    pick(byCategory('categorisation')),
    pick(byCategory('wetness')),
    pick(byCategory('range-adv')),
    pick(byCategory('action')),
  ];
  const remaining = pool.filter(q => !guaranteed.includes(q));
  const bonus = shuffle(remaining).slice(0, 1);

  return shuffle([...guaranteed, ...bonus]);
}

// ── Explanation helpers ───────────────────────────────────────────────────────

function textureCatExplanation(a: BoardAnalysis): string {
  if (a.isDoublePaired) return 'Le board contient deux paires — il y a deux rangs répétés parmi les cartes.';
  if (a.isPaired) return 'Une des cartes du board est en double — on parle de board pairé.';
  if (a.isMonotone) return 'Les trois cartes partagent la même couleur : board monotone. Tous les joueurs ont un tirage couleur ou une couleur complète.';
  if (a.isTwoToned) return 'Deux cartes partagent la même couleur — il y a un tirage couleur (flush draw) présent.';
  return 'Les trois cartes ont trois couleurs différentes — board rainbow, aucun tirage couleur possible.';
}

function wetFactors(a: BoardAnalysis): string {
  const factors: string[] = [];
  if (a.isMonotone) factors.push('board monotone — tirage couleur disponible pour tous');
  else if (a.hasFD) factors.push('tirage couleur présent');
  if (a.hasConnects) factors.push('cartes connectées — tirages quinte possibles');
  if (a.isPaired) factors.push('board pairé — bloque une partie des tirages');
  if (!a.hasFD && !a.hasConnects) factors.push('aucun tirage couleur ni tirage quinte évident');
  return factors.length > 0 ? `Éléments : ${factors.join(', ')}.` : '';
}

function wetnessExplanation(a: BoardAnalysis): string {
  return `Ce board est "${a.wetnessLabel}" (${a.wetScore}/10). ${wetFactors(a)}`;
}

function rangeAdvExplanation(a: BoardAnalysis): string {
  if (a.rangeAdv === 'IP (BTN)') {
    if (a.isHighBoard) {
      return `Les boards hauts (carte max ≥ T) favorisent IP (BTN) en MTT : la range BTN est chargée en grosses paires (TT+, AK) et tops paires avec bons kickers, ce que BB n'a pas autant.`;
    }
    return `Ce board pairé/haut favorise IP : l'agresseur pré-flop a plus de sur-paires.`;
  }
  if (a.rangeAdv === 'OOP (BB)') {
    return `Les boards bas (carte max ≤ 8) favorisent OOP (BB) : BB défend avec beaucoup de mains connectées basses (54s, 65s, 87s) qui font 2-pairs, sets et quintes sur ces boards.`;
  }
  return `Ce board est relativement neutre — les deux joueurs ont des mains représentables. Légère incertitude sur l'avantage de range.`;
}

function buildActionQuestion(a: BoardAnalysis): {
  actionQ: string;
  actionOpts: string[];
  actionAnswer: string;
  actionExplanation: string;
} {
  if (a.rangeAdv === 'IP (BTN)') {
    const answer = a.isMonotone
      ? 'Bet petit (25-33%) — fréquence réduite'
      : 'Bet moyen (50-66%) — haute fréquence';
    return {
      actionQ: 'BTN (IP) a l\'avantage de range sur ce board. Quelle est l\'approche standard au flop ?',
      actionOpts: [
        'Check derrière — board trop dynamique',
        'Bet petit (25-33%) — fréquence réduite',
        'Bet moyen (50-66%) — haute fréquence',
        'Overbet — polarisation maximale',
      ],
      actionAnswer: answer,
      actionExplanation: a.isMonotone
        ? `Sur board monotone, même avec l'avantage de range, on réduit la fréquence de cbet et la taille (25-33%). Le board touche les deux ranges de façon similaire et les tirages couleur sont omniprésents.`
        : `IP avec avantage de range sur board sec/haut : cbet standard à 50-66% à haute fréquence — on exploite l'avantage de range sans se compliquer la vie.`,
    };
  }

  if (a.rangeAdv === 'OOP (BB)') {
    return {
      actionQ: 'Ce board favorise BB (OOP). Quelle est la stratégie adaptée pour BTN (IP) ?',
      actionOpts: [
        'Overbet — forcer le fold immédiat',
        'Bet moyen (50-66%) — standard',
        'Bet petit (25-33%) ou check — fréquence réduite',
        'Check systématique — board trop défavorable',
      ],
      actionAnswer: 'Bet petit (25-33%) ou check — fréquence réduite',
      actionExplanation: `Sur board bas qui favorise BB, BTN doit réduire sa fréquence de cbet et miser petit quand il mise. Une mise overbet ou pot serait exploitable : BB connecte bien avec ces boards et peut check-raise souvent.`,
    };
  }

  // Neutral
  const answer = a.hasFD || a.hasConnects
    ? 'Bet petit (25-33%) — board dynamique'
    : 'Bet moyen (50-66%) — board statique';
  return {
    actionQ: 'Le board est relativement neutre. Quelle approche IP (BTN) privilégier ?',
    actionOpts: [
      'Check derrière — attendre le turn',
      'Bet petit (25-33%) — board dynamique',
      'Bet moyen (50-66%) — board statique',
      'Overbet — dépolarisation',
    ],
    actionAnswer: answer,
    actionExplanation: a.hasFD || a.hasConnects
      ? `Board neutre mais dynamique (tirages présents) → cbet petit pour maintenir l'initiative sans trop exposer les mains marginales face aux tirages adverses.`
      : `Board neutre et statique → cbet standard à 50-66% pour extraire de la valeur régulièrement avec les tops-pairs et sur-paires.`,
  };
}

function buildSizingTF(a: BoardAnalysis): QuizQuestion {
  if (a.isMonotone) {
    return {
      id: qid(), category: 'action', type: 'tf',
      categoryLabel: 'Action recommandée',
      question: 'Sur un board monotone, il faut réduire la fréquence de cbet par rapport à un board rainbow.',
      correctBool: true,
      explanation: `Vrai — sur board monotone, le tirage couleur concerne les deux ranges. On c-bet moins souvent (fréquence réduite de ~30-40%) et en petite taille (25-33%), car les bluffs perdent en efficacité et nos mains de valeur ont moins d'avantage relatif.`,
    };
  }
  if (a.isPaired) {
    const isPairedHigh = a.isHighBoard;
    return {
      id: qid(), category: 'action', type: 'tf',
      categoryLabel: 'Action recommandée',
      question: 'Sur un board pairé haut, les sur-paires (overpairs) sont des mains de valeur très fortes.',
      correctBool: isPairedHigh,
      explanation: isPairedHigh
        ? `Vrai — sur board pairé haut (ex. KK7), une sur-paire comme AA domine largement la range adverse. On mise pour de la valeur avec confiance.`
        : `Pas tout à fait — sur board pairé bas (ex. 556), les overpairs sont bonnes mais BB peut avoir des trips (56s, 55) qui nous battent. Il faut rester prudent.`,
    };
  }
  if (a.hasFD && a.hasConnects) {
    return {
      id: qid(), category: 'action', type: 'tf',
      categoryLabel: 'Action recommandée',
      question: 'Sur un board dynamique (tirage couleur + connecté), il faut miser gros (pot+) pour protéger ses mains.',
      correctBool: false,
      explanation: `Faux — sur board très dynamique, on préfère une taille moyenne (50-66%). Une mise pot élague trop la range adverse et pousse dehors exactement les mains qu'on veut garder. Miser moyen permet d'extraire de la valeur tout en gardant l'adversaire dans le coup.`,
    };
  }
  return {
    id: qid(), category: 'action', type: 'tf',
    categoryLabel: 'Action recommandée',
    question: 'Sur un board sec et déconnecté, IP doit miser à basse fréquence pour ne pas se sur-exposer.',
    correctBool: false,
    explanation: `Faux — sur board sec avec avantage de range, IP peut c-bet à haute fréquence avec des sizings petits à moyens (25-50%). L'absence de tirages rend les check-raise adverses moins fréquents, et on extrait de la valeur régulièrement.`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateBoardQuiz(): BoardQuiz {
  const deck = generateDeck();
  const cards = deck.slice(0, 3);
  const analysis = analyzeBoard(cards);
  const questions = buildQuestions(cards, analysis);
  return { cards, analysis, questions };
}

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  categorisation: 'Catégorisation',
  wetness:        'Coordination',
  'range-adv':    'Avantage de range',
  action:         'Action',
};

export const CATEGORY_COLORS: Record<QuizCategory, string> = {
  categorisation: '#3b82f6',
  wetness:        '#06b6d4',
  'range-adv':    '#a855f7',
  action:         '#f59e0b',
};
