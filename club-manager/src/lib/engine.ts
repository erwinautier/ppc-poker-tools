/**
 * Déroulé d'un tournoi : tout (places, KO, primes) se rejoue depuis le journal
 * des éliminations. Annuler une élimination = retirer une ligne du journal.
 *
 * Un MTT a un seul classement. En Sit'N Go, chaque table a le sien : on y est
 * classé parmi les joueurs de sa table, d'après la table où l'on est assis.
 */
import type { Entry, Knockout, Settings, Tournament } from './types';

export interface PlayerState {
  entry: Entry;
  alive: boolean;
  /** Place finale, connue dès l'élimination ; null tant que le joueur est en course. */
  position: number | null;
  /** Nombre de KO (un KO partagé à deux compte ½ chacun). */
  kos: number;
  /** Primes gagnées. */
  bountyWon: number;
  /** Prime actuellement sur la tête du joueur. */
  head: number;
  /** Dernière élimination subie. */
  killedBy: string[];
}

/** Joueurs classés ensemble : tout le tournoi (MTT) ou une table (Sit'N Go). */
export interface Ranking {
  /** Sit'N Go : numéro de la table ; null pour un MTT ou des joueurs sans place. */
  table: number | null;
  total: number;
  alive: PlayerState[];
  /** Éliminés, du dernier sorti au premier. */
  out: PlayerState[];
}

export interface Replay {
  players: PlayerState[];
  byId: Map<string, PlayerState>;
  alive: PlayerState[];
  /** Éliminés, du dernier sorti au premier. */
  out: PlayerState[];
  total: number;
  /** Primes perdues faute de tombeur (abandon). */
  unclaimed: number;
  /** Un seul classement pour un MTT, un par table en Sit'N Go. */
  rankings: Ranking[];
  rankingOf: (entryId: string) => Ranking;
  /** Tout est joué : un seul joueur en course, ou un par table en Sit'N Go. */
  done: boolean;
}

export const isSng = (s: Pick<Settings, 'format'>) => s.format === 'sng';

/** Le classement dont relève un joueur. */
export function rankingKey(s: Pick<Settings, 'format'>, e: Pick<Entry, 'table_no'>): number | null {
  return isSng(s) ? e.table_no : null;
}

function groupBy<T>(list: T[], key: (x: T) => number | null): Map<number | null, T[]> {
  const m = new Map<number | null, T[]>();
  for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return new Map([...m].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)));
}

export function isFinal(t: Pick<Tournament, 'status'>): boolean {
  return t.status === 'finished';
}

