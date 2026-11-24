import type { Lesson, Module } from './types';
import { LESSONS_M1M2 } from './lessons/m1m2';
import { LESSONS_M3 } from './lessons/m3';
import { LESSONS_M4 } from './lessons/m4';
import { LESSONS_M5 } from './lessons/m5';
import { LESSONS_M6 } from './lessons/m6';

export const MODULES: Module[] = [
  { id: 1, title: 'Le but du jeu', short: 'Pourquoi on joue' },
  { id: 2, title: 'Les combinaisons', short: 'Qui gagne à l’abattage' },
  { id: 3, title: 'Le déroulement d’une main', short: 'Les règles du jeu' },
  { id: 4, title: 'Les principes du préflop', short: 'Quelles mains jouer' },
  { id: 5, title: 'Le postflop', short: 'Jouer après le flop' },
  { id: 6, title: 'Repères et vocabulaire', short: 'Chiffres, jargon, étiquette' },
];

export const LESSONS: Lesson[] = [...LESSONS_M1M2, ...LESSONS_M3, ...LESSONS_M4, ...LESSONS_M5, ...LESSONS_M6];

export function lessonById(id: number): Lesson | undefined { return LESSONS.find(l => l.id === id); }
export const CORE_LESSONS = LESSONS.filter(l => !l.bonus);
