import { RANKS } from './cards';
import { getRFIRange, getCallRange, get3betRange, getPositions } from './rangeData';
import { analyzeBoard, textureFR, cBetLabelFR } from './boardAnalyzer';
import type { TrainingScenario, Module } from './scenarios';
import type { GameType } from './rangeData';

// ── Utilities ─────────────────────────────────────────────────────────────────

const SUITS = ['h', 'd', 'c', 's'] as const;
type Suit = typeof SUITS[number];

const SUIT_SYMBOLS: Record<Suit, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(cards: string[]): string {
  return cards.map(c => c[0] + SUIT_SYMBOLS[c[1] as Suit]).join(' ');
}

// ── Hand generation ───────────────────────────────────────────────────────────

interface WeightedHand { key: string; combos: number }
const ALL_HANDS: WeightedHand[] = [];
for (let r = 0; r < 13; r++) {
  ALL_HANDS.push({ key: RANKS[r] + RANKS[r], combos: 6 });
  for (let c = r + 1; c < 13; c++) {
    ALL_HANDS.push({ key: RANKS[r] + RANKS[c] + 's', combos: 4 });
    ALL_HANDS.push({ key: RANKS[r] + RANKS[c] + 'o', combos: 12 });
  }
}
const TOTAL_COMBOS = ALL_HANDS.reduce((s, h) => s + h.combos, 0);

function pickHand(): { key: string; cards: [string, string] } {
  let rand = Math.random() * TOTAL_COMBOS;
  let hand = ALL_HANDS[0];
  for (const h of ALL_HANDS) {
    rand -= h.combos;
    if (rand <= 0) { hand = h; break; }
  }
  return { key: hand.key, cards: keyToCards(hand.key) };
}

function keyToCards(key: string): [string, string] {
  const r1 = key[0];
  const r2 = key[1];
  const type = key[2];
  const shuffled = shuffle(Array.from(SUITS));
  if (!type) return [r1 + shuffled[0], r2 + shuffled[1]]; // pair
  if (type === 's') { const s = pick(SUITS); return [r1 + s, r2 + s]; }
  return [r1 + shuffled[0], r2 + shuffled[1]]; // offsuit — different suits guaranteed by suit shuffle
}

function dealCards(n: number, exclude: string[] = []): string[] {
  const ex = new Set(exclude);
  const deck: string[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      const c = r + s;
      if (!ex.has(c)) deck.push(c);
    }
  }
  return shuffle(deck).slice(0, n);
}

// ── Range scenario ────────────────────────────────────────────────────────────

