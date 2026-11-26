/** Types de ppc-da.js (bascule de direction artistique commune à la suite). */

export type DA = 'vice' | 'nuit';

export interface DAInfo {
  id: DA;
  label: string;
  /** Fichier du jeton rond, dans le dossier public de chaque app. */
  logo: string;
}

export const DA_LIST: readonly DAInfo[];

/** DA affichée : le choix posé sur <html>, sinon la DA par défaut de ppc-da.css. */
export function getDA(): DA;
/** Nom du fichier logo de la DA (par défaut, celle affichée). */
export function logoFile(id?: DA): string;
/** S'abonne aux changements de DA ; renvoie la fonction de désabonnement. */
export function subscribeDA(fn: () => void): () => void;
export function setDA(id: DA): void;
/** Bascule vers l'autre DA. */
export function toggleDA(): void;
