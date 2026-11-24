/** Progression de l'élève, enregistrée sur l'appareil (localStorage). */
import { useEffect, useState } from 'react';

export type Phase = 'defi' | 'bilan' | 'entrainement' | 'fiche';
export const PHASES: Phase[] = ['defi', 'bilan', 'entrainement', 'fiche'];
export const PHASE_LABEL: Record<Phase, string> = { defi: 'Défi', bilan: 'Bilan', entrainement: 'Entraînement', fiche: 'Fiche' };

export const PASS_THRESHOLD = 0.7;

export interface ItemResult {
  id: string;
  correct: boolean | null;   // null : pas de bonne réponse (avis, observation)
  answer: string;
  expected?: string;
  insight?: string;
}

export interface LessonProgress {
  defiDone: boolean;
  defiResults: ItemResult[];
  bilanSeen: boolean;
  best: number | null;       // meilleur score d'entraînement (0…1)
  attempts: number;
  lastPhase: Phase;
}

export interface Store {
  lessons: Record<number, LessonProgress>;
  name?: string;
}

const KEY = 'ppc-initiation-v1';

export function emptyLesson(): LessonProgress {
  return { defiDone: false, defiResults: [], bilanSeen: false, best: null, attempts: 0, lastPhase: 'defi' };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && typeof s === 'object' && s.lessons) return s;
    }
  } catch { /* stockage indisponible : on repart de zéro */ }
  return { lessons: {} };
}

let state: Store = load();
const listeners = new Set<() => void>();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function getStore(): Store { return state; }
export function lessonProgress(id: number): LessonProgress { return state.lessons[id] ?? emptyLesson(); }

export function updateLesson(id: number, patch: Partial<LessonProgress>) {
  state = { ...state, lessons: { ...state.lessons, [id]: { ...lessonProgress(id), ...patch } } };
  save();
}
export function setName(name: string) { state = { ...state, name }; save(); }
export function resetAll() { state = { lessons: {} }; save(); }

export function isValidated(p: LessonProgress | undefined): boolean {
  return !!p && p.best !== null && p.best >= PASS_THRESHOLD;
}

export function useStore(): Store {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}
