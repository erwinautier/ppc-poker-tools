/**
 * Heads-up tournaments, two formats:
 *  - 'elimination': single elimination, pairings redrawn at random each round.
 *  - 'swiss': nobody is eliminated; each round pairs players with the same
 *    score (random inside a score group, no rematches). Fixed number of rounds,
 *    global ranking by points, Buchholz, head-to-head, Sonneborn-Berger, and an
 *    optional play-off HU for first place.
 *
 * Scoring rules (Swiss):
 *  - rules 1 (tournaments created before Nov 2026): bye = 1 point, Buchholz
 *    ignores the bye.
 *  - rules 2: bye = ½ point, and for Buchholz / Sonneborn-Berger the bye counts
 *    as a draw against a virtual opponent with the player's own score.
 */

export type Format = 'elimination' | 'swiss';
export type Rules = 1 | 2;
export interface Player { id: string; name: string }
export interface Match { id: string; a: string; b: string; winner: string | null }
export interface Round {
  n: number;
  matches: Match[];
  bye: string | null;
  /** Play-off for first place: not counted in points, only decides rank 1 vs 2. */
  playoff?: boolean;
}
export interface Tournament {
  id: string;
  name: string;
  format: Format;
  rules: Rules;
  /** Swiss only: number of regular rounds planned. */
  plannedRounds: number;
  createdAt: number;
  players: Player[];
  rounds: Round[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Default number of Swiss rounds: enough to leave a single undefeated player. */
export function suggestedRounds(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
}

export function byeValue(t: Tournament): number {
  return t.rules >= 2 ? 0.5 : 1;
}

export function createTournament(name: string, names: string[], format: Format, plannedRounds?: number): Tournament {
  const players = names.map(n => ({ id: uid(), name: n }));
  const t: Tournament = {
    id: uid(), name, format, rules: 2,
    plannedRounds: format === 'swiss' ? (plannedRounds ?? suggestedRounds(players.length)) : 0,
    createdAt: Date.now(), players, rounds: [],
  };
  t.rounds.push(drawRound(t, players.map(p => p.id)));
  return t;
}

/** Tournaments saved by older versions of the app. */
export function migrate(t: Tournament): Tournament {
  return { ...t, format: t.format ?? 'elimination', plannedRounds: t.plannedRounds ?? 0, rules: t.rules ?? 1 };
}

export const regularRounds = (t: Tournament) => t.rounds.filter(r => !r.playoff);
export const playoffRound  = (t: Tournament) => t.rounds.find(r => r.playoff) ?? null;

// ── Scores ────────────────────────────────────────────────────────────────────

export interface Standing {
  id: string;
  points: number;
  wins: number;
  losses: number;
  byes: number;
  /** Buchholz: sum of the opponents' points (bye = virtual opponent, rules 2). */
  buchholz: number;
  /** Sonneborn-Berger: sum of the points of the opponents beaten (+ half for a bye, rules 2). */
  sb: number;
  rank: number;
}

/** Points per player over completed regular matches (bye counts per the rules in Swiss). */
export function pointsMap(t: Tournament): Map<string, number> {
  const w = new Map<string, number>(t.players.map(p => [p.id, 0]));
  for (const r of regularRounds(t)) {
    for (const m of r.matches) if (m.winner) w.set(m.winner, (w.get(m.winner) ?? 0) + 1);
    if (r.bye && t.format === 'swiss') w.set(r.bye, (w.get(r.bye) ?? 0) + byeValue(t));
  }
  return w;
}

export interface Encounter {
  round: number;
  /** null = bye */
  opponent: string | null;
  /** 'W' | 'L' | null (not played yet), 'B' for a bye */
  result: 'W' | 'L' | 'B' | null;
  /** Points of the opponent (or of the virtual opponent for a bye) counted in Buchholz. */
  counted: number;
}

/** Round-by-round encounters of a player (regular rounds only). */
export function encounters(t: Tournament, id: string): Encounter[] {
  const pts = pointsMap(t);
  const own = pts.get(id) ?? 0;
  const out: Encounter[] = [];
  for (const r of regularRounds(t)) {
    if (r.bye === id) {
      out.push({ round: r.n, opponent: null, result: 'B', counted: t.rules >= 2 ? own : 0 });
      continue;
    }
    for (const m of r.matches) {
      if (m.a !== id && m.b !== id) continue;
      const opp = m.a === id ? m.b : m.a;
      out.push({ round: r.n, opponent: opp, result: m.winner ? (m.winner === id ? 'W' : 'L') : null, counted: pts.get(opp) ?? 0 });
    }
  }
  return out;
}

function headToHead(t: Tournament, a: string, b: string): number {
  let s = 0;
  for (const r of regularRounds(t)) for (const m of r.matches) {
    if (!m.winner) continue;
    if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) s += m.winner === a ? 1 : -1;
  }
  return s;
}

function playoffResult(t: Tournament, a: string, b: string): number {
  const p = playoffRound(t);
  const m = p?.matches[0];
  if (!m?.winner) return 0;
  if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) return m.winner === a ? 1 : -1;
  return 0;
}

