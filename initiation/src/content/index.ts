import type { Lesson, Module, ParcoursId } from './types';
import { LESSONS_M1M2 } from './lessons/m1m2';
import { LESSONS_M3 } from './lessons/m3';
import { LESSONS_M4 } from './lessons/m4';
import { LESSONS_M5 } from './lessons/m5';
import { LESSONS_M6 } from './lessons/m6';
import { EXPLO_LESSONS, EXPLO_MODULES } from './explo';

export const MODULES: Module[] = [
  { id: 1, title: 'Le but du jeu', short: 'Pourquoi on joue' },
  { id: 2, title: 'Les combinaisons', short: 'Qui gagne à l’abattage' },
  { id: 3, title: 'Le déroulement d’une main', short: 'Les règles du jeu' },
  { id: 4, title: 'Les principes du préflop', short: 'Quelles mains jouer' },
  { id: 5, title: 'Le postflop', short: 'Jouer après le flop' },
  { id: 6, title: 'Repères et vocabulaire', short: 'Chiffres, jargon, étiquette' },
];

/** Leçons de l'Initiation (parcours débutant). */
export const LESSONS: Lesson[] = [...LESSONS_M1M2, ...LESSONS_M3, ...LESSONS_M4, ...LESSONS_M5, ...LESSONS_M6];
export const CORE_LESSONS = LESSONS.filter(l => !l.bonus);

export interface ParcoursDef {
  id: ParcoursId;
  title: string;
  sub: string;
  short: string;
  /** Accueil de l'Académie : icône, niveau et présentation. */
  icon: string;
  level: string;
  blurb: string;
  modules: Module[];
  lessons: Lesson[];
  core: Lesson[];
}

export const PARCOURS: Record<ParcoursId, ParcoursDef> = {
  initiation: {
    id: 'initiation', title: 'Initiation', short: 'Initiation', sub: 'Apprendre le No Limit Hold’em pas à pas',
    icon: '🎓', level: 'Débutant',
    blurb: 'Pour découvrir le No Limit Hold’em : le but du jeu, les combinaisons, le déroulement d’une main, puis les premiers principes du préflop et du postflop.',
    modules: MODULES, lessons: LESSONS, core: CORE_LESSONS,
  },
  exploration: {
    id: 'exploration', title: 'Exploration', short: 'Exploration · niv. 2', sub: 'Le poker des joueurs de club, en VO',
    icon: '🧭', level: 'Niveau 2',
    blurb: 'Pour ceux qui connaissent les règles : le vocabulaire de la table en VO, les chiffres qui comptent, la pensée en ranges et les maths du sizing.',
    modules: EXPLO_MODULES, lessons: EXPLO_LESSONS, core: EXPLO_LESSONS.filter(l => !l.bonus),
  },
};

/** Ordre d'affichage des parcours sur l'accueil de l'Académie. */
export const PARCOURS_ORDER: ParcoursId[] = ['initiation', 'exploration'];

export const ALL_LESSONS: Lesson[] = [...LESSONS, ...EXPLO_LESSONS];
export const ALL_MODULES: Module[] = [...MODULES, ...EXPLO_MODULES];

export function lessonById(id: number): Lesson | undefined { return ALL_LESSONS.find(l => l.id === id); }
export function parcoursOf(l: Lesson): ParcoursDef { return PARCOURS[l.parcours ?? 'initiation']; }
export function moduleOf(l: Lesson): Module { return ALL_MODULES.find(m => m.id === l.module)!; }
/** Numéro affiché d'une leçon : « 5 » ou « B5 ». */
export function lessonLabel(l: Lesson): string { return l.code ?? String(l.id); }
/** Nom affiché d'un module : « Module 3 » ou « Module B ». */
export function moduleLabel(m: Module): string { return `Module ${m.letter ?? m.id}`; }
