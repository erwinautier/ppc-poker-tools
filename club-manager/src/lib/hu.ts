/**
 * Tournoi heads-up, repris de l'appli /tournoi, deux systèmes :
 *  - élimination directe : nouveau tirage au hasard à chaque tour, le perdant sort ;
 *  - ronde suisse : personne ne sort ; chaque tour oppose des joueurs au même score
 *    (au hasard dans un groupe de score, sans revanche), en un nombre de tours fixé.
 *    Classement aux points, puis Buchholz, barrage ou confrontation directe, puis
 *    Sonneborn-Berger. Exemption = ½ point, comptée comme un nul contre un
 *    adversaire virtuel de même score.
 *
 * Les matchs sont des lignes de club_hu_matches ; un joueur sans adversaire est exempté.
 */
import type { ResultRow } from './engine';
import type { HuMatch, HuSystem, Settings } from './types';

export interface Pair { a: string; b: string | null }
export interface Duel { id: string; a: string; b: string; winner: string | null }
export interface HuRound { n: number; matches: Duel[]; bye: string | null; playoff: boolean }
export interface Board {
  system: HuSystem;
  /** Ronde suisse : tours prévus (hors barrage). */
  planned: number;
  /** Tous les joueurs classés : pointés, ou déjà apparus dans un tour. */
  players: string[];
  /** Joueurs pointés, à apparier au prochain tour de ronde suisse. */
  active: string[];
  rounds: HuRound[];
}

export const BYE_POINTS = 0.5;

/** Ronde suisse : assez de tours pour qu'il ne reste qu'un joueur invaincu. */
export function suggestedRounds(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
}

export function boardOf(settings: Pick<Settings, 'hu'>, active: string[], rows: HuMatch[]): Board {
  const byRound = new Map<number, HuMatch[]>();
  for (const m of rows) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
  const rounds: HuRound[] = [...byRound].sort((x, y) => x[0] - y[0]).map(([n, list]) => ({
    n,
    playoff: list.some(m => m.playoff),
    bye: list.find(m => m.b === null)?.a ?? null,
    matches: list.filter(m => m.b !== null).sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id))
      .map(m => ({ id: m.id, a: m.a, b: m.b!, winner: m.winner })),
  }));
  const seen = rounds.flatMap(r => [...r.matches.flatMap(m => [m.a, m.b]), ...(r.bye ? [r.bye] : [])]);
  const players = [...new Set([...active, ...seen])];
  const system = settings.hu.system;
  return { system, planned: system === 'swiss' ? settings.hu.rounds || suggestedRounds(players.length) : 0, players, active, rounds };
}

export const regularRounds = (b: Board) => b.rounds.filter(r => !r.playoff);
export const playoffRound = (b: Board) => b.rounds.find(r => r.playoff) ?? null;
export const currentRound = (b: Board): HuRound | null => b.rounds.at(-1) ?? null;
export const roundComplete = (r: HuRound) => r.matches.every(m => m.winner !== null);

/** Élimination : joueurs encore en lice après un tour (vainqueurs et exempté). */
export function survivors(r: HuRound): string[] {
  const s = r.matches.map(m => m.winner).filter((x): x is string => !!x);
  if (r.bye) s.push(r.bye);
  return s;
}

// ── Points et classement (ronde suisse) ──────────────────────────────────────

export function pointsMap(b: Board): Map<string, number> {
  const w = new Map<string, number>(b.players.map(p => [p, 0]));
  for (const r of regularRounds(b)) {
    for (const m of r.matches) if (m.winner) w.set(m.winner, (w.get(m.winner) ?? 0) + 1);
    if (r.bye && b.system === 'swiss') w.set(r.bye, (w.get(r.bye) ?? 0) + BYE_POINTS);
  }
  return w;
}

export interface Encounter {
  round: number;
  /** null : exempté. */
  opponent: string | null;
  result: 'W' | 'L' | 'B' | null;
  /** Points de l'adversaire (ou de l'adversaire virtuel d'une exemption) comptés dans le Buchholz. */
  counted: number;
}

export function encounters(b: Board, id: string): Encounter[] {
  const pts = pointsMap(b);
  const own = pts.get(id) ?? 0;
  const out: Encounter[] = [];
  for (const r of regularRounds(b)) {
    if (r.bye === id) { out.push({ round: r.n, opponent: null, result: 'B', counted: own }); continue; }
    for (const m of r.matches) {
      if (m.a !== id && m.b !== id) continue;
      const opp = m.a === id ? m.b : m.a;
      out.push({ round: r.n, opponent: opp, result: m.winner ? (m.winner === id ? 'W' : 'L') : null, counted: pts.get(opp) ?? 0 });
    }
  }
  return out;
}