function genRange(gameType: GameType): TrainingScenario {
  const positions = getPositions(gameType);
  const situationType = pick(['rfi', 'rfi', 'call', '3bet'] as const);

  // RFI
  if (situationType === 'rfi') {
    const heroPos = pick(positions.filter(p => p !== 'BB'));
    const range = getRFIRange(heroPos, gameType);
    const { key, cards } = pickHand();
    const inRange = range.has(key);
    const openSz = heroPos === 'SB' ? 3 : 2.5;
    const pctDesc: Record<string, string> = {
      UTG:'~13 %', UTG1:'~11 %', LJ:'~14 %', HJ:'~17 %', CO:'~25 %', BTN:'~40 %', SB:'~33 %',
    };
    return {
      id: `g-${Date.now()}-${Math.random()}`,
      module: 'range',
      title: `RFI depuis ${heroPos} — ${key}`,
      situation: `Partie ${gameType === '8max' ? '8' : '6'}-max, blindes 1/2 BB. ${posDesc(heroPos)}. Action à vous, personne n'a encore parlé.`,
      heroPosition: heroPos as any,
      heroHand: cards,
      potBB: 3,
      heroStackBB: 100,
      options: [
        { id: 'open', label: `Open raise à ${openSz} BB` },
        { id: 'fold', label: 'Fold' },
      ],
      correctOptionId: inRange ? 'open' : 'fold',
      feedback: {
        correct: inRange ? `Exact ! ${key} est dans la range d'open du ${heroPos}.` : `Bien vu ! ${key} est un fold depuis ${heroPos}.`,
        incorrect: inRange
          ? `${key} est dans la range ${heroPos} (${pctDesc[heroPos] ?? '~20 %'}) — profitez de votre position !`
          : `${key} est un fold depuis ${heroPos}. Range ≈ ${pctDesc[heroPos] ?? '~20 %'}.`,
        explanation: rfiExpl(key, heroPos, inRange),
      },
      rangeToShow: range,
    };
  }

  // Call or 3-bet facing open
  const pairs = validPairs(positions, gameType, situationType);
  if (pairs.length === 0) return genRange(gameType);
  const [heroPos, villainPos] = pick(pairs);
  const range = situationType === 'call'
    ? getCallRange(heroPos, villainPos, gameType)
    : get3betRange(heroPos, villainPos, gameType);
  if (!range) return genRange(gameType);

  const { key, cards } = pickHand();
  const inRange = range.has(key);
  const openSz = ['UTG','UTG1','LJ'].includes(villainPos) ? 3 : 2.5;
  const postBB = heroPos === 'BB' ? 1 : heroPos === 'SB' ? 0.5 : 0;
  const toCall = +(openSz - postBB).toFixed(1);
  const pot = +(openSz + postBB + 1).toFixed(1);

  if (situationType === 'call') {
    return {
      id: `g-${Date.now()}-${Math.random()}`,
      module: 'range',
      title: `${heroPos} vs ${villainPos} open — ${key}`,
      situation: `${villainPos} ouvre à ${openSz} BB. Action sur ${heroPos}. Pot : ${pot} BB. À payer : ${toCall} BB.`,
      heroPosition: heroPos as any,
      heroHand: cards,
      potBB: pot,
      heroStackBB: 100,
      villainBetBB: openSz,
      villainPosition: villainPos as any,
      options: [
        { id: 'fold', label: 'Fold' },
        { id: 'call', label: `Call ${toCall} BB` },
        { id: '3bet', label: `3-bet à ${Math.round(openSz * 3)} BB` },
      ],
      correctOptionId: inRange ? 'call' : 'fold',
      feedback: {
        correct: inRange ? `Parfait ! ${key} défend vs ${villainPos}.` : `Correct, ${key} est un fold.`,
        incorrect: inRange
          ? `${key} est dans la range de défense ${heroPos} vs ${villainPos}. Pot odds : ${toCall} / ${(pot + toCall).toFixed(1)} = ${Math.round(toCall / (pot + toCall) * 100)} %.`
          : `${key} n'a pas assez d'équité vs la range ${villainPos} pour justifier un call.`,
        explanation: callExpl(key, heroPos, villainPos, toCall, pot + toCall, inRange),
      },
      rangeToShow: range,
    };
  }

  // 3-bet
  return {
    id: `g-${Date.now()}-${Math.random()}`,
    module: 'range',
    title: `3-bet ${heroPos} vs ${villainPos} — ${key}`,
    situation: `${villainPos} ouvre à ${openSz} BB. Action sur ${heroPos}. Faut-il 3-bet ?`,
    heroPosition: heroPos as any,
    heroHand: cards,
    potBB: pot,
    heroStackBB: 100,
    villainBetBB: openSz,
    villainPosition: villainPos as any,
    options: [
      { id: 'fold', label: 'Fold' },
      { id: 'call', label: `Call ${toCall} BB` },
      { id: '3bet', label: `3-bet à ${Math.round(openSz * 3)} BB` },
    ],
    correctOptionId: inRange ? '3bet' : 'call',
    feedback: {
      correct: inRange ? `Excellent ! ${key} mérite un 3-bet depuis ${heroPos}.` : `Correct, ${key} est plutôt un call ou fold.`,
      incorrect: inRange
        ? `${key} est dans la range de 3-bet ${heroPos} vs ${villainPos} — c'est une main de value ou un bluff avec bloqueurs.`
        : `${key} ne justifie pas un 3-bet ici. Préférez le call ou fold.`,
      explanation: tbExpl(key, heroPos, villainPos, inRange),
    },
    rangeToShow: range,
  };
}

