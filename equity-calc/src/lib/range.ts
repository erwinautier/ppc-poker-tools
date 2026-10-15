import { RANK_CHARS, RANKS_DESC } from './cards';

/** The 169 hand labels in default strength order (all-in equity vs. a random hand). */
export const HAND_ORDER: string[] = (
  'AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo ATs AQo AJo KQs 66 A9s ATo KJs A8s KTs KQo A7s A9o KJo 55 ' +
  'QJs K9s A5s A6s A8o KTo QTs A4s A7o K8s A3s QJo K9o A5o A6o Q9s K7s JTs A2s QTo 44 A4o K6s K8o Q8s ' +
  'A3o K5s J9s Q9o JTo K7o A2o K4s Q7s K6o K3s T9s J8s 33 Q6s Q8o K5o J9o K2s Q5s T8s K4o J7s Q4s Q7o ' +
  'T9o J8o K3o Q6o Q3s 98s T7s J6s K2o 22 Q2s Q5o J5s T8o J7o Q4o 97s J4s T6s J3s Q3o 98o 87s T7o J6o ' +
  '96s J2s Q2o T5s J5o T4s 97o 86s J4o T6o 95s T3s 76s J3o 87o T2s 85s 96o J2o T5o 94s 75s T4o 65s 86o ' +
  '93s 84s 95o T3o 76o 92s 74s 54s T2o 85o 64s 83s 94o 75o 82s 73s 93o 65o 53s 63s 84o 92o 43s 74o 72s ' +
  '54o 64o 52s 62s 83o 42s 82o 73o 53o 63o 32s 43o 72o 52o 62o 42o 32o'
).split(' ');

/** Grid order: row = first rank, col = second rank, suited above the diagonal. */
export function cellToHand(row: number, col: number): string {
  if (row === col) return RANKS_DESC[row] + RANKS_DESC[col];
  if (row < col) return RANKS_DESC[row] + RANKS_DESC[col] + 's';
  return RANKS_DESC[col] + RANKS_DESC[row] + 'o';
}

export const ALL_HANDS: string[] = (() => {
  const s = new Set<string>();
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) s.add(cellToHand(r, c));
  return [...s];
})();

// Safety net: any hand missing from HAND_ORDER goes to the end.
for (const h of ALL_HANDS) if (!HAND_ORDER.includes(h)) HAND_ORDER.push(h);

export function combosCount(hand: string): number {
  if (hand.length === 2) return 6;
  return hand[2] === 's' ? 4 : 12;
}

export const TOTAL_COMBOS = 1326;

export function rangeCombos(range: Set<string>): number {
  let n = 0;
  for (const h of range) n += combosCount(h);
  return n;
}

/** Top X% of hands (by combos) following HAND_ORDER. */
export function topPercent(pct: number): Set<string> {
  const target = (pct / 100) * TOTAL_COMBOS;
  const out = new Set<string>();
  let acc = 0;
  for (const h of HAND_ORDER) {
    if (acc >= target - 1e-9) break;
    out.add(h);
    acc += combosCount(h);
  }
  return out;
}

/** Position of the weakest selected hand in HAND_ORDER, as a % of combos (what "R" shows). */
export function rangeRankPercent(range: Set<string>): number {
  if (range.size === 0) return 0;
  let acc = 0, last = 0;
  for (const h of HAND_ORDER) {
    acc += combosCount(h);
    if (range.has(h)) last = acc;
  }
  return (last / TOTAL_COMBOS) * 100;
}

// ── Parsing ───────────────────────────────────────────────────────────────────

const ri = (c: string) => RANK_CHARS.indexOf(c.toUpperCase());
const rc = (i: number) => RANK_CHARS[i];

function normalizeHand(tok: string): { hi: number; lo: number; suf: '' | 's' | 'o' } | null {
  const m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)$/i);
  if (!m) return null;
  let hi = ri(m[1]), lo = ri(m[2]);
  if (hi < lo) [hi, lo] = [lo, hi];
  const suf = m[3].toLowerCase() as '' | 's' | 'o';
  if (hi === lo && suf) return null;
  return { hi, lo, suf };
}

