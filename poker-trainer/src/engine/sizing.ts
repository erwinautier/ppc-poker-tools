// ── Sizing types ───────────────────────────────────────────────────────────────

export type Street = 'flop' | 'turn' | 'river';
export type RelPosition = 'ip' | 'oop';
export type PostflopScenario = 'cbet' | 'delayed-cbet' | 'probe' | 'donk' | 'value' | 'bluff';
export type SizingTexture = 'dry' | 'semi-wet' | 'wet' | 'monotone' | 'paired' | 'any';
export type SizingOption = 'check' | '25' | '33' | '50' | '66' | '75' | 'pot' | 'overbet';

export const STREETS: Street[] = ['flop', 'turn', 'river'];
export const REL_POSITIONS: RelPosition[] = ['ip', 'oop'];
export const POSTFLOP_SCENARIOS: PostflopScenario[] = ['cbet', 'delayed-cbet', 'probe', 'donk', 'value', 'bluff'];
export const SIZING_TEXTURES: SizingTexture[] = ['dry', 'semi-wet', 'wet', 'monotone', 'paired', 'any'];
export const SIZING_OPTIONS: SizingOption[] = ['check', '25', '33', '50', '66', '75', 'pot', 'overbet'];

export const STREET_LABELS: Record<Street, string> = {
  flop:  'Flop',
  turn:  'Turn',
  river: 'River',
};

export const REL_POSITION_LABELS: Record<RelPosition, string> = {
  ip:  'IP (In Position)',
  oop: 'OOP (Out of Position)',
};

export const POSTFLOP_SCENARIO_LABELS: Record<PostflopScenario, string> = {
  cbet:           'C-bet',
  'delayed-cbet': 'C-bet différé',
  probe:          'Probe bet',
  donk:           'Donk bet',
  value:          'Value bet',
  bluff:          'Bluff',
};

export const SIZING_TEXTURE_LABELS: Record<SizingTexture, string> = {
  dry:        'Sec (Dry)',
  'semi-wet': 'Semi-humide',
  wet:        'Humide (Wet)',
  monotone:   'Monotone',
  paired:     'Board pairé',
  any:        'Toutes textures',
};

export const SIZING_LABELS: Record<SizingOption, string> = {
  check:   'Check',
  '25':    '25%',
  '33':    '33%',
  '50':    '50%',
  '66':    '66%',
  '75':    '75%',
  pot:     'Pot',
  overbet: 'Overbet',
};

export const SIZING_COLORS: Record<SizingOption, { bg: string; text: string; inactive: string }> = {
  check:   { bg: '#475569', text: '#fff',    inactive: '#1e293b' },
  '25':    { bg: '#0ea5e9', text: '#fff',    inactive: '#0c2a38' },
  '33':    { bg: '#22d3ee', text: '#0f172a', inactive: '#0a2e33' },
  '50':    { bg: '#16a34a', text: '#fff',    inactive: '#14532d' },
  '66':    { bg: '#a3e635', text: '#0f172a', inactive: '#2a3b0a' },
  '75':    { bg: '#f59e0b', text: '#0f172a', inactive: '#3f2800' },
  pot:     { bg: '#f97316', text: '#fff',    inactive: '#7c2d12' },
  overbet: { bg: '#ef4444', text: '#fff',    inactive: '#7f1d1d' },
};

// ── Sizing context ─────────────────────────────────────────────────────────────

export interface SizingContext {
  street:   Street;
  position: RelPosition;
  scenario: PostflopScenario;
  texture:  SizingTexture;
}

export function sizingCtxKey(ctx: SizingContext): string {
  return `${ctx.street}|${ctx.position}|${ctx.scenario}|${ctx.texture}`;
}

export function sizingCtxLabel(ctx: SizingContext): string {
  return [
    STREET_LABELS[ctx.street],
    ctx.position.toUpperCase(),
    POSTFLOP_SCENARIO_LABELS[ctx.scenario],
    SIZING_TEXTURE_LABELS[ctx.texture],
  ].join(' · ');
}

export function sizingStatKey(ctxKey: string): string {
  return `sizing::${ctxKey}`;
}

// ── Sizing rules storage type ─────────────────────────────────────────────────

// sizingCtxKey → valid sizing options (multiple = all are correct)
export type SizingRules = Record<string, SizingOption[]>;

// ── Board generation ───────────────────────────────────────────────────────────

const BOARD_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const BOARD_SUITS = ['s', 'h', 'd', 'c'] as const;
const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_IS_RED:  Record<string, boolean> = { s: false, h: true,  d: true,  c: false };

export interface BoardCard {
  rank:   string;
  suit:   string;
  symbol: string;
  isRed:  boolean;
}