// ── Pot odds scenario ─────────────────────────────────────────────────────────

function genPotOdds(): TrainingScenario {
  const drawType = pick(['flush', 'flush', 'oesd', 'gutshot', 'combo'] as const);
  const isFlop = Math.random() > 0.3;
  const mult = isFlop ? 4 : 2;

  let heroHand: [string, string];
  let board: string[];
  let outs: number;
  let drawDesc: string;

  if (drawType === 'flush') {
    const suit = pick([...SUITS]);
    const other = SUITS.find(s => s !== suit)!;
    const ri = shuffle([...Array(13).keys()]);
    heroHand = [RANKS[ri[0]] + suit, RANKS[ri[1]] + suit];
    const base = [RANKS[ri[2]] + suit, RANKS[ri[3]] + suit, RANKS[ri[4]] + other];
    board = isFlop ? base : [...base, dealCards(1, [...heroHand, ...base])[0]];
    outs = 9;
    drawDesc = 'nut flush draw (couleur)';
  } else if (drawType === 'oesd') {
    const hi = Math.floor(Math.random() * 8) + 1;
    const seq = [0,1,2,3].map(i => RANKS[hi + i]);
    heroHand = [seq[0] + pick([...SUITS]), seq[1] + pick([...SUITS])];
    const b3 = dealCards(1, [...heroHand, seq[2] + 'h', seq[3] + 'd'])[0];
    const base = [seq[2] + 'h', seq[3] + 'd', b3];
    board = isFlop ? base : [...base, dealCards(1, [...heroHand, ...base])[0]];
    outs = 8;
    drawDesc = `open-ended straight draw (besoin de ${hi > 0 ? RANKS[hi-1] : 'A'} ou ${RANKS[hi+4] ?? '2'} pour compléter)`;
  } else if (drawType === 'gutshot') {
    const hi = Math.floor(Math.random() * 7) + 1;
    const s0 = RANKS[hi], s1 = RANKS[hi+1], s3 = RANKS[hi+3];
    const missing = RANKS[hi+2];
    heroHand = [s0 + pick([...SUITS]), s1 + pick([...SUITS])];
    const fill = dealCards(1, [...heroHand, s3 + 'h'])[0];
    const base = [s3 + 'h', fill, dealCards(1, [...heroHand, s3 + 'h', fill])[0]];
    board = isFlop ? base : [...base, dealCards(1, [...heroHand, ...base])[0]];
    outs = 4;
    drawDesc = `gutshot — besoin d'un ${missing}`;
  } else {
    // combo
    const suit = pick([...SUITS]);
    const hi = Math.floor(Math.random() * 6) + 1;
    const seq = [0,1,2,3].map(i => RANKS[hi + i]);
    heroHand = [seq[0] + suit, seq[1] + suit];
    const b3 = dealCards(1, [...heroHand, seq[2] + suit, seq[3] + suit])[0];
    const base = [seq[2] + suit, seq[3] + suit, b3];
    board = isFlop ? base : [...base, dealCards(1, [...heroHand, ...base])[0]];
    outs = 15;
    drawDesc = 'combo draw (quinte bilatérale + couleur)';
  }

  const potBB = Math.floor(Math.random() * 13) + 8;
  const betFrac = pick([0.25, 0.33, 0.5, 0.67, 0.75, 1.0, 1.25, 1.5, 2.0]);
  const betBB = Math.max(1, Math.round(potBB * betFrac));
  const equity = outs * mult;
  const potOdds = Math.round(betBB / (potBB + 2 * betBB) * 1000) / 10;
  const correct = equity >= potOdds;
  const streetLabel = isFlop ? 'Flop' : 'Turn';
  const betLabel = betFrac >= 1.5 ? `surenchère (${Math.round(betFrac*100)} % pot)`
    : betFrac === 1.0 ? 'mise = pot'
    : `${Math.round(betFrac * 100)} % pot`;

  return {
    id: `g-${Date.now()}-${Math.random()}`,
    module: 'pot-odds',
    title: `${drawType === 'flush' ? 'Flush draw' : drawType === 'oesd' ? 'OESD' : drawType === 'gutshot' ? 'Gutshot' : 'Combo draw'} — ${betLabel}`,
    situation: `${streetLabel}. Vous avez un ${drawDesc}. Villain mise ${betBB} BB dans ${potBB} BB.`,
    heroPosition: 'BTN',
    heroHand,
    board,
    potBB,
    heroStackBB: 100 - potBB,
    villainBetBB: betBB,
    options: [
      { id: 'fold', label: 'Fold' },
      { id: 'call', label: `Call ${betBB} BB` },
    ],
    correctOptionId: correct ? 'call' : 'fold',
    feedback: {
      correct: correct ? `Bien calculé ! ${equity} % ≥ ${potOdds} % → Call.` : `Exact ! ${equity} % < ${potOdds} % → Fold.`,
      incorrect: correct
        ? `Votre équité (${equity} %) dépasse les pot odds (${potOdds} %) → Call profitable.`
        : `Pot odds : ${potOdds} % — vous n'avez que ${equity} % d'équité → Fold.`,
      explanation: `Outs : ${outs} → règle des ${mult} : ${outs} × ${mult} = ${equity} % d'équité.\nPot odds : ${betBB} / (${potBB} + ${betBB} + ${betBB}) = ${betBB}/${potBB + 2*betBB} BB = ${potOdds} % nécessaire.\n${equity} % ${correct ? '≥' : '<'} ${potOdds} % → ${correct ? 'CALL ✓' : 'FOLD ✓'}`,
    },
    potOddsData: { outs, equityPercent: equity, potOddsPercent: potOdds, callAmount: betBB, totalPot: potBB + 2*betBB },
  };
}

