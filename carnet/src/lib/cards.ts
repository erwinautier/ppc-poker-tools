/** Cartes : entier 0..51 = rang * 4 + couleur ; rang 0 = « 2 » … 12 = « A » ; couleurs ♠ ♥ ♦ ♣. */
export type Card = number;

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';
export const SUIT_SYMBOL = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_NAME = ['pique', 'cœur', 'carreau', 'trèfle'] as const;
/** Rangs du plus fort au plus faible, pour les sélecteurs. */
export const RANKS_DESC = [...RANKS].reverse();

export const rankOf = (c: Card) => c >> 2;
export const suitOf = (c: Card) => c & 3;
export const cardOf = (rank: number, suit: number): Card => rank * 4 + suit;

/** « 10 » plutôt que « T » : c'est ainsi qu'on l'écrit au club. */
export const rankLabel = (r: number) => (RANKS[r] === 'T' ? '10' : RANKS[r]);
export const cardText = (c: Card) => rankLabel(rankOf(c)) + SUIT_SYMBOL[suitOf(c)];
export const cardsText = (cs: readonly Card[]) => cs.map(cardText).join(' ');
export const cardName = (c: Card) => `${rankLabel(rankOf(c))} de ${SUIT_NAME[suitOf(c)]}`;

export const isCard = (c: unknown): c is Card => Number.isInteger(c) && (c as number) >= 0 && (c as number) < 52;
