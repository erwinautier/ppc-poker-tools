/**
 * Horloge : un état minuscule (niveau, temps écoulé dans ce niveau, instant de
 * départ) dont chaque écran déduit le niveau courant et le temps restant.
 * Personne n'a besoin d'être connecté pour que les niveaux s'enchaînent.
 */
import type { Level, Tournament } from './types';

export interface ClockState {
  level: number;
  elapsedMs: number;
  /** Horodatage (ms) du dernier départ ; null = en pause. */
  anchor: number | null;
}

export interface ClockView {
  index: number;
  level: Level | null;
  next: Level | null;
  elapsedMs: number;
  remainingMs: number;
  /** 0 → 1 dans le niveau courant. */
  progress: number;
  running: boolean;
  /** Dernier niveau dépassé : les blindes restent, le temps reste à zéro. */
  overtime: boolean;
  /** Temps avant la prochaine pause (null s'il n'y en a plus). */
  toBreakMs: number | null;
  /** Temps de jeu écoulé depuis le début du tournoi. */
  totalMs: number;
}

export const durMs = (l: Level) => Math.max(1, l.minutes) * 60_000;

export function clockOf(t: Pick<Tournament, 'clock_level' | 'clock_elapsed_ms' | 'clock_anchor'>): ClockState {
  return {
    level: t.clock_level,
    elapsedMs: Number(t.clock_elapsed_ms),
    anchor: t.clock_anchor ? Date.parse(t.clock_anchor) : null,
  };
}

export function readClock(levels: Level[], s: ClockState, now: number): ClockView {
  const running = s.anchor !== null;
  if (levels.length === 0) {
    return { index: 0, level: null, next: null, elapsedMs: 0, remainingMs: 0, progress: 0, running, overtime: false, toBreakMs: null, totalMs: 0 };
  }
  let index = Math.min(Math.max(0, s.level), levels.length - 1);
  let elapsed = s.elapsedMs + (running ? Math.max(0, now - s.anchor!) : 0);
  while (index < levels.length - 1 && elapsed >= durMs(levels[index])) {
    elapsed -= durMs(levels[index]);
    index++;
  }
  const level = levels[index];
  const remaining = Math.max(0, durMs(level) - elapsed);
  let totalMs = Math.max(0, elapsed);
  for (let i = 0; i < index; i++) totalMs += durMs(levels[i]);

  let toBreakMs: number | null = null;
  if (level.kind === 'level') {
    let sum = remaining;
    for (let i = index + 1; i < levels.length; i++) {
      if (levels[i].kind === 'break') { toBreakMs = sum; break; }
      sum += durMs(levels[i]);
    }
  }

  return {
    index,
    level,
    next: levels[index + 1] ?? null,
    elapsedMs: elapsed,
    remainingMs: remaining,
    progress: Math.min(1, Math.max(0, elapsed / durMs(level))),
    running,
    overtime: index === levels.length - 1 && elapsed >= durMs(level),
    toBreakMs,
    totalMs,
  };
}

/** Commandes : renvoient l'état à enregistrer, calculé depuis ce que voit l'écran. */
export interface ClockCommand { level: number; elapsedMs: number; running: boolean }

export function play(v: ClockView): ClockCommand {
  return { level: v.index, elapsedMs: Math.round(v.elapsedMs), running: true };
}
export function pause(v: ClockView): ClockCommand {
  return { level: v.index, elapsedMs: Math.round(v.elapsedMs), running: false };
}
export function goTo(v: ClockView, levels: Level[], index: number): ClockCommand {
  return { level: Math.min(Math.max(0, index), Math.max(0, levels.length - 1)), elapsedMs: 0, running: v.running };
}
/** Recule au début du niveau, ou au niveau précédent si l'on y est déjà. */
export function back(v: ClockView, levels: Level[]): ClockCommand {
  return goTo(v, levels, v.elapsedMs > 5000 ? v.index : v.index - 1);
}
/** Ajoute (ou retire) du temps au niveau en cours ; retirer ne descend pas sous une seconde. */
export function nudge(v: ClockView, deltaMs: number): ClockCommand {
  const remaining = Math.max(1000, v.remainingMs + deltaMs);
  const dur = v.level ? durMs(v.level) : 0;
  return { level: v.index, elapsedMs: Math.round(dur - remaining), running: v.running };
}

/** Numéro affiché d'un niveau : les pauses ne comptent pas. */
export function levelNumber(levels: Level[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index && i < levels.length; i++) if (levels[i].kind === 'level') n++;
  return n;
}

/** Une règle « jusqu'au niveau n » est-elle encore ouverte ? (pause incluse) */
export function withinLevel(levels: Level[], index: number, until: number): boolean {
  if (until <= 0) return false;
  return levelNumber(levels, index) <= until;
}
