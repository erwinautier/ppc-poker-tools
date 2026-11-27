/**
 * Blindes : lues sur l'horloge d'un tournoi du Club, ou saisies pour un tournoi
 * extérieur, avec une échelle de niveaux courante pour passer au suivant d'un geste.
 */
import type { Blinds } from './engine';

/** Niveaux courants des tournois (petite / grosse blinde). */
const LADDER: [number, number][] = [
  [1, 2], [2, 4], [3, 6], [5, 10], [10, 20], [15, 30], [20, 40], [25, 50], [30, 60], [40, 80],
  [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [250, 500], [300, 600], [400, 800],
  [500, 1000], [600, 1200], [800, 1600], [1000, 2000], [1200, 2400], [1500, 3000], [2000, 4000],
  [2500, 5000], [3000, 6000], [4000, 8000], [5000, 10000], [6000, 12000], [8000, 16000],
  [10000, 20000], [15000, 30000], [20000, 40000], [25000, 50000], [30000, 60000], [40000, 80000],
  [50000, 100000], [60000, 120000], [80000, 160000], [100000, 200000],
];

function withAnte(b: Blinds, sb: number, bb: number): Blinds {
  // Ante égale à la grosse blinde (cas courant) : elle suit ; sinon, elle suit la même proportion.
  const ante = b.ante <= 0 ? 0 : b.ante === b.bb ? bb : Math.round((b.ante * bb) / b.bb);
  return { ...b, sb, bb, ante };
}

export function nextLevel(b: Blinds): Blinds {
  const step = LADDER.find(([, bb]) => bb > b.bb);
  return step ? withAnte(b, step[0], step[1]) : withAnte(b, b.sb * 2, b.bb * 2);
}
export function prevLevel(b: Blinds): Blinds {
  const step = [...LADDER].reverse().find(([, bb]) => bb < b.bb);
  return step ? withAnte(b, step[0], step[1]) : b;
}

// ── Horloge d'un tournoi du Club (même calcul que club-manager/src/lib/clock.ts) ──

export interface ClubLevel { kind: 'level' | 'break'; sb: number; bb: number; ante: number; minutes: number }
export interface ClubTournament {
  id: string;
  name: string;
  status: string;
  levels: ClubLevel[];
  seats_per_table: number;
  starting_stack: number;
  clock_level: number;
  clock_elapsed_ms: number;
  clock_anchor: string | null;
}

const durMs = (l: ClubLevel) => Math.max(1, l.minutes) * 60_000;

/** Niveau en cours (pendant une pause, celui qui suit) ; null sans structure. */
export function clubLevel(t: ClubTournament, now = Date.now()): { level: number; blinds: Blinds } | null {
  const levels = t.levels ?? [];
  if (!levels.length) return null;
  let index = Math.min(Math.max(0, t.clock_level), levels.length - 1);
  const anchor = t.clock_anchor ? Date.parse(t.clock_anchor) : null;
  let elapsed = Number(t.clock_elapsed_ms) + (anchor !== null ? Math.max(0, now - anchor) : 0);
  while (index < levels.length - 1 && elapsed >= durMs(levels[index])) {
    elapsed -= durMs(levels[index]);
    index++;
  }
  let at = index;
  while (at < levels.length - 1 && levels[at].kind === 'break') at++;
  while (at > 0 && levels[at].kind === 'break') at--;
  const l = levels[at];
  if (l.kind === 'break') return null;
  const number = levels.slice(0, at + 1).filter(x => x.kind === 'level').length;
  return { level: number, blinds: { sb: l.sb, bb: l.bb, ante: l.ante, anteMode: 'bb' } };
}
