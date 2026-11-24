/**
 * Lexique progressif : chaque terme est rattaché à la leçon qui l'introduit.
 * Il apparaît dans l'onglet Lexique dès que le bilan de cette leçon a été vu.
 */
export interface Term {
  key: string;
  term: string;
  en?: string;
  def: string;
  lesson: number;
  theme: 'Le jeu' | 'Les mains' | 'La donne' | 'Les actions' | 'Les positions' | 'Le préflop' | 'Le postflop' | 'Les chiffres' | 'Le jargon' | 'La table';
}

export const TERMS: Term[] = [
  // Leçon 1
  { key: 'jeton', term: 'Jeton', en: 'chip', def: 'Unité de mise. Le but du jeu est d’en accumuler le plus possible.', lesson: 1, theme: 'Le jeu' },
  { key: 'pot', term: 'Pot', en: 'pot', def: 'Ensemble des jetons misés pendant une main. Il revient au gagnant de la main.', lesson: 1, theme: 'Le jeu' },
  { key: 'tapis', term: 'Tapis', en: 'stack', def: 'Les jetons qu’un joueur a devant lui.', lesson: 1, theme: 'Le jeu' },
  { key: 'abattage', term: 'Abattage', en: 'showdown', def: 'Moment où les joueurs encore en jeu montrent leurs cartes pour désigner le gagnant.', lesson: 1, theme: 'Le jeu' },
  { key: 'nolimit', term: 'No Limit', en: 'no limit', def: 'Variante où l’on peut miser tout son tapis à n’importe quel moment.', lesson: 1, theme: 'Le jeu' },
  { key: 'privees', term: 'Cartes privées', en: 'hole cards', def: 'Les deux cartes cachées reçues par chaque joueur, qu’il est seul à voir.', lesson: 1, theme: 'Le jeu' },
  { key: 'board', term: 'Board', en: 'board', def: 'Les cinq cartes communes posées face visible au centre de la table.', lesson: 1, theme: 'Le jeu' },
  // Leçon 2
  { key: 'combinaison', term: 'Combinaison', en: 'hand', def: 'La main de 5 cartes formée par un joueur. Elle détermine qui gagne à l’abattage.', lesson: 2, theme: 'Les mains' },
  { key: 'hauteur', term: 'Hauteur', en: 'high card', def: 'Aucune combinaison : la main vaut sa carte la plus haute.', lesson: 2, theme: 'Les mains' },
  { key: 'paire', term: 'Paire', en: 'pair', def: 'Deux cartes de même valeur.', lesson: 2, theme: 'Les mains' },
  { key: 'deuxpaires', term: 'Deux paires', en: 'two pair', def: 'Deux paires différentes.', lesson: 2, theme: 'Les mains' },
  { key: 'brelan', term: 'Brelan', en: 'three of a kind', def: 'Trois cartes de même valeur.', lesson: 2, theme: 'Les mains' },
  { key: 'suite', term: 'Suite', en: 'straight', def: 'Cinq cartes de valeurs consécutives, de couleurs quelconques.', lesson: 2, theme: 'Les mains' },
  { key: 'couleur', term: 'Couleur', en: 'flush', def: 'Cinq cartes de la même enseigne (pique, cœur, carreau ou trèfle).', lesson: 2, theme: 'Les mains' },
  { key: 'full', term: 'Full', en: 'full house', def: 'Un brelan et une paire.', lesson: 2, theme: 'Les mains' },
  { key: 'carre', term: 'Carré', en: 'four of a kind', def: 'Quatre cartes de même valeur.', lesson: 2, theme: 'Les mains' },
  { key: 'quinteflush', term: 'Quinte flush', en: 'straight flush', def: 'Une suite dont les cinq cartes sont de la même enseigne.', lesson: 2, theme: 'Les mains' },
  { key: 'royale', term: 'Quinte flush royale', en: 'royal flush', def: 'La quinte flush de 10 à l’As. La meilleure main du jeu.', lesson: 2, theme: 'Les mains' },
  // Leçon 3
  { key: 'enseigne', term: 'Enseigne', en: 'suit', def: 'Pique, cœur, carreau ou trèfle. Au poker, aucune enseigne n’est plus forte qu’une autre.', lesson: 3, theme: 'Les mains' },
  { key: 'roue', term: 'Roue', en: 'wheel', def: 'La plus petite suite : As-2-3-4-5. L’As y compte comme un 1.', lesson: 3, theme: 'Les mains' },
  // Leçon 4
  { key: 'boardjoue', term: 'Le board joue', en: 'playing the board', def: 'Situation où la meilleure main d’un joueur est formée par les cinq cartes communes.', lesson: 4, theme: 'Les mains' },
  // Leçon 5
  { key: 'kicker', term: 'Kicker', en: 'kicker', def: 'Carte qui ne fait pas partie de la combinaison mais départage deux mains de même combinaison.', lesson: 5, theme: 'Les mains' },
  { key: 'partage', term: 'Partage', en: 'split pot', def: 'Quand deux joueurs ont exactement la même main de 5 cartes, ils se partagent le pot.', lesson: 5, theme: 'Les mains' },
  // Leçon 6
  { key: 'bouton', term: 'Bouton', en: 'button, BTN', def: 'Jeton qui désigne le donneur fictif. Il tourne d’un siège vers la gauche à chaque main.', lesson: 6, theme: 'La donne' },
  { key: 'sb', term: 'Petite blinde', en: 'small blind, SB', def: 'Mise obligatoire du joueur à gauche du bouton, en général la moitié de la grosse blinde.', lesson: 6, theme: 'La donne' },
  { key: 'bb', term: 'Grosse blinde', en: 'big blind, BB', def: 'Mise obligatoire du joueur à gauche de la petite blinde. Elle sert aussi d’unité pour compter les tapis.', lesson: 6, theme: 'La donne' },
  { key: 'ante', term: 'Ante', en: 'ante', def: 'Petite mise obligatoire supplémentaire, fréquente en tournoi à partir d’un certain niveau.', lesson: 6, theme: 'La donne' },
  { key: 'niveau', term: 'Niveau de blindes', en: 'blind level', def: 'En tournoi, période pendant laquelle les blindes restent fixes avant d’augmenter.', lesson: 6, theme: 'La donne' },
  { key: 'headsup', term: 'Heads-up', en: 'heads-up', def: 'Partie ou coup à deux joueurs. Le bouton y est aussi la petite blinde.', lesson: 6, theme: 'La donne' },
  // Leçon 7
  { key: 'preflop', term: 'Préflop', en: 'preflop', def: 'Premier tour d’enchères, après la distribution des cartes privées.', lesson: 7, theme: 'La donne' },
  { key: 'flop', term: 'Flop', en: 'flop', def: 'Les trois premières cartes communes, retournées ensemble, et le tour d’enchères qui suit.', lesson: 7, theme: 'La donne' },
  { key: 'turn', term: 'Turn', en: 'turn', def: 'La quatrième carte commune et le tour d’enchères qui suit.', lesson: 7, theme: 'La donne' },
  { key: 'river', term: 'River', en: 'river', def: 'La cinquième et dernière carte commune, et le dernier tour d’enchères.', lesson: 7, theme: 'La donne' },
  { key: 'brulee', term: 'Carte brûlée', en: 'burn card', def: 'Carte écartée face cachée avant le flop, la turn et la river, pour éviter la triche.', lesson: 7, theme: 'La donne' },
  { key: 'parole', term: 'Parole', en: 'action', def: 'Le tour d’un joueur d’agir. On parle dans le sens des aiguilles d’une montre.', lesson: 7, theme: 'La donne' },
  // Leçon 8
  { key: 'check', term: 'Checker', en: 'check', def: 'Passer son tour sans miser. Possible seulement si personne n’a misé avant soi.', lesson: 8, theme: 'Les actions' },
  { key: 'miser', term: 'Miser', en: 'bet', def: 'Mettre des jetons dans le pot quand personne ne l’a encore fait dans ce tour.', lesson: 8, theme: 'Les actions' },
  { key: 'suivre', term: 'Suivre', en: 'call', def: 'Payer le montant de la mise en cours pour rester dans le coup.', lesson: 8, theme: 'Les actions' },
  { key: 'relancer', term: 'Relancer', en: 'raise', def: 'Augmenter le montant de la mise en cours.', lesson: 8, theme: 'Les actions' },
  { key: 'coucher', term: 'Se coucher', en: 'fold', def: 'Abandonner ses cartes et renoncer au pot.', lesson: 8, theme: 'Les actions' },
  { key: 'allin', term: 'Faire tapis', en: 'all-in', def: 'Miser tous ses jetons.', lesson: 8, theme: 'Les actions' },
  { key: 'minraise', term: 'Relance minimale', en: 'min-raise', def: 'Une relance doit augmenter la mise d’au moins l’écart de la mise ou relance précédente.', lesson: 8, theme: 'Les actions' },
  // Leçon 9
  { key: 'potannexe', term: 'Pot annexe', en: 'side pot', def: 'Pot séparé, formé des mises qu’un joueur à tapis ne peut pas couvrir. Il ne peut pas le gagner.', lesson: 9, theme: 'Le jeu' },
  { key: 'tapisbb', term: 'Tapis en BB', en: 'stack in big blinds', def: 'Taille d’un tapis exprimée en grosses blindes : tapis divisé par la grosse blinde.', lesson: 9, theme: 'Le jeu' },
  // Leçon 10
  { key: 'assortie', term: 'Main assortie', en: 'suited, s', def: 'Deux cartes privées de la même enseigne (ex. AKs).', lesson: 10, theme: 'Le préflop' },
  { key: 'depareillee', term: 'Main dépareillée', en: 'offsuit, o', def: 'Deux cartes privées d’enseignes différentes (ex. AKo).', lesson: 10, theme: 'Le préflop' },
  { key: 'domine', term: 'Main dominée', en: 'dominated hand', def: 'Main qui partage une carte avec une main adverse mais a un kicker plus faible (AJ face à AK).', lesson: 10, theme: 'Le préflop' },
  { key: 'broadway', term: 'Broadway', en: 'broadway', def: 'Les cartes du 10 à l’As. Une main « broadway » ne contient que ces cartes (KQ, AJ…).', lesson: 10, theme: 'Le préflop' },
  { key: 'connecteurs', term: 'Connecteurs assortis', en: 'suited connectors', def: 'Deux cartes consécutives de même enseigne (87s, 65s).', lesson: 10, theme: 'Le préflop' },
  // Leçon 11
  { key: 'position', term: 'Position', en: 'position', def: 'Place à la table par rapport au bouton. « Avoir la position » : parler après son adversaire.', lesson: 11, theme: 'Les positions' },
  { key: 'utg', term: 'UTG', en: 'under the gun', def: 'Premier joueur à parler préflop, juste à gauche de la grosse blinde.', lesson: 11, theme: 'Les positions' },
  { key: 'mp', term: 'MP / HJ', en: 'middle position, hijack', def: 'Positions du milieu, entre UTG+1 et le cutoff.', lesson: 11, theme: 'Les positions' },
  { key: 'co', term: 'Cutoff', en: 'cutoff, CO', def: 'Siège juste à droite du bouton.', lesson: 11, theme: 'Les positions' },
  // Leçon 12
  { key: 'ouvrir', term: 'Ouvrir', en: 'open', def: 'Être le premier à relancer préflop.', lesson: 12, theme: 'Le préflop' },
  { key: 'limp', term: 'Limper', en: 'limp', def: 'Entrer dans le coup préflop en suivant simplement la grosse blinde, sans relancer.', lesson: 12, theme: 'Le préflop' },
  { key: '3bet', term: '3-bet', en: '3-bet', def: 'Relance d’une relance. (La grosse blinde compte comme la 1re mise, l’ouverture comme la 2e.)', lesson: 12, theme: 'Le préflop' },
  { key: 'charte', term: 'Charte', en: 'chart, range', def: 'Tableau des mains à jouer selon la position. Ensemble de mains = « range ».', lesson: 12, theme: 'Le préflop' },
  // Leçon 13
  { key: 'nuts', term: 'Nuts', en: 'the nuts', def: 'La meilleure main possible sur un board donné.', lesson: 13, theme: 'Le postflop' },
  { key: 'sec', term: 'Board sec', en: 'dry board', def: 'Board aux cartes éloignées et de couleurs différentes : peu de suites ou couleurs possibles.', lesson: 13, theme: 'Le postflop' },
  { key: 'coordonne', term: 'Board coordonné', en: 'wet board', def: 'Board aux cartes proches ou de même couleur : beaucoup de tirages possibles.', lesson: 13, theme: 'Le postflop' },
  { key: 'toppair', term: 'Top paire', en: 'top pair', def: 'Paire formée avec la carte la plus haute du board.', lesson: 13, theme: 'Le postflop' },
  { key: 'overpair', term: 'Surpaire', en: 'overpair', def: 'Paire servie plus haute que toutes les cartes du board.', lesson: 13, theme: 'Le postflop' },
  { key: 'set', term: 'Set', en: 'set', def: 'Brelan formé avec une paire servie et une carte du board (plus caché qu’un brelan avec une paire au board).', lesson: 13, theme: 'Le postflop' },
  // Leçon 14
  { key: 'tirage', term: 'Tirage', en: 'draw', def: 'Main incomplète qui a besoin d’une carte précise pour devenir forte.', lesson: 14, theme: 'Le postflop' },
  { key: 'out', term: 'Out', en: 'out', def: 'Carte restante qui améliore sa main en main probablement gagnante.', lesson: 14, theme: 'Le postflop' },
  { key: 'ouverte', term: 'Suite ouverte', en: 'open-ended straight draw', def: 'Quatre cartes consécutives : deux valeurs complètent la suite (8 outs).', lesson: 14, theme: 'Le postflop' },
  { key: 'ventrale', term: 'Suite ventrale', en: 'gutshot', def: 'Tirage à suite où une seule valeur, au milieu, complète la suite (4 outs).', lesson: 14, theme: 'Le postflop' },
  { key: 'regle24', term: 'Règle du 2 et du 4', en: 'rule of 2 and 4', def: 'Outs × 2 ≈ % de toucher à la carte suivante ; outs × 4 ≈ % sur deux cartes (si l’on voit turn et river).', lesson: 14, theme: 'Les chiffres' },
  // Leçon 15
  { key: 'cote', term: 'Cote du pot', en: 'pot odds', def: 'Rapport entre ce qu’il faut payer et ce que l’on peut gagner. Donne l’équité minimale pour suivre.', lesson: 15, theme: 'Les chiffres' },
  { key: 'equite', term: 'Équité', en: 'equity', def: 'Part du pot qui nous revient en moyenne : nos chances de gagner la main.', lesson: 15, theme: 'Les chiffres' },
  { key: 'variance', term: 'Variance', en: 'variance', def: 'Écarts dus au hasard entre les résultats obtenus et les résultats attendus.', lesson: 15, theme: 'Les chiffres' },
  // Leçon 16
  { key: 'valeur', term: 'Mise de valeur', en: 'value bet', def: 'Mise faite avec une main forte, pour être payé par des mains moins bonnes.', lesson: 16, theme: 'Le postflop' },
  { key: 'bluff', term: 'Bluff', en: 'bluff', def: 'Mise faite avec une main faible, pour faire coucher des mains meilleures.', lesson: 16, theme: 'Le postflop' },
  { key: 'cbet', term: 'C-bet', en: 'continuation bet', def: 'Mise au flop du joueur qui a relancé préflop, qu’il ait touché ou non.', lesson: 16, theme: 'Le postflop' },
  { key: 'sizing', term: 'Sizing', en: 'bet sizing', def: 'Taille d’une mise, souvent exprimée en fraction du pot (1/3, 1/2, 2/3, pot).', lesson: 16, theme: 'Le postflop' },
  { key: 'station', term: 'Calling station', en: 'calling station', def: 'Joueur qui suit presque tout. On le bluffe peu et on mise beaucoup pour la valeur contre lui.', lesson: 16, theme: 'Le jargon' },
  // Leçon 18
  { key: 'coinflip', term: 'Coin flip', en: 'coin flip', def: 'Confrontation à environ 50/50, typiquement une paire contre deux cartes plus hautes.', lesson: 18, theme: 'Les chiffres' },
  // Leçon 19
  { key: 'isoler', term: 'Isoler', en: 'isolate', def: 'Relancer après un limp pour jouer le coup seul contre ce joueur.', lesson: 19, theme: 'Le jargon' },
  { key: 'tilt', term: 'Tilt', en: 'tilt', def: 'État d’énervement qui fait mal jouer, souvent après un coup perdu.', lesson: 19, theme: 'Le jargon' },
  { key: 'badbeat', term: 'Bad beat', en: 'bad beat', def: 'Coup perdu alors qu’on était très favori.', lesson: 19, theme: 'Le jargon' },
  { key: 'itm', term: 'ITM', en: 'in the money', def: 'Être « dans l’argent » : avoir atteint les places payées d’un tournoi.', lesson: 19, theme: 'Le jargon' },
  { key: 'bulle', term: 'Bulle', en: 'bubble', def: 'Moment d’un tournoi juste avant les places payées.', lesson: 19, theme: 'Le jargon' },
  { key: 'shortstack', term: 'Short stack', en: 'short stack', def: 'Joueur avec peu de jetons par rapport aux blindes (souvent moins de 15 BB).', lesson: 19, theme: 'Le jargon' },
  // Leçon 20
  { key: 'stringbet', term: 'String bet', en: 'string bet', def: 'Mise posée en plusieurs gestes sans annonce. Interdite : seul le premier geste compte.', lesson: 20, theme: 'La table' },
  { key: 'muck', term: 'Muck', en: 'muck', def: 'Le tas des cartes écartées. Une main qui y touche est morte.', lesson: 20, theme: 'La table' },
  { key: 'annonce', term: 'Annonce verbale', en: 'verbal declaration', def: 'Dire son action à voix haute. Elle engage le joueur.', lesson: 20, theme: 'La table' },
  { key: 'cartesparlent', term: 'Les cartes parlent', en: 'cards speak', def: 'Une main vaut ce que montrent ses cartes, quoi qu’ait annoncé le joueur.', lesson: 20, theme: 'La table' },
];

export const TERM_BY_KEY: Record<string, Term> = Object.fromEntries(TERMS.map(t => [t.key, t]));

export function termsOfLesson(id: number): Term[] { return TERMS.filter(t => t.lesson === id); }