// ── Board texture scenario ────────────────────────────────────────────────────

function genBoardTexture(): TrainingScenario {
  const board = dealCards(3);
  const analysis = analyzeBoard(board);
  const raiserPos = pick(['UTG','HJ','CO','BTN']);
  const callerPos = pick(['HJ','CO','BTN','BB'].filter(p => p !== raiserPos));
  const qType = pick(['advantage', 'cbet', 'identify'] as const);
  const boardLabel = fmt(board);

  if (qType === 'identify') {
    return {
      id: `g-${Date.now()}-${Math.random()}`,
      module: 'board-texture',
      title: `Identifier la texture — ${boardLabel}`,
      situation: `Flop : ${boardLabel}. Quelle est la texture de ce board ?`,
      heroPosition: 'BTN',
      heroHand: ['Ah', 'Kd'],
      board,
      potBB: 10,
      heroStackBB: 95,
      options: [
        { id: 'dry',      label: 'Sec (dry) — aucun draw possible' },
        { id: 'semi-wet', label: 'Semi-humide — quelques draws' },
        { id: 'wet',      label: 'Humide (wet) — beaucoup de draws' },
        { id: 'monotone', label: 'Monotone — une seule couleur' },
      ],
      correctOptionId: analysis.texture,
      feedback: {
        correct: `Exact ! Ce board est ${textureFR(analysis.texture)}.`,
        incorrect: `Ce board est ${textureFR(analysis.texture)}.`,
        explanation: boardExpl(board, analysis, raiserPos, callerPos),
      },
      boardTextureData: { texture: analysis.texture, connected: analysis.connectivity !== 'disconnected', twoTone: analysis.suitedness === 'two-tone', monotone: analysis.suitedness === 'monotone', rangeAdvantage: analysis.rangeAdvantage },
    };
  }

  if (qType === 'advantage') {
    const correctId = analysis.rangeAdvantage;
    return {
      id: `g-${Date.now()}-${Math.random()}`,
      module: 'board-texture',
      title: `Avantage de range — ${boardLabel}`,
      situation: `${raiserPos} a raise preflop, ${callerPos} a call. Flop : ${boardLabel}. Qui a l'avantage de range ?`,
      heroPosition: raiserPos as any,
      heroHand: ['Ah', 'Kd'],
      board,
      potBB: 10,
      heroStackBB: 95,
      options: [
        { id: 'raiser',  label: `${raiserPos} (raiser) a l'avantage` },
        { id: 'caller',  label: `${callerPos} (caller) a l'avantage` },
        { id: 'neutral', label: 'Avantage neutre' },
      ],
      correctOptionId: correctId,
      feedback: {
        correct: 'Bien analysé !',
        incorrect: `Sur ce board, l'avantage de range revient au ${correctId === 'raiser' ? 'raiser' : correctId === 'caller' ? 'caller' : 'neutre'}.`,
        explanation: boardExpl(board, analysis, raiserPos, callerPos),
      },
      boardTextureData: { texture: analysis.texture, connected: analysis.connectivity !== 'disconnected', twoTone: analysis.suitedness === 'two-tone', monotone: analysis.suitedness === 'monotone', rangeAdvantage: analysis.rangeAdvantage },
    };
  }

  // cbet
  return {
    id: `g-${Date.now()}-${Math.random()}`,
    module: 'board-texture',
    title: `Stratégie c-bet — ${boardLabel}`,
    situation: `${raiserPos} a raise, ${callerPos} a call. Flop : ${boardLabel}. Stratégie c-bet optimale (vous êtes ${raiserPos}) ?`,
    heroPosition: raiserPos as any,
    heroHand: ['Ah', 'Kd'],
    board,
    potBB: 10,
    heroStackBB: 95,
    options: [
      { id: 'small',  label: 'Bet small (25–33 %)' },
      { id: 'medium', label: 'Bet médium (50 %)' },
      { id: 'large',  label: 'Bet large (70–90 %)' },
      { id: 'check',  label: 'Check' },
    ],
    correctOptionId: analysis.cBetSuggestion,
    feedback: {
      correct: 'Bonne lecture du board !',
      incorrect: `Sur ce board, la stratégie optimale est : ${cBetLabelFR(analysis.cBetSuggestion)}.`,
      explanation: cBetExpl(analysis),
    },
    boardTextureData: { texture: analysis.texture, connected: analysis.connectivity !== 'disconnected', twoTone: analysis.suitedness === 'two-tone', monotone: analysis.suitedness === 'monotone', rangeAdvantage: analysis.rangeAdvantage },
  };
}

