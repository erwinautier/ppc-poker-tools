/** Structures de blindes : générateur, estimation de durée, modèles. */
import type { Chip, Level } from './types';

export interface GeneratorInput {
  players: number;
  stack: number;
  /** Durée visée, pauses comprises. */
  totalMinutes: number;
  levelMinutes: number;
  startBB: number;
  ante: 'none' | 'bb';
  /** Niveau à partir duquel l'ante apparaît. */
  anteFrom: number;
  smallestChip: number;
  /** Pause après chaque série de n niveaux ; 0 = aucune. */
  breakEvery: number;
  breakMinutes: number;
}

const MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/** Grosses blindes « jouables » : la petite blinde (moitié) doit se payer avec le plus petit jeton. */
export function niceBlinds(chip: number): number[] {
  const out: number[] = [];
  for (let e = 0; e <= 8; e++) {
    for (const m of MANTISSAS) {
      const bb = Math.round(m * 10 ** e);
      const sb = bb / 2;
      if (Number.isInteger(sb) && sb % chip === 0) out.push(bb);
    }
  }
  return out;
}

/** À la durée visée, il reste environ 20 grosses blindes sur toute la table : le tournoi se finit. */
const CLOSING_BB = 20;

export function generateLevels(g: GeneratorInput): Level[] {
  const nice = niceBlinds(Math.max(1, g.smallestChip));
  const total = g.players * g.stack;
  const startBB = nice.find(b => b >= g.startBB) ?? nice[0];
  const block = g.breakEvery > 0 ? g.breakEvery * g.levelMinutes + g.breakMinutes : 0;
  // Nombre de niveaux qui tiennent dans la durée, pauses comprises.
  let n: number;
  if (g.breakEvery > 0) {
    const blocks = Math.floor(g.totalMinutes / block);
    const rest = Math.min(g.breakEvery, Math.floor((g.totalMinutes - blocks * block) / g.levelMinutes));
    n = blocks * g.breakEvery + rest;
  } else n = Math.floor(g.totalMinutes / g.levelMinutes);
  n = Math.max(4, n);

  const endBB = Math.max(startBB * 2, total / CLOSING_BB);
  const ratio = (endBB / startBB) ** (1 / (n - 1));
  const bbs: number[] = [startBB];
  // Trois niveaux de réserve : l'horloge ne doit pas s'arrêter sur un heads-up qui dure.
  for (let i = 1; i < n + 3; i++) {
    const ideal = startBB * ratio ** i;
    const prev = bbs[i - 1];
    const above = nice.filter(b => b > prev);
    if (above.length === 0) break;
    bbs.push(above.reduce((best, b) => Math.abs(Math.log(b / ideal)) < Math.abs(Math.log(best / ideal)) ? b : best));
  }

  const levels: Level[] = [];
  bbs.forEach((bb, i) => {
    if (i > 0 && g.breakEvery > 0 && i % g.breakEvery === 0 && i < n) {
      levels.push({ kind: 'break', sb: 0, bb: 0, ante: 0, minutes: g.breakMinutes, label: 'Pause' });
    }
    levels.push({
      kind: 'level', sb: bb / 2, bb, minutes: g.levelMinutes,
      ante: g.ante === 'bb' && i + 1 >= g.anteFrom ? bb : 0,
    });
  });
  return levels;
}

/** Minutes jusqu'à la fin probable du tournoi (null si la structure est trop lente). */
export function estimateMinutes(levels: Level[], players: number, stack: number): number | null {
  const total = players * stack;
  let sum = 0;
  for (const l of levels) {
    sum += l.minutes;
    if (l.kind === 'level' && total / l.bb <= CLOSING_BB) return sum;
  }
  return null;
}

export function totalMinutes(levels: Level[]): number {
  return levels.reduce((s, l) => s + l.minutes, 0);
}

export function chipsTotal(chips: Chip[]): number {
  return chips.reduce((s, c) => s + c.value * c.count, 0);
}

export const DEFAULT_CHIPS: Chip[] = [
  { value: 25, color: '#2E9E5B', count: 8 },
  { value: 100, color: '#1F1F24', count: 8 },
  { value: 500, color: '#7B3FA0', count: 6 },
  { value: 1000, color: '#F2B81A', count: 6 },
  { value: 5000, color: '#FF4D70', count: 2 },
];

export interface Preset { name: string; description: string; stack: number; input: GeneratorInput }

export const PRESETS: Preset[] = [
  {
    name: 'Turbo', description: 'Niveaux de 10 min, environ 2 h pour 20 joueurs', stack: 10000,
    input: { players: 20, stack: 10000, totalMinutes: 125, levelMinutes: 10, startBB: 100, ante: 'bb', anteFrom: 4, smallestChip: 25, breakEvery: 6, breakMinutes: 5 },
  },
  {
    name: 'Soirée de club', description: 'Niveaux de 15 min, environ 3 h 30 pour 24 joueurs', stack: 20000,
    input: { players: 24, stack: 20000, totalMinutes: 210, levelMinutes: 15, startBB: 100, ante: 'bb', anteFrom: 4, smallestChip: 25, breakEvery: 5, breakMinutes: 10 },
  },
  {
    name: 'Deep stack', description: 'Niveaux de 20 min, environ 5 h 30 pour 30 joueurs', stack: 30000,
    input: { players: 30, stack: 30000, totalMinutes: 330, levelMinutes: 20, startBB: 100, ante: 'bb', anteFrom: 3, smallestChip: 25, breakEvery: 4, breakMinutes: 10 },
  },
];