export function standings(t: Tournament): Standing[] {
  const pts = pointsMap(t);
  const rows: Standing[] = t.players.map(p => {
    const enc = encounters(t, p.id);
    const own = pts.get(p.id) ?? 0;
    let wins = 0, losses = 0, byes = 0, buchholz = 0, sb = 0;
    for (const e of enc) {
      buchholz += e.counted;
      if (e.result === 'W') { wins++; sb += e.counted; }
      else if (e.result === 'L') losses++;
      else if (e.result === 'B') { byes++; if (t.rules >= 2) sb += own / 2; }
    }
    return { id: p.id, points: own, wins, losses, byes, buchholz, sb, rank: 0 };
  });

  const cmp = (x: Standing, y: Standing) =>
    y.points - x.points
    || y.buchholz - x.buchholz
    || playoffResult(t, y.id, x.id)
    || headToHead(t, y.id, x.id)
    || y.sb - x.sb;
  rows.sort(cmp);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && cmp(prev, r) === 0 ? prev.rank : i + 1;
  });
  return rows;
}

/** True when the two first players are tied on every criterion (and a play-off would settle it). */
export function needsPlayoff(t: Tournament): boolean {
  if (t.format !== 'swiss' || playoffRound(t)) return false;
  if (!regularFinished(t)) return false;
  const s = standings(t);
  return s.length >= 2 && s[0].rank === s[1].rank;
}

export function startPlayoff(t: Tournament): Tournament {
  if (!needsPlayoff(t)) return t;
  const [a, b] = standings(t);
  const round: Round = { n: t.rounds.length + 1, matches: [{ id: uid(), a: a.id, b: b.id, winner: null }], bye: null, playoff: true };
  return { ...t, rounds: [...t.rounds, round] };
}

// ── Pairing ───────────────────────────────────────────────────────────────────

export function drawRound(t: Tournament, ids: string[]): Round {
  return t.format === 'swiss' ? drawSwiss(t, ids) : drawRandom(t, ids);
}

function pickBye(t: Tournament, pool: string[]): string {
  const hadBye = new Set(t.rounds.map(r => r.bye).filter(Boolean));
  const candidates = pool.filter(id => !hadBye.has(id));
  return (candidates.length ? candidates : pool)[0];
}

function drawRandom(t: Tournament, ids: string[]): Round {
  let pool = shuffle(ids);
  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    bye = pickBye(t, pool);
    pool = pool.filter(id => id !== bye);
  }
  const matches: Match[] = [];
  for (let i = 0; i < pool.length; i += 2) matches.push({ id: uid(), a: pool[i], b: pool[i + 1], winner: null });
  return { n: t.rounds.length + 1, matches, bye };
}

function drawSwiss(t: Tournament, ids: string[]): Round {
  const pts = pointsMap(t);
  const played = new Set<string>();
  for (const r of t.rounds) for (const m of r.matches) { played.add(m.a + '|' + m.b); played.add(m.b + '|' + m.a); }

  // Order: by points desc, random inside a score group
  let pool = shuffle(ids).sort((a, b) => (pts.get(b) ?? 0) - (pts.get(a) ?? 0));

  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    // Bye goes to the lowest-ranked player who never had one
    bye = pickBye(t, [...pool].reverse());
    pool = pool.filter(id => id !== bye);
  }

  // Bounded backtracking for a matching without rematches, keeping the
  // score-ordered greedy preference; falls back to allowing rematches.
  let budget = 20_000;
  const tryMatch = (rest: string[], allowRematch: boolean): [string, string][] | null => {
    if (rest.length === 0) return [];
    if (--budget < 0) return null;
    const [first, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      const cand = others[i];
      if (!allowRematch && played.has(first + '|' + cand)) continue;
      const remaining = others.filter((_, j) => j !== i);
      const sub = tryMatch(remaining, allowRematch);
      if (sub) return [[first, cand], ...sub];
      if (budget < 0) return null;
    }
    return null;
  };
  const pairs = tryMatch(pool, false) ?? (budget = 1e9, tryMatch(pool, true)) ?? [];
  const matches: Match[] = pairs.map(([a, b]) => ({ id: uid(), a, b, winner: null }));
  return { n: t.rounds.length + 1, matches, bye };
}

