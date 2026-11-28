import type { ReactNode } from 'react';
import type { Card } from '../lib/cards';
import type { ItemResult } from '../lib/progress';

/** Résultat transmis par une mécanique d'interaction quand l'élève a répondu. */
export interface Answer { correct: boolean | null; answer: string; expected?: string }

interface Base {
  id: string;
  prompt: ReactNode;
  /** Visuel affiché au-dessus des réponses (table, cartes, récit…). */
  scene?: ReactNode;
  /** Explication affichée après la réponse. */
  feedback?: ReactNode;
  /** Phrase reprise dans le bilan (« Ce que ton défi a montré »). */
  insight?: string;
  /** Pas de correction immédiate (le débriefing vient au bilan). */
  silent?: boolean;
  /** Leçon à revoir en cas d'erreur. */
  ref?: number;
}

export interface ChoiceItem extends Base {
  kind: 'choice';
  options: string[];
  /** Index de la bonne réponse, liste d'index acceptés, ou null s'il n'y a pas de bonne réponse. */
  answer: number | number[] | null;
  columns?: 1 | 2 | 3;
}
export interface MultiItem extends Base { kind: 'multi'; options: string[]; answers: number[] }
export interface PickItem extends Base {
  kind: 'pick';
  /** Cartes proposées. */
  pool: Card[];
  layout?: 'row' | 'deck';
  /** Nombre de cartes à choisir, ou 'any' (l'élève valide quand il veut). */
  count: number | 'any';
  check: (picked: Card[]) => boolean;
  /** Solution à montrer après la réponse. */
  solution: Card[];
  /** Cartes fixes affichées au-dessus du choix (ex. tes cartes privées). */
  fixed?: { label: string; cards: Card[] }[];
  /** Affichage du pool en groupes étiquetés (ex. « Tes cartes », « Board »). */
  groups?: { label: string; cards: Card[] }[];
  describe?: (picked: Card[]) => string;
}
export interface OrderItem extends Base { kind: 'order'; items: string[]; notes?: string[] }
export interface SeatItem extends Base {
  kind: 'seats';
  table: TableSpec;
  /** Jetons à placer l'un après l'autre (ex. ["BTN", "SB", "BB"] ou ["Parle"]). */
  tokens: string[];
  solution: number[];
}
export interface NumberItem extends Base { kind: 'number'; answer: number; tolerance?: number; unit?: string; placeholder?: string }
export interface EstimateItem extends Base {
  kind: 'estimate';
  min: number; max: number; step: number;
  answer: number;
  tolerance: number;
  unit: string;
  /** Simulation en direct pour révéler la réponse (renvoie une fréquence 0…1). */
  simulate?: () => number;
  simLabel?: string;
}
export interface MatchItem extends Base { kind: 'match'; pairs: [string, string][] }
export interface CustomItem extends Base { kind: 'custom'; render: (done: (a: Answer) => void) => ReactNode }

export type Item = ChoiceItem | MultiItem | PickItem | OrderItem | SeatItem | NumberItem | EstimateItem | MatchItem | CustomItem;

export interface TableSpec {
  n: number;
  button?: number;
  /** Étiquette par siège (prénom ou position). */
  labels?: (string | undefined)[];
  stacks?: (string | undefined)[];
  folded?: number[];
  hero?: number;
  cards?: Record<number, Card[] | 'back'>;
  bets?: Record<number, string>;
  board?: Card[];
  pot?: string;
  highlight?: number[];
  showBlinds?: boolean;
  showPositions?: boolean;
}

// ── Fiches ─────────────────────────────────────────────────────────────────

export type FicheBlock =
  | { kind: 'table'; title?: string; head: string[]; rows: string[][]; widths?: number[] }
  | { kind: 'cards'; title?: string; rows: { label: string; cards: string; note?: string }[] }
  | { kind: 'steps'; title?: string; steps: string[] }
  | { kind: 'text'; title?: string; text: string };

export interface Fiche {
  essentiel: string[];
  blocks?: FicheBlock[];
  pieges?: string[];
}

// ── Leçons ─────────────────────────────────────────────────────────────────

/** Les deux parcours de l'app : le cours débutant et le niveau 2. */
export type ParcoursId = 'initiation' | 'exploration';

export interface Lesson {
  id: number;
  module: number;
  /** Parcours (initiation par défaut). */
  parcours?: ParcoursId;
  /** Numéro affiché (ex. « A1 ») ; à défaut, l'id. */
  code?: string;
  title: string;
  objective: string;
  bonus?: boolean;
  defi: { intro: ReactNode; items: () => Item[] };
  bilan: {
    /** Récapitulatif personnalisé à partir des réponses au défi (optionnel). */
    recap?: (results: ItemResult[]) => ReactNode;
    body: ReactNode;
  };
  training: { intro?: ReactNode; items: () => Item[]; timed?: boolean };
  fiche: Fiche;
}

export interface Module { id: number; title: string; short: string; parcours?: ParcoursId; /** Lettre affichée (Exploration) */ letter?: string }
