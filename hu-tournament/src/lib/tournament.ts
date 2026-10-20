/**
 * Heads-up tournaments, two formats:
 *  - 'elimination': single elimination, pairings redrawn at random each round.
 *  - 'swiss': nobody is eliminated; each round pairs players with the same
 *    number of wins (random inside a score group, no rematches). Fixed number
 *    of rounds, global ranking by wins then Buchholz then head-to-head.
 */

export type Format = 'elimination' | 'swiss';
export interface Player { id: string; name: string }
export interface Match { id: string; a: string; b: string; winner: string | null }
export interface Round { n: number; matches: Match[]; bye: string | null }
export interface Tournament {
  id: string;
  name: string;
  format: Format;
  /** Swiss only: number of rounds planned. */
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

export function createTournament(name: string, names: string[], format: Format, plannedRounds?: number): Tournament {
  const players = names.map(n => ({ id: uid(), name: n }));
  const t: Tournament = {
    id: uid(), name, format,
    plannedRounds: format === 'swiss' ? (plannedRounds ?? suggestedRounds(players.length)) : 0,
    createdAt: Date.now(), players, rounds: [],
  };
  t.rounds.push(drawRound(t, players.map(p => p.id)));
  return t;
}

/** Old tournaments saved before the format field existed. */
export function migrate(t: Tournament): Tournament {
  return { ...t, format: t.format ?? 'elimination', plannedRounds: t.plannedRounds ?? 0 };
}

// ── Scores ────────────────────────────────────────────────────────────────────

export interface Standing {
  id: string;
  wins: number;
  losses: number;
  /** Sum of the wins of the opponents met (bye excluded). */
  buchholz: number;
  rank: number;
}

/** Wins per player over completed matches (bye counts as a win in Swiss). */
export function winsMap(t: Tournament): Map<string, number> {
  const w = new Map<string, number>(t.players.map(p => [p.id, 0]));
  for (const r of t.rounds) {
    for (const m of r.matches) if (m.winner) w.set(m.winner, (w.get(m.winner) ?? 0) + 1);
    if (r.bye && t.format === 'swiss') w.set(r.bye, (w.get(r.bye) ?? 0) + 1);
  }
  return w;
}

function opponents(t: Tournament, id: string): string[] {
  const out: string[] = [];
  for (const r of t.rounds) for (const m of r.matches) {
    if (m.a === id) out.push(m.b);
    else if (m.b === id) out.push(m.a);
  }
  return out;
}

function headToHead(t: Tournament, a: string, b: string): number {
  let s = 0;
  for (const r of t.rounds) for (const m of r.matches) {
    if (!m.winner) continue;
    if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) s += m.winner === a ? 1 : -1;
  }
  return s;
}

export function standings(t: Tournament): Standing[] {
  const wins = winsMap(t);
  const rows: Standing[] = t.players.map(p => {
    let losses = 0;
    for (const r of t.rounds) for (const m of r.matches) {
      if (m.winner && m.winner !== p.id && (m.a === p.id || m.b === p.id)) losses++;
    }
    const buchholz = opponents(t, p.id).reduce((s, o) => s + (wins.get(o) ?? 0), 0);
    return { id: p.id, wins: wins.get(p.id) ?? 0, losses, buchholz, rank: 0 };
  });
  rows.sort((x, y) => y.wins - x.wins || y.buchholz - x.buchholz || headToHead(t, y.id, x.id) || 0);
  // Shared ranks for exact ties
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.wins === r.wins && prev.buchholz === r.buchholz && headToHead(t, prev.id, r.id) === 0 ? prev.rank : i + 1;
  });
  return rows;
}

// ── Pairing ───────────────────────────────────────────────────────────────────

/** Draw a round among the given player ids, according to the tournament format. */
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
  const wins = winsMap(t);
  const played = new Set<string>();
  for (const r of t.rounds) for (const m of r.matches) { played.add(m.a + '|' + m.b); played.add(m.b + '|' + m.a); }

  // Order: by wins desc, random inside a score group
  let pool = shuffle(ids).sort((a, b) => (wins.get(b) ?? 0) - (wins.get(a) ?? 0));

  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    // Bye goes to the lowest-ranked player who never had one
    bye = pickBye(t, [...pool].reverse());
    pool = pool.filter(id => id !== bye);
  }

  // Backtracking search for a perfect matching without rematches, keeping the
  // score-ordered greedy preference. Falls back to allowing rematches if needed.
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

/** True when the tournament is over. */
export function finished(t: Tournament): boolean {
  const r = currentRound(t);
  if (!r || !roundComplete(r)) return false;
  if (t.format === 'swiss') return t.rounds.length >= t.plannedRounds;
  return survivors(r).length === 1;
}

/** Winner id when the tournament is over (Swiss: first of the standings). */
export function champion(t: Tournament): string | null {
  if (!finished(t)) return null;
  if (t.format === 'swiss') return standings(t)[0]?.id ?? null;
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
  if (!r || !roundComplete(r)) return t;
  if (t.format === 'swiss' && t.rounds.length >= t.plannedRounds) return t;
  const ids = t.format === 'swiss' ? t.players.map(p => p.id) : survivors(r);
  if (ids.length < 2) return t;
  return { ...t, rounds: [...t.rounds, drawRound(t, ids)] };
}

/** Swiss: plan one more round (then draw it). */
export function addRound(t: Tournament): Tournament {
  if (t.format !== 'swiss') return t;
  return nextRound({ ...t, plannedRounds: t.plannedRounds + 1 });
}

export function cancelLastRound(t: Tournament): Tournament {
  if (t.rounds.length <= 1) return t;
  return { ...t, rounds: t.rounds.slice(0, -1) };
}

export function redrawCurrentRound(t: Tournament): Tournament {
  const r = currentRound(t);
  if (!r) return t;
  const ids = [...r.matches.flatMap(m => [m.a, m.b]), ...(r.bye ? [r.bye] : [])];
  const base = { ...t, rounds: t.rounds.slice(0, -1) };
  return { ...base, rounds: [...base.rounds, drawRound(base, ids)] };
}

export function roundLabel(t: Tournament, playersLeft: number): string {
  if (t.format === 'swiss') return `${t.rounds.length} / ${t.plannedRounds}`;
  if (playersLeft === 2) return 'Finale';
  if (playersLeft <= 4) return 'Demi-finales';
  if (playersLeft === 8) return 'Quarts de finale';
  return '';
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