const duelResult = (rounds: HuRound[], a: string, b: string) => {
  let s = 0;
  for (const r of rounds) for (const m of r.matches) {
    if (!m.winner) continue;
    if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) s += m.winner === a ? 1 : -1;
  }
  return s;
};

export interface Standing { id: string; points: number; wins: number; losses: number; byes: number; buchholz: number; sb: number; rank: number }

export function standings(b: Board): Standing[] {
  const pts = pointsMap(b);
  const playoff = playoffRound(b);
  const rows: Standing[] = b.players.map(id => {
    const own = pts.get(id) ?? 0;
    let wins = 0, losses = 0, byes = 0, buchholz = 0, sb = 0;
    for (const e of encounters(b, id)) {
      buchholz += e.counted;
      if (e.result === 'W') { wins++; sb += e.counted; }
      else if (e.result === 'L') losses++;
      else if (e.result === 'B') { byes++; sb += own / 2; }
    }
    return { id, points: own, wins, losses, byes, buchholz, sb, rank: 0 };
  });
  const cmp = (x: Standing, y: Standing) =>
    y.points - x.points
    || y.buchholz - x.buchholz
    || (playoff ? duelResult([playoff], y.id, x.id) : 0)
    || duelResult(regularRounds(b), y.id, x.id)
    || y.sb - x.sb;
  rows.sort(cmp);
  rows.forEach((r, i) => { const prev = rows[i - 1]; r.rank = prev && cmp(prev, r) === 0 ? prev.rank : i + 1; });
  return rows;
}

function regularFinished(b: Board): boolean {
  const reg = regularRounds(b);
  return reg.length >= b.planned && reg.every(roundComplete);
}

/** Ronde suisse finie, les deux premiers à égalité parfaite : un barrage les départage. */
export function needsPlayoff(b: Board): boolean {
  if (b.system !== 'swiss' || playoffRound(b) || !regularFinished(b)) return false;
  const s = standings(b);
  return s.length >= 2 && s[0].rank === s[1].rank;
}

export function playoffPairs(b: Board): Pair[] {
  const [x, y] = standings(b);
  return [{ a: x.id, b: y.id }];
}

// ── Déroulé ──────────────────────────────────────────────────────────────────

/** Tout est joué, barrage éventuel compris. */
export function finished(b: Board): boolean {
  const r = currentRound(b);
  if (!r || !roundComplete(r)) return false;
  if (b.system === 'swiss') return regularFinished(b);
  return survivors(r).length === 1;
}

/** Vainqueur, une fois tout joué (ronde suisse : premier du classement, barrage tranché). */
export function champion(b: Board): string | null {
  if (!finished(b)) return null;
  if (b.system === 'swiss') return needsPlayoff(b) ? null : standings(b)[0]?.id ?? null;
  return survivors(currentRound(b)!)[0] ?? null;
}

/** Joueurs à apparier au tour suivant ; null s'il n'y a pas de tour à tirer maintenant. */
export function nextIds(b: Board): string[] | null {
  const r = currentRound(b);
  if (!r) return b.active.length >= 2 ? b.active : null;
  if (!roundComplete(r) || r.playoff || finished(b)) return null;
  const ids = b.system === 'swiss' ? b.active : survivors(r);
  return ids.length >= 2 ? ids : null;
}

/** Élimination : qui est sorti, et à quel tour. */
export function eliminated(b: Board): { id: string; round: number }[] {
  if (b.system !== 'elimination') return [];
  return b.rounds.flatMap(r => r.matches.filter(m => m.winner).map(m => ({ id: m.winner === m.a ? m.b : m.a, round: r.n })));
}

/** Joueurs encore en lice : tous en ronde suisse. */
export function inPlay(b: Board): string[] {
  if (b.system === 'swiss') return b.players;
  const out = new Set(eliminated(b).map(x => x.id));
  const r = currentRound(b);
  const field = r ? [...r.matches.flatMap(m => [m.a, m.b]), ...(r.bye ? [r.bye] : [])] : b.players;
  return field.filter(id => !out.has(id));
}

export interface HuRecord { wins: number; losses: number; byes: number }
export function recordOf(b: Board, id: string): HuRecord {
  const rec = { wins: 0, losses: 0, byes: 0 };
  for (const r of b.rounds) {
    if (r.bye === id) rec.byes++;
    for (const m of r.matches) if (m.winner && (m.a === id || m.b === id)) { if (m.winner === id) rec.wins++; else rec.losses++; }
  }
  return rec;
}

/** Le match (ou l'exemption) d'un joueur dans le dernier tour. */
export function currentDuel(b: Board, id: string): { round: HuRound; duel: Duel | null } | null {
  const r = currentRound(b);
  if (!r) return null;
  if (r.bye === id) return { round: r, duel: null };
  const duel = r.matches.find(m => m.a === id || m.b === id);
  return duel ? { round: r, duel } : null;
}

