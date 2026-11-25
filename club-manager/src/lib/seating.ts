/** Tirage des places, équilibrage et fermeture des tables. */
import type { Entry } from './types';

export interface Seat { entry_id: string; table_no: number | null; seat_no: number | null }

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tirage complet : tables les plus égales possible, places consécutives. */
export function draw(ids: string[], size: number, rnd: () => number = Math.random): Seat[] {
  const tables = Math.max(1, Math.ceil(ids.length / size));
  return shuffle(ids, rnd).map((entry_id, i) => ({
    entry_id, table_no: (i % tables) + 1, seat_no: Math.floor(i / tables) + 1,
  }));
}

export interface TableView { no: number; players: Entry[] }

export function tablesOf(entries: Entry[]): TableView[] {
  const map = new Map<number, Entry[]>();
  for (const e of entries) {
    if (e.table_no === null) continue;
    map.set(e.table_no, [...(map.get(e.table_no) ?? []), e]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([no, players]) => ({ no, players: players.sort((a, b) => (a.seat_no ?? 99) - (b.seat_no ?? 99)) }));
}

export function freeSeats(table: TableView, size: number): number[] {
  const taken = new Set(table.players.map(p => p.seat_no));
  const out: number[] = [];
  for (let s = 1; s <= size; s++) if (!taken.has(s)) out.push(s);
  return out;
}

/** Place un joueur à la table la moins remplie (nouvelle table si tout est plein). */
export function placeOne(entryId: string, entries: Entry[], size: number): Seat {
  const tables = tablesOf(entries.filter(e => e.id !== entryId));
  const open = tables.filter(t => t.players.length < size).sort((a, b) => a.players.length - b.players.length);
  if (open.length === 0) {
    return { entry_id: entryId, table_no: (tables.at(-1)?.no ?? 0) + 1, seat_no: 1 };
  }
  return { entry_id: entryId, table_no: open[0].no, seat_no: freeSeats(open[0], size)[0] };
}

/** Ferme une table : ses joueurs sont tirés au sort vers les tables les moins remplies. Null si impossible. */
export function breakTable(entries: Entry[], no: number, size: number, rnd: () => number = Math.random): Seat[] | null {
  const tables = tablesOf(entries);
  const leaving = tables.find(t => t.no === no);
  if (!leaving) return null;
  const others = tables.filter(t => t.no !== no).map(t => ({ ...t, players: [...t.players] }));
  const room = others.reduce((s, t) => s + (size - t.players.length), 0);
  if (room < leaving.players.length) return null;
  const moves: Seat[] = [];
  for (const p of shuffle(leaving.players, rnd)) {
    const target = others.filter(t => t.players.length < size).sort((a, b) => a.players.length - b.players.length)[0];
    const seat = freeSeats(target, size)[0];
    moves.push({ entry_id: p.id, table_no: target.no, seat_no: seat });
    target.players.push({ ...p, table_no: target.no, seat_no: seat });
  }
  return moves;
}

export type Advice =
  | { kind: 'final' }
  | { kind: 'break'; table: number }
  | { kind: 'move'; from: number; to: number; seat: number }
  | { kind: 'unseated'; ids: string[] };

/** Ce qu'il faut faire maintenant pour garder des tables équilibrées. */
export function advise(alive: Entry[], size: number): Advice[] {
  const tables = tablesOf(alive);
  const unseated = alive.filter(e => e.table_no === null);
  const out: Advice[] = [];
  if (tables.length === 0) return out;
  if (unseated.length > 0) out.push({ kind: 'unseated', ids: unseated.map(e => e.id) });
  if (tables.length > 1 && alive.length <= size) return [...out, { kind: 'final' }];
  if (tables.length > 1 && Math.ceil(alive.length / size) < tables.length) {
    const smallest = [...tables].sort((a, b) => a.players.length - b.players.length || b.no - a.no)[0];
    return [...out, { kind: 'break', table: smallest.no }];
  }
  const sorted = [...tables].sort((a, b) => b.players.length - a.players.length);
  const big = sorted[0], small = sorted.at(-1)!;
  if (big.players.length - small.players.length >= 2) {
    out.push({ kind: 'move', from: big.no, to: small.no, seat: freeSeats(small, size)[0] });
  }
  return out;
}