// ── State helpers ─────────────────────────────────────────────────────────────

export function currentRound(t: Tournament): Round | null {
  return t.rounds[t.rounds.length - 1] ?? null;
}

export function roundComplete(r: Round): boolean {
  return r.matches.every(m => m.winner !== null);
}

/** Elimination: players still alive after a (complete) round. */
export function survivors(r: Round): string[] {
  const s = r.matches.map(m => m.winner!).filter(Boolean);
  if (r.bye) s.push(r.bye);
  return s;
}

/** Swiss: all planned regular rounds played. */
function regularFinished(t: Tournament): boolean {
  const reg = regularRounds(t);
  return reg.length >= t.plannedRounds && reg.every(roundComplete);
}

/** True when the tournament is over (including a pending play-off). */
export function finished(t: Tournament): boolean {
  const r = currentRound(t);
  if (!r || !roundComplete(r)) return false;
  if (t.format === 'swiss') return regularFinished(t);
  return survivors(r).length === 1;
}

/** Winner id when the tournament is over (Swiss: first of the standings). */
export function champion(t: Tournament): string | null {
  if (!finished(t)) return null;
  if (t.format === 'swiss') return needsPlayoff(t) ? null : standings(t)[0]?.id ?? null;
  return survivors(currentRound(t)!)[0] ?? null;
}

/** Elimination only. */
export function eliminated(t: Tournament): { id: string; round: number }[] {
  if (t.format !== 'elimination') return [];
  const out: { id: string; round: number }[] = [];
  for (const r of t.rounds) for (const m of r.matches) {
    if (m.winner) out.push({ id: m.winner === m.a ? m.b : m.a, round: r.n });
  }
  return out;
}

export function setWinner(t: Tournament, matchId: string, winner: string | null): Tournament {
  const rounds = t.rounds.map(r => ({ ...r, matches: r.matches.map(m => (m.id === matchId ? { ...m, winner } : m)) }));
  return { ...t, rounds };
}

export function nextRound(t: Tournament): Tournament {
  const r = currentRound(t);
  if (!r || !roundComplete(r) || r.playoff) return t;
  if (t.format === 'swiss' && regularRounds(t).length >= t.plannedRounds) return t;
  const ids = t.format === 'swiss' ? t.players.map(p => p.id) : survivors(r);
  if (ids.length < 2) return t;
  return { ...t, rounds: [...t.rounds, drawRound(t, ids)] };
}

/** Swiss: plan one more regular round (then draw it). Not available once a play-off exists. */
export function addRound(t: Tournament): Tournament {
  if (t.format !== 'swiss' || playoffRound(t)) return t;
  return nextRound({ ...t, plannedRounds: t.plannedRounds + 1 });
}

export function cancelLastRound(t: Tournament): Tournament {
  if (t.rounds.length <= 1) return t;
  return { ...t, rounds: t.rounds.slice(0, -1) };
}

export function redrawCurrentRound(t: Tournament): Tournament {
  const r = currentRound(t);
  if (!r || r.playoff) return t;
  const ids = [...r.matches.flatMap(m => [m.a, m.b]), ...(r.bye ? [r.bye] : [])];
  const base = { ...t, rounds: t.rounds.slice(0, -1) };
  return { ...base, rounds: [...base.rounds, drawRound(base, ids)] };
}

export function roundLabel(t: Tournament, r: Round, playersLeft: number): string {
  if (r.playoff) return 'Barrage pour la 1re place';
  if (t.format === 'swiss') return `${r.n} / ${t.plannedRounds}`;
  if (playersLeft === 2) return 'Finale';
  if (playersLeft <= 4) return 'Demi-finales';
  if (playersLeft === 8) return 'Quarts de finale';
  return '';
}

/** "3", "3½", "½" */
export function fmtPoints(p: number): string {
  const whole = Math.floor(p);
  const half = p - whole >= 0.5;
  if (whole === 0 && half) return '½';
  return `${whole}${half ? '½' : ''}`;
}

export const FORMAT_LABEL: Record<Format, string> = {
  elimination: 'Élimination directe',
  swiss: 'Ronde suisse',
};

// ── Storage ───────────────────────────────────────────────────────────────────

const LS_KEY = 'hu-tournaments-v1';

export function loadTournaments(): Tournament[] {
  try { return (JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as Tournament[]).map(migrate); } catch { return []; }
}
export function saveTournaments(list: Tournament[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
