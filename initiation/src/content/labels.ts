/**
 * Numéros affichés des leçons, sans dépendre du contenu (évite les imports circulaires).
 * Initiation : 1 à 20. Exploration : 101 à 116, affichées A1 à E16.
 */
const EXPLO_LETTERS = 'AAAABBBBCCCDDDEE';

export function labelForId(id: number): string {
  if (id > 100 && id <= 100 + EXPLO_LETTERS.length) return `${EXPLO_LETTERS[id - 101]}${id - 100}`;
  return String(id);
}
