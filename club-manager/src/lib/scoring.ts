/** Points de championnat et classement général. */
import { outcomes } from './engine';
import type { Entry, Knockout, Scoring, Tournament } from './types';

const r1 = (x: number) => Math.round(x * 10) / 10;

export function bracketFor(scoring: Scoring, players: number): number[] {
  const sorted = [...scoring.brackets].sort((a, b) => a.minPlayers - b.minPlayers);
  let pts = sorted[0]?.points ?? [];
  for (const b of sorted) if (players >= b.minPlayers) pts = b.points;
  return pts;
}

/** Points de place seuls (avant coefficient). */
export function placePoints(scoring: Scoring, position: number, players: number): number {
  if (position < 1 || players < 1) return 0;
  switch (scoring.method) {
    case 'linear': return r1(Math.max(0, players - position + 1) * scoring.factor);
    case 'sqrt': return r1(scoring.factor * Math.sqrt(players / position));
    case 'table': return bracketFor(scoring, players)[position - 1] ?? 0;
  }
}

export interface PointsInput { position: number; players: number; kos: number; bountyPts: number; adjust: number; coefficient: number }

export function points(scoring: Scoring, x: PointsInput): number {
  return r1(
    placePoints(scoring, x.position, x.players) * x.coefficient
    + scoring.participation
    + scoring.koPoints * x.kos
    + x.bountyPts
    + x.adjust,
  );
}

export interface Cell {
  tournamentId: string;
  entryId: string;
  position: number;
  players: number;
  kos: number;
  points: number;
  counted: boolean;
  provisional: boolean;
}

export interface Row {
  key: string;
  memberId: string | null;
  name: string;
  rank: number;
  total: number;
  played: number;
  wins: number;
  podiums: number;
  kos: number;
  best: number;
  average: number;
  cells: Map<string, Cell>;
}

export interface StandingsInput {
  scoring: Scoring;
  tournaments: Tournament[];
  entries: Entry[];
  knockouts: Knockout[];
}

/** Points d'un tournoi pour chaque joueur engagé. */
export function tournamentCells(t: Tournament, scoring: Scoring, entries: Entry[], knockouts: Knockout[]): (Cell & { entry: Entry; bounty: number })[] {
  // Sit'N Go : la place et les points se comptent parmi les joueurs de sa table.
  return outcomes(t, entries, knockouts).map(o => ({
    tournamentId: t.id,
    entryId: o.entry.id,
    entry: o.entry,
    position: o.position,
    players: o.field,
    kos: o.kos,
    bounty: o.bounty,
    counted: true,
    provisional: t.status !== 'finished',
    points: points(scoring, {
      position: o.position, players: o.field, kos: o.kos,
      bountyPts: t.settings.bounty.mode !== 'none' && t.settings.bounty.unit === 'pts' ? o.bounty : 0,
      adjust: Number(o.entry.points_adjust) || 0,
      coefficient: t.settings.coefficient,
    }),
  }));
}

/** Comparaison des places : le plus de victoires, puis de 2es, puis de 3es places, etc. */
function countback(a: Cell[], b: Cell[]): number {
  const max = Math.max(0, ...a.map(c => c.position), ...b.map(c => c.position));
  for (let p = 1; p <= max; p++) {
    const d = b.filter(c => c.position === p).length - a.filter(c => c.position === p).length;
    if (d !== 0) return d;
  }
  return 0;
}

export function standings({ scoring, tournaments, entries, knockouts }: StandingsInput): Row[] {
  const rows = new Map<string, Row>();
  for (const t of tournaments) {
    if (t.status !== 'finished' && t.status !== 'running') continue;
    const cells = tournamentCells(
      t, scoring,
      entries.filter(e => e.tournament_id === t.id),
      knockouts.filter(k => k.tournament_id === t.id),
    );
    for (const { entry, ...cell } of cells) {
      if (!entry.member_id && !scoring.rankGuests) continue;
      const key = entry.member_id ?? `invite:${entry.name.trim().toLocaleLowerCase('fr')}`;
      let row = rows.get(key);
      if (!row) {
        row = { key, memberId: entry.member_id, name: entry.name, rank: 0, total: 0, played: 0, wins: 0, podiums: 0, kos: 0, best: 0, average: 0, cells: new Map() };
        rows.set(key, row);
      }
      row.name = entry.name;
      row.cells.set(t.id, cell);
    }
  }

  const list = [...rows.values()];
  for (const row of list) {
    const cells = [...row.cells.values()];
    const byPoints = [...cells].sort((a, b) => b.points - a.points);
    byPoints.forEach((c, i) => { c.counted = scoring.bestOf === null || i < scoring.bestOf; });
    row.total = r1(byPoints.filter(c => c.counted).reduce((s, c) => s + c.points, 0));
    row.played = cells.length;
    const done = cells.filter(c => !c.provisional);
    row.wins = done.filter(c => c.position === 1).length;
    row.podiums = done.filter(c => c.position <= 3).length;
    row.kos = Math.round(cells.reduce((s, c) => s + c.kos, 0) * 100) / 100;
    row.best = cells.length ? Math.min(...cells.map(c => c.position)) : 0;
    row.average = cells.length ? r1(cells.reduce((s, c) => s + c.position, 0) / cells.length) : 0;
  }

  const cmp = (a: Row, b: Row) =>
    b.total - a.total || countback([...a.cells.values()], [...b.cells.values()]) || b.kos - a.kos;
  list.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, 'fr'));
  list.forEach((row, i) => {
    row.rank = i > 0 && cmp(list[i - 1], row) === 0 ? list[i - 1].rank : i + 1;
  });
  return list;
}
