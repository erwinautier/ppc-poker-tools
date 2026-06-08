export type GameType = '6max' | '8max';

const S = (arr: string[]): Set<string> => new Set(arr);

// ── 6-MAX RFI ─────────────────────────────────────────────────────────────────

export const RFI_6MAX: Record<string, Set<string>> = {
  UTG: S(['AA','KK','QQ','JJ','TT','99','88','AKs','AQs','AJs','ATs','KQs','AKo','AQo']),
  HJ:  S(['AA','KK','QQ','JJ','TT','99','88','77','AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','AKo','AQo','AJo','KQo']),
  CO:  S(['AA','KK','QQ','JJ','TT','99','88','77','66','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','T8s','98s','AKo','AQo','AJo','ATo','KQo','KJo','QJo']),
  BTN: S(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','86s','76s','75s','65s','64s','54s','53s','AKo','AQo','AJo','ATo','A9o','KQo','KJo','KTo','QJo','QTo','JTo','T9o','98o']),
  SB:  S(['AA','KK','QQ','JJ','TT','99','88','77','66','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','JTs','J9s','T9s','T8s','98s','87s','76s','65s','AKo','AQo','AJo','ATo','KQo','KJo','QJo']),
};

// ── 6-MAX CALL (facing a raise) ───────────────────────────────────────────────

export const CALL_6MAX: Record<string, Record<string, Set<string>>> = {
  BB: {
    UTG: S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','KTs','KJs','QTs','QJs','JTs','T9s','98s','87s','76s','65s','54s','AJo','ATo','KQo']),
    HJ:  S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K8s','K9s','KTs','KJs','Q8s','Q9s','QTs','QJs','J8s','J9s','JTs','T8s','T9s','97s','98s','87s','76s','65s','54s','43s','AJo','ATo','A9o','KQo','KJo','QJo']),
    CO:  S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K6s','K7s','K8s','K9s','KTs','KJs','Q7s','Q8s','Q9s','QTs','QJs','J7s','J8s','J9s','JTs','T7s','T8s','T9s','96s','97s','98s','85s','86s','87s','75s','76s','65s','54s','43s','32s','AJo','ATo','A9o','A8o','KQo','KJo','KTo','QJo','JTo','T9o']),
    BTN: S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K2s','K3s','K4s','K5s','K6s','K7s','K8s','K9s','KTs','KJs','Q4s','Q5s','Q6s','Q7s','Q8s','Q9s','QTs','QJs','J5s','J6s','J7s','J8s','J9s','JTs','T5s','T6s','T7s','T8s','T9s','95s','96s','97s','98s','85s','86s','87s','74s','75s','76s','64s','65s','54s','43s','32s','A2o','A3o','A4o','A5o','A6o','A7o','A8o','A9o','ATo','AJo','K8o','K9o','KTo','KJo','KQo','Q9o','QTo','QJo','J9o','JTo','T9o','98o','87o','76o']),
    SB:  S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K5s','K6s','K7s','K8s','K9s','KTs','KJs','Q6s','Q7s','Q8s','Q9s','QTs','QJs','J6s','J7s','J8s','J9s','JTs','T6s','T7s','T8s','T9s','96s','97s','98s','86s','87s','75s','76s','65s','54s','43s','AJo','ATo','A9o','A8o','KQo','KJo','KTo','QJo','JTo','T9o','98o']),
  },
  BTN: {
    CO:  S(['22','33','44','55','66','77','88','99','TT','JJ','A3s','A4s','A5s','A8s','A9s','ATs','KTs','KJs','KQs','QJs','QTs','JTs','T9s','98s','87s','76s','65s','AJo','ATo','KQo']),
    HJ:  S(['22','33','44','55','66','77','88','99','TT','JJ','A5s','A9s','ATs','AJs','KJs','KQs','QJs','QTs','JTs','T9s','98s','87s','AJo','ATo','KQo']),
    UTG: S(['55','66','77','88','99','TT','JJ','ATs','AJs','KQs','KJs','QJs','JTs','AJo','KQo']),
  },
  CO: {
    HJ:  S(['66','77','88','99','TT','JJ','A5s','A9s','ATs','AJs','KJs','KQs','QJs','QTs','JTs','T9s','AJo','ATo','KQo']),
    UTG: S(['77','88','99','TT','JJ','AJs','ATs','KQs','KJs','JTs','AJo','ATo','KQo']),
  },
  HJ: {
    UTG: S(['88','99','TT','JJ','AJs','ATs','KQs','AJo']),
  },
};

// ── 6-MAX 3-BET ───────────────────────────────────────────────────────────────

export const THREEBET_6MAX: Record<string, Record<string, Set<string>>> = {
  BTN: {
    CO:  S(['AA','KK','QQ','JJ','AKs','AQs','AKo','AQo','A5s','A4s','A3s','K5s','Q5s']),
    HJ:  S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','K5s']),
    UTG: S(['AA','KK','QQ','JJ','AKs','AKo','A5s','A4s']),
  },
  CO: {
    HJ:  S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s']),
    UTG: S(['AA','KK','QQ','AKs','AKo','A5s']),
  },
  BB: {
    BTN: S(['AA','KK','QQ','JJ','TT','AKs','AQs','AKo','AQo','A5s','A4s','A3s','A2s','K5s','Q5s']),
    CO:  S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','A3s','K5s']),
    HJ:  S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','K5s']),
    UTG: S(['AA','KK','QQ','AKs','AKo','A5s']),
    SB:  S(['AA','KK','QQ','JJ','TT','AKs','AQs','AKo','A5s','A4s','A3s']),
  },
  SB: {
    BTN: S(['AA','KK','QQ','JJ','TT','AKs','AQs','AJo','AKo','A5s','A4s','A3s','A2s','K5s','Q5s','J5s']),
    CO:  S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','K5s']),
    HJ:  S(['AA','KK','QQ','JJ','AKs','AKo','A5s','A4s']),
    UTG: S(['AA','KK','QQ','AKs','AKo']),
  },
  HJ: {
    UTG: S(['AA','KK','QQ','JJ','AKs','AKo','A5s']),
  },
};

// ── 8-MAX RFI ─────────────────────────────────────────────────────────────────

export const RFI_8MAX: Record<string, Set<string>> = {
  UTG:  S(['AA','KK','QQ','JJ','TT','99','AKs','AQs','AJs','KQs','AKo','AQo']),
  UTG1: S(['AA','KK','QQ','JJ','TT','99','88','AKs','AQs','AJs','ATs','KQs','KJs','AKo','AQo','AJo']),
  LJ:   S(['AA','KK','QQ','JJ','TT','99','88','77','AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','AKo','AQo','AJo','KQo']),
  HJ:   S(['AA','KK','QQ','JJ','TT','99','88','77','66','AKs','AQs','AJs','ATs','A9s','A8s','KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','AKo','AQo','AJo','ATo','KQo','KJo']),
  CO:   S(['AA','KK','QQ','JJ','TT','99','88','77','66','55','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','T8s','98s','AKo','AQo','AJo','ATo','KQo','KJo','QJo']),
  BTN:  S(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','86s','76s','75s','65s','64s','54s','AKo','AQo','AJo','ATo','A9o','KQo','KJo','KTo','QJo','QTo','JTo','T9o','98o']),
  SB:   S(['AA','KK','QQ','JJ','TT','99','88','77','66','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','JTs','J9s','T9s','T8s','98s','87s','76s','65s','AKo','AQo','AJo','ATo','KQo','KJo']),
};

// ── 8-MAX CALL ────────────────────────────────────────────────────────────────

export const CALL_8MAX: Record<string, Record<string, Set<string>>> = {
  BB: {
    UTG:  S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','KTs','KJs','QTs','QJs','JTs','T9s','98s','AJo','ATo','KQo']),
    UTG1: S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K9s','KTs','KJs','Q9s','QTs','QJs','J8s','J9s','JTs','T8s','T9s','98s','87s','76s','65s','AJo','ATo','A9o','KQo','KJo']),
    LJ:   S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K8s','K9s','KTs','KJs','Q8s','Q9s','QTs','QJs','J8s','J9s','JTs','T8s','T9s','97s','98s','87s','76s','65s','54s','AJo','ATo','A9o','KQo','KJo','QJo']),
    HJ:   S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K6s','K7s','K8s','K9s','KTs','KJs','Q7s','Q8s','Q9s','QTs','QJs','J7s','J8s','J9s','JTs','T7s','T8s','T9s','96s','97s','98s','86s','87s','76s','65s','54s','43s','AJo','ATo','A9o','A8o','KQo','KJo','KTo','QJo','JTo','T9o']),
    CO:   S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K4s','K5s','K6s','K7s','K8s','K9s','KTs','KJs','Q5s','Q6s','Q7s','Q8s','Q9s','QTs','QJs','J5s','J6s','J7s','J8s','J9s','JTs','T5s','T6s','T7s','T8s','T9s','95s','96s','97s','98s','85s','86s','87s','74s','75s','76s','64s','65s','54s','43s','AJo','ATo','A9o','A8o','A7o','KQo','KJo','KTo','QJo','JTo','T9o','98o']),
    BTN:  S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K2s','K3s','K4s','K5s','K6s','K7s','K8s','K9s','KTs','KJs','Q4s','Q5s','Q6s','Q7s','Q8s','Q9s','QTs','QJs','J5s','J6s','J7s','J8s','J9s','JTs','T5s','T6s','T7s','T8s','T9s','95s','96s','97s','98s','85s','86s','87s','74s','75s','76s','64s','65s','54s','43s','A2o','A3o','A4o','A5o','A6o','A7o','A8o','A9o','ATo','AJo','K8o','K9o','KTo','KJo','KQo','Q9o','QTo','QJo','J9o','JTo','T9o','98o','87o']),
    SB:   S(['22','33','44','55','66','77','88','99','TT','JJ','A2s','A3s','A4s','A5s','A6s','A7s','A8s','A9s','ATs','K5s','K6s','K7s','K8s','K9s','KTs','KJs','Q6s','Q7s','Q8s','Q9s','QTs','QJs','J6s','J7s','J8s','J9s','JTs','T7s','T8s','T9s','96s','97s','98s','86s','87s','76s','65s','54s','AJo','ATo','A9o','KQo','KJo','KTo','QJo','JTo','T9o']),
  },
  BTN: {
    CO:   S(['22','33','44','55','66','77','88','99','TT','JJ','A3s','A4s','A5s','A8s','A9s','ATs','KTs','KJs','KQs','QJs','QTs','JTs','T9s','98s','87s','76s','AJo','ATo','KQo']),
    HJ:   S(['22','33','44','55','66','77','88','99','TT','JJ','A5s','A9s','ATs','KJs','KQs','QJs','QTs','JTs','T9s','98s','AJo','ATo','KQo']),
    LJ:   S(['55','66','77','88','99','TT','JJ','ATs','AJs','A5s','KQs','KJs','QJs','JTs','AJo','KQo']),
    UTG1: S(['66','77','88','99','TT','JJ','AJs','ATs','KQs','KJs','JTs','AJo','KQo']),
    UTG:  S(['77','88','99','TT','JJ','AJs','ATs','KQs','AJo','KQo']),
  },
};

// ── 8-MAX 3-BET ───────────────────────────────────────────────────────────────

export const THREEBET_8MAX: Record<string, Record<string, Set<string>>> = {
  BTN: {
    CO:   S(['AA','KK','QQ','JJ','AKs','AQs','AKo','AQo','A5s','A4s','A3s','K5s','Q5s']),
    HJ:   S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','K5s']),
    LJ:   S(['AA','KK','QQ','JJ','AKs','AKo','A5s','A4s']),
    UTG1: S(['AA','KK','QQ','AKs','AKo','A5s']),
    UTG:  S(['AA','KK','QQ','AKs','AKo']),
  },
  BB: {
    BTN:  S(['AA','KK','QQ','JJ','TT','AKs','AQs','AKo','AQo','A5s','A4s','A3s','A2s','K5s','Q5s']),
    CO:   S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','A3s','K5s']),
    HJ:   S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','K5s']),
    LJ:   S(['AA','KK','QQ','AKs','AQs','AKo','A5s','A4s']),
    UTG1: S(['AA','KK','QQ','AKs','AKo','A5s']),
    UTG:  S(['AA','KK','QQ','AKs','AKo']),
    SB:   S(['AA','KK','QQ','JJ','TT','AKs','AQs','AKo','A5s','A4s','A3s']),
  },
  SB: {
    BTN:  S(['AA','KK','QQ','JJ','TT','AKs','AQs','AKo','AJo','A5s','A4s','A3s','A2s','K5s','Q5s','J5s']),
    CO:   S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s','K5s']),
    HJ:   S(['AA','KK','QQ','JJ','AKs','AKo','A5s','A4s']),
    LJ:   S(['AA','KK','QQ','AKs','AKo','A5s']),
    UTG:  S(['AA','KK','QQ','AKs','AKo']),
  },
  CO: {
    HJ:   S(['AA','KK','QQ','JJ','AKs','AQs','AKo','A5s','A4s']),
    LJ:   S(['AA','KK','QQ','JJ','AKs','AKo','A5s']),
    UTG1: S(['AA','KK','QQ','AKs','AKo','A5s']),
    UTG:  S(['AA','KK','QQ','AKs','AKo']),
  },
};

// ── Accessors ────────────────────────────────────────────────────────────────

export function getRFIRange(heroPos: string, gameType: GameType): Set<string> {
  return (gameType === '6max' ? RFI_6MAX : RFI_8MAX)[heroPos] ?? new Set();
}

export function getCallRange(heroPos: string, villainPos: string, gameType: GameType): Set<string> | null {
  const table = gameType === '6max' ? CALL_6MAX : CALL_8MAX;
  return table[heroPos]?.[villainPos] ?? null;
}

export function get3betRange(heroPos: string, villainPos: string, gameType: GameType): Set<string> | null {
  const table = gameType === '6max' ? THREEBET_6MAX : THREEBET_8MAX;
  return table[heroPos]?.[villainPos] ?? null;
}

export const POSITIONS_6MAX = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export const POSITIONS_8MAX = ['UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

export function getPositions(gameType: GameType): string[] {
  return [...(gameType === '6max' ? POSITIONS_6MAX : POSITIONS_8MAX)];
}

export function getCombos(handKey: string): number {
  if (handKey.length === 2) return 6;
  return handKey[2] === 's' ? 4 : 12;
}

export function rangePercent(range: Set<string>): number {
  let combos = 0;
  range.forEach(h => { combos += getCombos(h); });
  return Math.round((combos / 1326) * 1000) / 10;
}

export function rangeComboCount(range: Set<string>): number {
  let combos = 0;
  range.forEach(h => { combos += getCombos(h); });
  return combos;
}
