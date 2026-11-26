/** Types de ppc-da.js (choix de la direction artistique, commun à la suite). */

export type DA = 'vice' | 'nuit';

export interface DAInfo {
  id: DA;
  label: string;
  /** Fichier du jeton rond, dans le dossier public de chaque app. */
  logo: string;
}

/** La première est la DA par défaut, en secours tant que ppc-da.css n'est pas chargée. */
export const DA_LIST: readonly DAInfo[];

/** DA affichée : celle posée sur <html>, sinon la DA par défaut de ppc-da.css. */
export function getDA(): DA;
/** Nom du fichier logo de la DA (par défaut, celle affichée). */
export function logoFile(id?: DA): string;
/** S'abonne aux changements de DA ; renvoie la fonction de désabonnement. */
export function subscribeDA(fn: () => void): () => void;
/** Change de DA et la mémorise (sans effet si le visiteur n'est pas administrateur). */
export function setDA(id: DA): void;
/** Bascule vers l'autre DA (sans effet si le visiteur n'est pas administrateur). */
export function toggleDA(): void;
/** Un administrateur du club est connecté sur cet appareil (rôle « admin » d'une fiche du Club). */
export function isDAAdmin(): boolean;
/** Réponse connue : id du compte connecté s'il est administrateur du club, sinon null. */
export function setDAAdmin(userId: string | null): void;
/** Demande au serveur si le compte connecté est administrateur ; sans réponse sûre, ne change rien. */
export function checkDAAdmin(): Promise<void>;