// ── Sizing scenario ───────────────────────────────────────────────────────────

function genSizing(): TrainingScenario {
  const numCards = pick([3, 3, 4, 5] as const);
  const board = dealCards(numCards);
  const analysis = analyzeBoard(board);
  const isBluff = Math.random() < 0.4;
  const streetName = numCards === 3 ? 'Flop' : numCards === 4 ? 'Turn' : 'River';
  const potBB = numCards === 3 ? 10 : numCards === 4 ? 18 : 32;
  const boardLabel = fmt(board);

  let correctId: string;
  let expl: string;

  if (isBluff) {
    correctId = 'large';
    expl = `Bluff → sizing grand (75–100 %+). Un petit bet donne des pot odds attractives au villain pour call avec n'importe quelle paire. Un grand bet force les mains marginales à fold.`;
  } else if (analysis.texture === 'dry' && analysis.rangeAdvantage === 'raiser') {
    correctId = 'small';
    expl = `Board sec avec avantage raiser → bet small (25–33 %). Aucun draw à charger, vous pouvez bet fréquemment avec toute votre range d'avantage à petit prix.`;
  } else if (analysis.texture === 'monotone') {
    correctId = 'small';
    expl = `Board monotone → bet small (25–33 %). Votre avantage est limité car villain peut avoir n'importe quelle carte de la couleur. Contrôlez votre exposition.`;
  } else if (analysis.texture === 'wet') {
    correctId = 'large';
    expl = `Board humide → si vous misez, faites-le grand (70–90 %) pour charger les nombreux draws. Un petit bet donne trop de chances de réaliser leur équité.`;
  } else {
    correctId = 'medium';
    expl = `Board semi-humide → sizing médium (50 %). Équilibre entre extraire de la valeur et protéger votre main contre les draws.`;
  }

  const heroHand: [string, string] = isBluff ? ['Ah', 'Jd'] : ['Kh', 'Qs'];

  return {
    id: `g-${Date.now()}-${Math.random()}`,
    module: 'sizing',
    title: `${isBluff ? 'Bluff' : 'Value bet'} — ${boardLabel}`,
    situation: `${streetName}. Vous avez ${isBluff ? 'raté tous vos draws (pure air)' : 'top pair / TPTK'}. Pot : ${potBB} BB. Board : ${boardLabel}. Quelle sizing ?`,
    heroPosition: 'BTN',
    heroHand,
    board,
    potBB,
    heroStackBB: 100 - potBB,
    options: [
      { id: 'small',   label: `${Math.round(potBB * 0.33)} BB (33 %)` },
      { id: 'medium',  label: `${Math.round(potBB * 0.5)} BB (50 %)` },
      { id: 'large',   label: `${Math.round(potBB * 0.75)} BB (75 %)` },
      { id: 'overbet', label: `${Math.round(potBB * 1.25)} BB (125 %)` },
    ],
    correctOptionId: correctId,
    feedback: {
      correct: 'Bon sizing !',
      incorrect: `Le sizing optimal est ${correctId === 'small' ? '33 %' : correctId === 'medium' ? '50 %' : correctId === 'large' ? '75 %' : '125 %'}.`,
      explanation: expl,
    },
    sizingData: {
      recommendedSizingLabel: correctId === 'small' ? '25–33 %' : correctId === 'medium' ? '45–55 %' : correctId === 'large' ? '70–85 %' : '100–150 %',
      recommendedSizingBB: correctId === 'small' ? Math.round(potBB*.33) : correctId === 'medium' ? Math.round(potBB*.5) : correctId === 'large' ? Math.round(potBB*.75) : Math.round(potBB*1.25),
      potBB,
    },
  };
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function generateScenario(module?: Module, gameType: GameType = '6max'): TrainingScenario {
  const mod = module ?? pick(['range','range','pot-odds','board-texture','sizing'] as Module[]);
  switch (mod) {
    case 'range': return genRange(gameType);
    case 'pot-odds': return genPotOdds();
    case 'board-texture': return genBoardTexture();
    case 'sizing': return genSizing();
    default: return genRange(gameType);
  }
}

// ── Explanation helpers ───────────────────────────────────────────────────────

function posDesc(pos: string): string {
  const m: Record<string, string> = {
    UTG:'Vous êtes UTG (premier à parler)', UTG1:'Vous êtes UTG+1', LJ:'Vous êtes Lojack',
    HJ:'Vous êtes Hijack', CO:'Vous êtes en Cut-Off', BTN:'Vous êtes au Bouton',
    SB:'Vous êtes en Small Blind',
  };
  return m[pos] ?? `Vous êtes en ${pos}`;
}

function rfiExpl(key: string, pos: string, inRange: boolean): string {
  const tight = ['UTG','UTG1','LJ'].includes(pos);
  if (inRange) {
    if (key.length === 2) return `${key} est une paire — dans la range d'open de toutes les positions. Même les petites paires peuvent open avec de bons implied odds.`;
    if (pos === 'BTN') return `Le BTN joue ~40 % des mains car il est en position garantie post-flop contre les blindes. ${key} a suffisamment de potentiel.`;
    return `${key} est dans la range ${pos}. ${key[2] === 's' ? 'Les mains suited ont un avantage de playability (flush draw potentiel).' : 'Cette main a assez d\'equity.'}`;
  }
  if (tight) return `${key} est un fold depuis ${pos}. UTG/UTG1 ouvrent ~10–14 % des mains, seulement les broadways premium, meilleures paires et suited connectors solides.`;
  return `${key} est un fold depuis ${pos}. Même avec une range large, cette main n'a pas assez de potentiel pour être rentable.`;
}

function callExpl(key: string, hero: string, villain: string, toCall: number, total: number, inRange: boolean): string {
  const pct = Math.round(toCall / total * 100);
  if (inRange) return `Pot odds : ${toCall} / ${total} = ${pct} % d'équité requise. ${key} (${key[2]==='s'?'suited, ':''}${key[0]+key[1]}) a assez d'équité vs la range d'open ${villain} pour défendre depuis ${hero}.`;
  return `${key} n'a pas assez d'équité contre la range ${villain} pour un call depuis ${hero}. Pot odds : ${pct} % — la main est trop dominée ou trop faible.`;
}

function tbExpl(key: string, hero: string, villain: string, inRange: boolean): string {
  if (inRange) {
    const premiums = ['AA','KK','QQ','JJ','AKs','AKo','AQs','AQo'];
    if (premiums.includes(key)) return `${key} est une main premium → 3-bet toujours pour construire le pot et jouer in-position (si applicable) avec la meilleure main.`;
    return `${key} est un bon bluff 3-bet : il a des bloqueurs (bloque AA, KK, AK chez villain) et reste jouable post-flop si appelé.`;
  }
  return `${key} n'est pas dans la range de 3-bet ${hero} vs ${villain}. 3-bettez les mains premium (AA-JJ, AK) + les bluffs avec bloqueurs (A5s, K5s). ${key} est préférable en call ou fold.`;
}

function boardExpl(board: string[], a: ReturnType<typeof analyzeBoard>, raiser: string, caller: string): string {
  const bLabel = fmt(board);
  const connDesc = a.connectivity === 'connected' ? 'connecté' : a.connectivity === 'semi-connected' ? 'semi-connecté' : 'déconnecté';
  const suitDesc = a.suitedness === 'monotone' ? 'monotone' : a.suitedness === 'two-tone' ? 'two-tone' : 'rainbow';
  let adv = '';
  if (a.rangeAdvantage === 'raiser') adv = `Le raiser (${raiser}) bénéficie d'un avantage : sa range est riche en hautes cartes et broadways qui connectent mieux.`;
  else if (a.rangeAdvantage === 'caller') adv = `Le caller (${caller}) bénéficie de l'avantage : sa range contient plus de suited connectors, petites paires et mains qui connectent sur ce board bas/connecté.`;
  else adv = 'Le board est relativement neutre pour les deux ranges.';
  return `${bLabel} est un board ${textureFR(a.texture)}, ${connDesc}, ${suitDesc}.\n${adv}\nStratégie recommandée : ${cBetLabelFR(a.cBetSuggestion)}.`;
}

function cBetExpl(a: ReturnType<typeof analyzeBoard>): string {
  const r: Record<string, string> = {
    small: 'Board sec et/ou avantage raiser : bet small (25–33 %) avec toute la range. Aucun draw = pas besoin de grosse protection.',
    medium: 'Board semi-humide : sizing médium (50 %) pour équilibrer value et protection.',
    large: 'Board humide mais vous avez un avantage : bet large (70–90 %) pour charger les draws.',
    check: 'Board wet qui avantage le caller : checker pour contrôler le pot. Ne vous faites pas check-raise bluffer avec une c-bet sur un board défavorable.',
  };
  return r[a.cBetSuggestion];
}

function validPairs(positions: string[], gameType: GameType, action: 'call'|'3bet'): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 1; i < positions.length; i++) {
    for (let j = 0; j < i; j++) {
      const hero = positions[i];
      const villain = positions[j];
      const has = action === 'call' ? getCallRange(hero, villain, gameType) : get3betRange(hero, villain, gameType);
      if (has) pairs.push([hero, villain]);
    }
  }
  return pairs;
}