function mkCard(rank: string, suit: string): BoardCard {
  return { rank, suit, symbol: SUIT_SYMBOLS[suit], isRed: SUIT_IS_RED[suit] };
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Number of cards on board for a given street */
function boardSize(street: Street): number {
  return street === 'flop' ? 3 : street === 'turn' ? 4 : 5;
}

function rankIdx(r: string): number {
  return BOARD_RANKS.indexOf(r as typeof BOARD_RANKS[number]);
}

// Dry: rainbow, disconnected (all inter-rank gaps >= 3)
function dryBoard(n: number): BoardCard[] {
  const ranks = shuffled(BOARD_RANKS as unknown as string[]);
  const suits  = shuffled(BOARD_SUITS as unknown as string[]);
  const picked: string[] = [];

  for (const r of ranks) {
    if (picked.every(p => Math.abs(rankIdx(r) - rankIdx(p)) >= 3)) {
      picked.push(r);
      if (picked.length === n) break;
    }
  }
  // fallback if not enough
  while (picked.length < n) picked.push(ranks[picked.length]);

  return picked.map((r, i) => mkCard(r, suits[i % suits.length]));
}

// Wet: two-tone + connected ranks (max gap <= 2 between adjacent ranks)
function wetBoard(n: number): BoardCard[] {
  const mainSuit  = pick(BOARD_SUITS);
  const otherSuit = pick(BOARD_SUITS.filter(s => s !== mainSuit));
  const suitSeq   = [mainSuit, mainSuit, otherSuit, mainSuit, otherSuit].slice(0, n);
  shuffled(suitSeq); // shuffle suits assignment

  // Connected run
  const startIdx = Math.floor(Math.random() * (BOARD_RANKS.length - n - 1));
  const ranks    = [...BOARD_RANKS].slice(startIdx, startIdx + n);
  shuffled(ranks);
  return ranks.map((r, i) => mkCard(r, suitSeq[i]));
}

// Monotone: all same suit
function monotoneBoard(n: number): BoardCard[] {
  const suit  = pick(BOARD_SUITS);
  const ranks = shuffled(BOARD_RANKS as unknown as string[]).slice(0, n);
  return ranks.map(r => mkCard(r, suit));
}

// Semi-wet: two-tone but disconnected, or rainbow but connected
function semiWetBoard(n: number): BoardCard[] {
  if (Math.random() < 0.5) {
    // two-tone, disconnected
    const s1 = pick(BOARD_SUITS);
    const s2 = pick(BOARD_SUITS.filter(s => s !== s1));
    const suits = shuffled([s1, s2, s2, s1, s2]).slice(0, n);
    const ranks = dryBoard(n).map(c => c.rank); // use disconnected ranks
    return ranks.map((r, i) => mkCard(r, suits[i]));
  } else {
    // connected, rainbow
    const suits = shuffled(BOARD_SUITS as unknown as string[]).slice(0, n);
    const startIdx = Math.floor(Math.random() * (BOARD_RANKS.length - n - 1));
    const ranks    = [...BOARD_RANKS].slice(startIdx, startIdx + n);
    return shuffled(ranks).map((r, i) => mkCard(r, suits[i % suits.length]));
  }
}

// Paired: one rank appears twice
function pairedBoard(n: number): BoardCard[] {
  const ranks   = shuffled(BOARD_RANKS as unknown as string[]);
  const pRank   = ranks[0];
  const kickers = ranks.slice(1, n); // n-1 distinct kickers
  const suits   = shuffled(BOARD_SUITS as unknown as string[]);

  const cards: BoardCard[] = [
    mkCard(pRank, suits[0]),
    mkCard(pRank, suits[1]),
    ...kickers.map((r, i) => mkCard(r, suits[(i + 2) % suits.length])),
  ];
  return shuffled(cards).slice(0, n);
}

// Any texture: fully random
function anyBoard(n: number): BoardCard[] {
  const deck = shuffled(
    (BOARD_RANKS as unknown as string[]).flatMap(r =>
      (BOARD_SUITS as unknown as string[]).map(s => r + s),
    ),
  );
  return deck.slice(0, n).map(c => mkCard(c[0], c[1]));
}

export function generateBoard(texture: SizingTexture, street: Street): BoardCard[] {
  const n = boardSize(street);
  switch (texture) {
    case 'dry':       return dryBoard(n);
    case 'wet':       return wetBoard(n);
    case 'monotone':  return monotoneBoard(n);
    case 'semi-wet':  return semiWetBoard(n);
    case 'paired':    return pairedBoard(n);
    case 'any':       return anyBoard(n);
  }
}
