/** Single-elimination heads-up tournament, pairings redrawn at random each round. */

export interface Player { id: string; name: string }
export interface Match { id: string; a: string; b: string; winner: string | null }
export interface Round { n: number; matches: Match[]; bye: string | null }
export interface Tournament {
  id: string;
  name: string;
  createdAt: number;
  players: Player[];
  rounds: Round[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function createTournament(name: string, names: string[]): Tournament {
  const players = names.map(n => ({ id: uid(), name: n }));
  const t: Tournament = { id: uid(), name, createdAt: Date.now(), players, rounds: [] };
  t.rounds.push(drawRound(t, players.map(p => p.id)));
  return t;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw a round among the given player ids. With an odd count, one player gets a bye (preferring those who never had one). */
export function drawRound(t: Tournament, ids: string[]): Round {
  let pool = shuffle(ids);
  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    const hadBye = new Set(t.rounds.map(r => r.bye).filter(Boolean));
    const candidates = pool.filter(id => !hadBye.has(id));
    bye = (candidates.length ? candidates : pool)[0];
    pool = pool.filter(id => id !== bye);
  }
  const matches: Match[] = [];
  for (let i = 0; i < pool.length; i += 2) matches.push({ id: uid(), a: pool[i], b: pool[i + 1], winner: null });
  return { n: t.rounds.length + 1, matches, bye };
}

export function currentRound(t: Tournament): Round | null {
  return t.rounds[t.rounds.length - 1] ?? null;
}

export function roundComplete(r: Round): boolean {
  return r.matches.every(m => m.winner !== null);
}

/** Players still alive after a (complete) round. */
export function survivors(r: Round): string[] {
  const s = r.matches.map(m => m.winner!).filter(Boolean);
  if (r.bye) s.push(r.bye);
  return s;
}

export function champion(t: Tournament): string | null {
  const r = currentRound(t);
  if (!r || !roundComplete(r)) return null;
  const s = survivors(r);
  return s.length === 1 ? s[0] : null;
}

export function eliminated(t: Tournament): { id: string; round: number }[] {
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
  const s = survivors(r);
  if (s.length < 2) return t;
  return { ...t, rounds: [...t.rounds, drawRound(t, s)] };
}

/** Drop the last round (only if it has no result yet, or is the only round). */
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

export function roundLabel(playersLeft: number): string {
  if (playersLeft === 2) return 'Finale';
  if (playersLeft <= 4) return 'Demi-finales';
  if (playersLeft === 8) return 'Quarts de finale';
  return '';
}

// ── Storage ───────────────────────────────────────────────────────────────────

const LS_KEY = 'hu-tournaments-v1';

export function loadTournaments(): Tournament[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
export function saveTournaments(list: Tournament[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
