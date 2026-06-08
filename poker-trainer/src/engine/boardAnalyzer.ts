import { RANKS } from './cards';

export interface BoardAnalysis {
  texture: 'dry' | 'semi-wet' | 'wet' | 'monotone';
  suitedness: 'rainbow' | 'two-tone' | 'monotone';
  connectivity: 'disconnected' | 'semi-connected' | 'connected';
  hasAce: boolean;
  hasHighCard: boolean;
  paired: boolean;
  rangeAdvantage: 'raiser' | 'caller' | 'neutral';
  cBetSuggestion: 'small' | 'medium' | 'large' | 'check';
}

export function analyzeBoard(cards: string[]): BoardAnalysis {
  const flop = cards.slice(0, 3);
  const suits = flop.map(c => c[1]);
  const rankIdxs = flop.map(c => RANKS.indexOf(c[0] as typeof RANKS[number])).sort((a, b) => a - b);

  const uniqueSuits = new Set(suits).size;
  const suitedness: BoardAnalysis['suitedness'] =
    uniqueSuits === 1 ? 'monotone' : uniqueSuits === 2 ? 'two-tone' : 'rainbow';

  const gap1 = rankIdxs[1] - rankIdxs[0];
  const gap2 = rankIdxs[2] - rankIdxs[1];
  const maxGap = Math.max(gap1, gap2);
  const connectivity: BoardAnalysis['connectivity'] =
    maxGap <= 2 ? 'connected' : maxGap <= 4 ? 'semi-connected' : 'disconnected';

  const hasAce = rankIdxs[0] === 0;
  const hasHighCard = rankIdxs[0] <= 4;
  const paired = rankIdxs[0] === rankIdxs[1] || rankIdxs[1] === rankIdxs[2];

  let texture: BoardAnalysis['texture'];
  if (suitedness === 'monotone') {
    texture = 'monotone';
  } else if (connectivity === 'connected' && suitedness === 'two-tone') {
    texture = 'wet';
  } else if (connectivity === 'connected' || suitedness === 'two-tone') {
    texture = 'semi-wet';
  } else {
    texture = 'dry';
  }

  let rangeAdvantage: BoardAnalysis['rangeAdvantage'];
  if (hasAce || (hasHighCard && texture === 'dry')) {
    rangeAdvantage = 'raiser';
  } else if (!hasHighCard && connectivity === 'connected') {
    rangeAdvantage = 'caller';
  } else {
    rangeAdvantage = 'neutral';
  }

  let cBetSuggestion: BoardAnalysis['cBetSuggestion'];
  if (texture === 'dry' && rangeAdvantage === 'raiser') {
    cBetSuggestion = 'small';
  } else if (texture === 'monotone') {
    cBetSuggestion = 'small';
  } else if (texture === 'wet' && rangeAdvantage === 'caller') {
    cBetSuggestion = 'check';
  } else if (texture === 'wet') {
    cBetSuggestion = 'large';
  } else {
    cBetSuggestion = 'medium';
  }

  return { texture, suitedness, connectivity, hasAce, hasHighCard, paired, rangeAdvantage, cBetSuggestion };
}

export function textureFR(t: BoardAnalysis['texture']): string {
  return { dry: 'Sec (dry)', 'semi-wet': 'Semi-humide', wet: 'Humide (wet)', monotone: 'Monotone' }[t];
}

export function cBetLabelFR(s: BoardAnalysis['cBetSuggestion']): string {
  return {
    small: 'Bet small 25–33 %',
    medium: 'Bet médium 50 %',
    large: 'Bet large 70–90 %',
    check: 'Check (pas de c-bet)',
  }[s];
}
