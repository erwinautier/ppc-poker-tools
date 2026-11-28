/** Parcours Exploration (niveau 2) : modules A à E, leçons A1 à E16. */
import type { Lesson, Module } from '../types';
import { LESSONS_A } from './a';
import { LESSONS_B } from './b';
import { LESSONS_C } from './c';
import { LESSONS_D } from './d';
import { LESSONS_E } from './e';

export const EXPLO_MODULES: Module[] = [
  { id: 11, letter: 'A', parcours: 'exploration', title: 'Parler poker', short: 'Le vocabulaire de la table, en VO' },
  { id: 12, letter: 'B', parcours: 'exploration', title: 'Les chiffres qui comptent', short: 'Duels, flops et combos' },
  { id: 13, letter: 'C', parcours: 'exploration', title: 'Penser en ranges', short: 'Formes, avantages, position' },
  { id: 14, letter: 'D', parcours: 'exploration', title: 'Le sizing : les maths', short: 'Prix, alpha, MDF, SPR' },
  { id: 15, letter: 'E', parcours: 'exploration', title: 'Bonus tournoi', short: 'Tapis courts et ICM' },
];

export const EXPLO_LESSONS: Lesson[] = [...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...LESSONS_D, ...LESSONS_E];