/**
 * Classement final, quand tout est joué. Élimination : les perdants d'un même tour
 * sont ex æquo, derrière les joueurs encore en lice après ce tour.
 */
export function huResults(b: Board): ResultRow[] | null {
  const champ = champion(b);
  if (!champ) return null;
  const known = knownPlaces(b);
  return [...known].map(([entry_id, position]) => ({ entry_id, position, kos: 0, bounty: 0 })).sort((x, y) => x.position - y.position);
}

/**
 * Places déjà connues, pour arrêter un tournoi avant la fin. Élimination : celles des
 * joueurs sortis (et du vainqueur) ; ronde suisse : le classement du moment.
 */
export function knownPlaces(b: Board): Map<string, number> {
  if (b.system === 'swiss') return new Map(standings(b).map(s => [s.id, s.rank]));
  const out = new Map<string, number>();
  const champ = champion(b);
  if (champ) out.set(champ, 1);
  for (const r of b.rounds) {
    // Après ce tour restent les vainqueurs et l'exempté : un par match, plus un.
    const left = r.matches.length + (r.bye ? 1 : 0);
    for (const m of r.matches) if (m.winner) out.set(m.winner === m.a ? m.b : m.a, left + 1);
  }
  return out;
}

// ── Tirage ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Exemption : en priorité à qui n'en a jamais eu. */
function pickBye(b: Board, pool: string[]): string {
  const had = new Set(b.rounds.map(r => r.bye).filter(Boolean));
  return pool.find(id => !had.has(id)) ?? pool[0];
}

export function drawPairs(b: Board, ids: string[], rnd: () => number = Math.random): Pair[] {
  return b.system === 'swiss' ? drawSwiss(b, ids, rnd) : drawRandom(b, ids, rnd);
}

function drawRandom(b: Board, ids: string[], rnd: () => number): Pair[] {
  let pool = shuffle(ids, rnd);
  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    bye = pickBye(b, pool);
    pool = pool.filter(id => id !== bye);
  }
  const out: Pair[] = [];
  for (let i = 0; i < pool.length; i += 2) out.push({ a: pool[i], b: pool[i + 1] });
  if (bye) out.push({ a: bye, b: null });
  return out;
}

function drawSwiss(b: Board, ids: string[], rnd: () => number): Pair[] {
  const pts = pointsMap(b);
  const played = new Set<string>();
  for (const r of b.rounds) for (const m of r.matches) { played.add(`${m.a}|${m.b}`); played.add(`${m.b}|${m.a}`); }

  // Par points décroissants, au hasard dans un groupe de score.
  let pool = shuffle(ids, rnd).sort((x, y) => (pts.get(y) ?? 0) - (pts.get(x) ?? 0));
  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    // L'exemption va au moins bien classé qui n'en a jamais eu.
    bye = pickBye(b, [...pool].reverse());
    pool = pool.filter(id => id !== bye);
  }

  // Recherche bornée d'appariements sans revanche, en gardant l'ordre des scores ;
  // à défaut, on accepte une revanche.
  let budget = 20_000;
  const tryMatch = (rest: string[], rematch: boolean): [string, string][] | null => {
    if (rest.length === 0) return [];
    if (--budget < 0) return null;
    const [first, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      if (!rematch && played.has(`${first}|${others[i]}`)) continue;
      const sub = tryMatch(others.filter((_, j) => j !== i), rematch);
      if (sub) return [[first, others[i]], ...sub];
      if (budget < 0) return null;
    }
    return null;
  };
  const found = tryMatch(pool, false) ?? (budget = 1e9, tryMatch(pool, true)) ?? [];
  const out: Pair[] = found.map(([a, c]) => ({ a, b: c }));
  if (bye) out.push({ a: bye, b: null });
  return out;
}

/** Ce qui suit « Tour n » : « sur 4 » en ronde suisse, l'étape en élimination directe. */
export function roundLabel(b: Board, r: HuRound): string {
  if (r.playoff) return '';
  if (b.system === 'swiss') return `sur ${b.planned}`;
  const left = r.matches.length * 2 + (r.bye ? 1 : 0);
  if (left === 2) return 'Finale';
  if (left <= 4) return 'Demi-finales';
  if (left <= 8) return 'Quarts de finale';
  return '';
}

/** « 3 », « 3½ », « ½ ». */
export function fmtPoints(p: number): string {
  const whole = Math.floor(p);
  const half = p - whole >= 0.5;
  if (whole === 0 && half) return '½';
  return `${whole}${half ? '½' : ''}`;
}
