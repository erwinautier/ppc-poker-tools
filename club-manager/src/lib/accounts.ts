/** Comptes de la suite : noms et validation. */
import type { Account } from './types';

/** Nom comparable : sans accents, majuscules ni ponctuation. */
export const key = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Le nom indiqué au club, sinon le pseudo. */
export const accountName = (a: Pick<Account, 'asked' | 'username'>) => a.asked ?? a.username ?? 'Sans pseudo';

/** Comptes à valider : ceux dont l'adresse est confirmée d'abord, puis les plus récents. */
export function waitingAccounts(accounts: Account[]): Account[] {
  return accounts.filter(a => !a.member_id && !a.refused)
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.created_at.localeCompare(a.created_at));
}

/** Combien de mots les deux noms ont en commun : sert à proposer la bonne fiche. */
export function nameScore(a: string, b: string): number {
  const words = key(a).split(' ');
  return key(b).split(' ').filter(w => w && words.includes(w)).length;
}
