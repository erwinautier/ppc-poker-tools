/**
 * Page publique « Rejoindre le club » (dossier rejoindre/ du dépôt, servie à /rejoindre) :
 * ses questions fréquentes, que les administrateurs modifient dans Le Club.
 * Base : table club_join_page et fonction club_save_join_faq (supabase/006_club_join_page.sql).
 */
import defaults from '../../../rejoindre/faq.json';

export interface FaqItem { q: string; a: string }

/** Ligne unique de club_join_page (id = 1) ; absente tant que rien n'a été enregistré. */
export interface JoinPageRow { id: number; faq: FaqItem[]; updated_at: string; updated_by: string | null }

/** Mêmes limites que club_save_join_faq. */
export const FAQ_LIMITS = { items: 30, q: 200, a: 2000 } as const;

/** Questions affichées par la page tant qu'aucun administrateur n'en a enregistré. */
export const DEFAULT_FAQ: FaqItem[] = defaults;

const trim = (s: string) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
const length = (s: string) => [...s].length;

/** Nettoie la liste comme la base (espaces, autres clés) et lève la même erreur qu'elle. */
export function cleanFaq(list: FaqItem[]): FaqItem[] {
  if (list.length > FAQ_LIMITS.items) throw new Error('Trente questions au plus.');
  return list.map(item => {
    const q = trim(item.q ?? ''), a = trim(item.a ?? '');
    if (!q || !a) throw new Error('Chaque question doit avoir une réponse.');
    if (length(q) > FAQ_LIMITS.q) throw new Error('Question trop longue : 200 caractères au plus.');
    if (length(a) > FAQ_LIMITS.a) throw new Error('Réponse trop longue : 2 000 caractères au plus.');
    return { q, a };
  });
}