function emit(out: Set<string>, hi: number, lo: number, suf: '' | 's' | 'o') {
  if (hi === lo) { out.add(rc(hi) + rc(lo)); return; }
  if (suf === '' || suf === 's') out.add(rc(hi) + rc(lo) + 's');
  if (suf === '' || suf === 'o') out.add(rc(hi) + rc(lo) + 'o');
}

/**
 * Parse a range string: "AA, KK, AKs, T5o+, 96s-, 66-99, A2s-A5s, 22+, QJ".
 * Returns the hand set and the list of tokens it could not understand.
 */
export function parseRange(text: string): { range: Set<string>; errors: string[] } {
  const out = new Set<string>();
  const errors: string[] = [];
  const tokens = text.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);

  for (const tok of tokens) {
    // X-Y range
    const dash = tok.match(/^([2-9TJQKA]{2}[so]?)-([2-9TJQKA]{2}[so]?)$/i);
    if (dash) {
      const a = normalizeHand(dash[1]), b = normalizeHand(dash[2]);
      if (!a || !b) { errors.push(tok); continue; }
      if (a.hi === a.lo && b.hi === b.lo) {
        for (let r = Math.min(a.hi, b.hi); r <= Math.max(a.hi, b.hi); r++) emit(out, r, r, '');
        continue;
      }
      if (a.hi === b.hi && a.suf === b.suf) {
        for (let r = Math.min(a.lo, b.lo); r <= Math.max(a.lo, b.lo); r++) emit(out, a.hi, r, a.suf);
        continue;
      }
      errors.push(tok); continue;
    }

    // X+ / X-
    const pm = tok.match(/^([2-9TJQKA]{2}[so]?)([+-])$/i);
    if (pm) {
      const h = normalizeHand(pm[1]);
      if (!h) { errors.push(tok); continue; }
      const up = pm[2] === '+';
      if (h.hi === h.lo) {
        if (up) for (let r = h.hi; r <= 12; r++) emit(out, r, r, '');
        else    for (let r = h.hi; r >= 0;  r--) emit(out, r, r, '');
      } else {
        if (up) for (let r = h.lo; r < h.hi; r++) emit(out, h.hi, r, h.suf);
        else    for (let r = h.lo; r >= 0;  r--) emit(out, h.hi, r, h.suf);
      }
      continue;
    }

    const h = normalizeHand(tok);
    if (!h) { errors.push(tok); continue; }
    emit(out, h.hi, h.lo, h.suf);
  }
  return { range: out, errors };
}

// ── Serialization (compact string) ────────────────────────────────────────────

export function serializeRange(range: Set<string>): string {
  const parts: string[] = [];

  // Pairs
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) if (range.has(rc(r) + rc(r))) pairs.push(r);
  for (const run of runs(pairs)) {
    const [top, bot] = [run[0], run[run.length - 1]];
    if (top === bot) parts.push(rc(top) + rc(top));
    else if (top === 12) parts.push(rc(bot) + rc(bot) + '+');
    else parts.push(rc(bot) + rc(bot) + '-' + rc(top) + rc(top));
  }

  // Non-pairs, per high rank, suited then offsuit
  for (let hi = 12; hi >= 1; hi--) {
    for (const suf of ['s', 'o'] as const) {
      const los: number[] = [];
      for (let lo = hi - 1; lo >= 0; lo--) if (range.has(rc(hi) + rc(lo) + suf)) los.push(lo);
      for (const run of runs(los)) {
        const [top, bot] = [run[0], run[run.length - 1]];
        const H = rc(hi);
        if (top === bot) parts.push(H + rc(top) + suf);
        else if (top === hi - 1) parts.push(H + rc(bot) + suf + '+');
        else if (bot === 0) parts.push(H + rc(top) + suf + '-');
        else parts.push(H + rc(top) + suf + '-' + H + rc(bot) + suf);
      }
    }
  }
  return parts.join(', ');
}

/** Split a descending list of ints into runs of consecutive values. */
function runs(desc: number[]): number[][] {
  const out: number[][] = [];
  for (const v of desc) {
    const last = out[out.length - 1];
    if (last && last[last.length - 1] === v + 1) last.push(v);
    else out.push([v]);
  }
  return out;
}