/** Joueurs réellement engagés dans le tournoi. */
export function participants(t: Pick<Tournament, 'status'>, entries: Entry[]): Entry[] {
  if (isFinal(t)) return entries.filter(e => e.final_position !== null);
  return entries.filter(e => e.status === 'registered' && e.checked_in);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function replay(entries: Entry[], knockouts: Knockout[], settings: Settings): Replay {
  const { bounty } = settings;
  const start = (e: Entry) => bounty.mode === 'none' ? 0 : e.bounty_start ?? bounty.amount;
  const byId = new Map<string, PlayerState>();
  for (const e of entries) {
    byId.set(e.id, { entry: e, alive: true, position: null, kos: 0, bountyWon: 0, head: start(e), killedBy: [] });
  }
  let unclaimed = 0;
  const outOrder: PlayerState[] = [];

  for (const k of [...knockouts].sort((a, b) => a.seq - b.seq)) {
    const victim = byId.get(k.victim_id);
    if (!victim || !victim.alive) continue;
    const killers = k.killer_ids.map(id => byId.get(id)).filter((p): p is PlayerState => !!p && p !== victim);
    victim.killedBy = killers.map(p => p.entry.id);
    const prize = victim.head;
    if (killers.length === 0) unclaimed += prize;
    for (const p of killers) {
      p.kos += 1 / killers.length;
      const share = prize / killers.length;
      if (bounty.mode === 'progressive') {
        p.bountyWon += share / 2;
        p.head += share / 2;
      } else p.bountyWon += share;
    }
    if (k.rebuy) {
      victim.head = start(victim.entry);
    } else {
      victim.head = 0;
      victim.alive = false;
      outOrder.push(victim);
    }
  }

  const players = [...byId.values()];
  const total = players.length;
  const rankings: Ranking[] = [];
  const rankingById = new Map<string, Ranking>();
  for (const [table, list] of groupBy(players, p => rankingKey(settings, p.entry))) {
    const mine = new Set(list);
    const out = outOrder.filter(p => mine.has(p));
    // Le premier sorti est dernier : une inscription tardive décale donc les places d'elle-même.
    out.forEach((p, i) => { p.position = list.length - i; });
    const g: Ranking = { table, total: list.length, alive: list.filter(p => p.alive), out: out.reverse() };
    rankings.push(g);
    for (const p of list) rankingById.set(p.entry.id, g);
  }
  const alive = players.filter(p => p.alive);
  for (const p of players) {
    p.kos = round2(p.kos);
    p.bountyWon = round2(p.bountyWon);
    p.head = round2(p.head);
  }
  const empty: Ranking = { table: null, total: 0, alive: [], out: [] };
  return {
    players, byId, alive, out: [...outOrder].reverse(), total, unclaimed: round2(unclaimed),
    rankings, rankingOf: id => rankingById.get(id) ?? empty,
    done: total > 1 && alive.length > 0 && rankings.every(g => g.alive.length <= 1),
  };
}

export interface ResultRow { entry_id: string; position: number; kos: number; bounty: number }

/** Classement complet, quand il ne reste qu'un joueur (un par table en Sit'N Go). */
export function finalRows(r: Replay, settings: Settings): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const g of r.rankings) {
    for (const p of g.out) rows.push({ entry_id: p.entry.id, position: p.position!, kos: p.kos, bounty: p.bountyWon });
    // S'il reste plusieurs joueurs (arrêt anticipé), ils sont classés ex æquo à la première place.
    for (const p of g.alive) {
      // Le vainqueur garde sa propre prime, sauf en points ou lots fixes (elle ne récompense qu'un KO).
      const b = settings.bounty;
      const own = b.mode === 'progressive' || (b.mode === 'fixed' && b.unit === 'eur') ? p.head : 0;
      rows.push({ entry_id: p.entry.id, position: 1, kos: p.kos, bounty: round2(p.bountyWon + (g.alive.length === 1 ? own : 0)) });
    }
  }
  return rows.sort((a, b) => a.position - b.position);
}

/**
 * Résultat d'un joueur, figé ou provisoire (un joueur en course a au pire la place « joueurs restants »).
 * field : joueurs classés avec lui (tout le tournoi, ou sa table en Sit'N Go), base des points de championnat.
 */
export interface Outcome { entry: Entry; position: number; kos: number; bounty: number; provisional: boolean; field: number; table: number | null }

export function outcomes(t: Pick<Tournament, 'status' | 'settings'>, entries: Entry[], knockouts: Knockout[]): Outcome[] {
  const inPlay = participants(t, entries);
  const order = (a: Outcome, b: Outcome) => a.position - b.position || (a.table ?? 0) - (b.table ?? 0);
  if (isFinal(t)) {
    const fields = groupBy(inPlay, e => rankingKey(t.settings, e));
    return inPlay
      .map(e => ({
        entry: e, position: e.final_position!, kos: Number(e.final_kos ?? 0), bounty: Number(e.final_bounty ?? 0), provisional: false,
        field: fields.get(rankingKey(t.settings, e))!.length, table: rankingKey(t.settings, e),
      }))
      .sort((a, b) => order(a, b) || a.entry.name.localeCompare(b.entry.name, 'fr'));
  }
  const r = replay(inPlay, knockouts, t.settings);
  return r.players
    .map(p => {
      const g = r.rankingOf(p.entry.id);
      return { entry: p.entry, position: p.position ?? Math.max(1, g.alive.length), kos: p.kos, bounty: p.bountyWon, provisional: p.alive, field: g.total, table: g.table };
    })
    .sort((a, b) => order(a, b) || b.kos - a.kos || a.entry.name.localeCompare(b.entry.name, 'fr'));
}

/** Nombre de joueurs pour estimer la durée : en Sit'N Go, les tables (égales) jouent en même temps. */
export function durationField(t: Pick<Tournament, 'settings' | 'seats_per_table'>, players: number): number {
  if (!isSng(t.settings)) return players;
  return Math.ceil(players / Math.max(1, Math.ceil(players / t.seats_per_table)));
}

export interface ChipCount { totalChips: number; avgStack: number; avgBB: number | null }

export function chipCount(t: Tournament, inPlay: Entry[], aliveCount: number, bb: number): ChipCount {
  const s = t.settings;
  const totalChips = inPlay.reduce(
    (sum, e) => sum + t.starting_stack
      + e.rebuys * (s.rebuy.stack || t.starting_stack)
      + e.addons * s.addon.stack, 0);
  const avgStack = aliveCount > 0 ? Math.round(totalChips / aliveCount) : 0;
  return { totalChips, avgStack, avgBB: bb > 0 ? Math.round((avgStack / bb) * 10) / 10 : null };
}

export interface Money { pool: number; fees: number; bounties: number; total: number }

export function money(t: Tournament, inPlay: Entry[]): Money {
  const s = t.settings;
  let pool = 0, fees = 0, bounties = 0;
  for (const e of inPlay) {
    pool += s.buyIn + e.rebuys * s.rebuy.price + e.addons * s.addon.price;
    fees += s.fee;
    if (s.bounty.mode !== 'none' && s.bounty.unit === 'eur') bounties += s.bounty.amount;
  }
  return { pool, fees, bounties, total: pool + fees + bounties };
}

/** Répartition conseillée selon le nombre de joueurs (environ 15 % de places payées). */
const AUTO: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [45, 27, 17, 11],
  5: [40, 25, 16, 11, 8],
  6: [37, 23, 15, 11, 8, 6],
  7: [34, 21.5, 14.5, 11, 8, 6, 5],
  8: [32, 20, 14, 10.5, 8, 6.5, 5, 4],
};
export function autoPercents(players: number): number[] {
  if (players < 4) return AUTO[1];
  const places = Math.min(8, Math.max(2, Math.round(players * 0.15)));
  return AUTO[places];
}

export interface Payout { place: number; amount: number | null; label: string }

export function payouts(t: Tournament, inPlay: Entry[]): Payout[] {
  const p = t.settings.payouts;
  if (p.mode === 'none') return [];
  if (p.mode === 'lots') {
    return p.lots.map((label, i) => ({ place: i + 1, amount: null, label })).filter(x => x.label.trim());
  }
  const { pool } = money(t, inPlay);
  if (pool <= 0) return [];
  const percents = (p.mode === 'auto' ? autoPercents(inPlay.length) : p.percents).filter(x => x > 0);
  const sum = percents.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  const step = Math.max(0.01, p.rounding || 1);
  const amounts = percents.map(x => Math.floor((pool * x) / sum / step + 1e-9) * step);
  // Le reste des arrondis va au vainqueur : la somme distribuée vaut toujours la cagnotte.
  amounts[0] += pool - amounts.reduce((a, b) => a + b, 0);
  return amounts.map((a, i) => ({ place: i + 1, amount: round2(a), label: '' }));
}

/** Dotation d'un classement : tout le tournoi (MTT) ou une table, avec sa propre cagnotte (Sit'N Go). */
export interface PrizeGroup { table: number | null; players: number; list: Payout[] }

/**
 * Sit'N Go : une dotation par table. Tant que personne n'est assis, les tables
 * sont estimées comme le ferait le tirage (tables égales).
 */
export function prizeGroups(t: Tournament, inPlay: Entry[]): PrizeGroup[] {
  if (!isSng(t.settings)) return [{ table: null, players: inPlay.length, list: payouts(t, inPlay) }];
  const seated = inPlay.filter(e => e.table_no !== null);
  let groups: [number | null, Entry[]][];
  if (seated.length > 0) groups = [...groupBy(seated, e => e.table_no)];
  else {
    const n = Math.max(1, Math.ceil(inPlay.length / t.seats_per_table));
    groups = Array.from({ length: n }, (_, i) => [null, inPlay.filter((_, j) => j % n === i)]);
  }
  return groups.map(([table, list]) => ({ table, players: list.length, list: payouts(t, list) })).filter(g => g.players > 0);
}

/** Ce que rapporte une place dans son classement. */
export function prizeFor(groups: PrizeGroup[], o: Pick<Outcome, 'position' | 'table'>): Payout | undefined {
  const g = groups.length === 1 ? groups[0] : groups.find(x => x.table === o.table);
  return g?.list.find(p => p.place === o.position);
}

/** Les tables dont la dotation diffère, pour n'afficher qu'une liste quand toutes rapportent pareil. */
export function distinctPrizes(groups: PrizeGroup[]): PrizeGroup[] {
  const seen = new Map<string, PrizeGroup>();
  for (const g of groups) {
    if (g.list.length === 0) continue;
    const key = JSON.stringify(g.list.map(p => [p.amount, p.label]));
    if (!seen.has(key)) seen.set(key, g);
  }
  return [...seen.values()];
}
