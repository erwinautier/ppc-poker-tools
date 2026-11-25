export type Role = 'member' | 'director' | 'admin';
export type Visibility = 'members' | 'public';
export type TournamentStatus = 'draft' | 'open' | 'closed' | 'running' | 'finished' | 'cancelled';
export type EntryStatus = 'registered' | 'waitlist' | 'cancelled';

export interface Member {
  id: string;
  user_id: string | null;
  name: string;
  role: Role;
  active: boolean;
  created_at: string;
  /** Trésorerie de la buvette : valide les paiements. Absent avant le script 003. */
  treasurer?: boolean;
}

export interface JoinRequest {
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
}

/** Compte de la suite PPC Poker Tools ; validé, il a une fiche d'adhérent. */
export interface Account {
  user_id: string;
  username: string | null;
  /** Nom que la personne a indiqué au club. */
  asked: string | null;
  /** Compte à valider : visible de toute l'équipe. Adhérent : des administrateurs seulement. */
  email: string | null;
  confirmed: boolean;
  created_at: string;
  member_id: string | null;
  refused: boolean;
}
export type AccountStatus = 'ok' | 'pending' | 'refused';

export interface Level {
  kind: 'level' | 'break';
  sb: number;
  bb: number;
  ante: number;
  minutes: number;
  label?: string;
}

/** Jeton de la mallette : valeur, couleur, nombre distribué à chaque joueur. */
export interface Chip {
  value: number;
  color: string;
  count: number;
}

export interface Structure {
  id: string;
  name: string;
  description: string;
  starting_stack: number;
  levels: Level[];
  chips: Chip[];
  created_at: string;
}

export interface Bracket {
  minPlayers: number;
  points: number[];
}

export interface Scoring {
  method: 'table' | 'linear' | 'sqrt';
  /** table : barème par place, choisi selon le nombre de joueurs. */
  brackets: Bracket[];
  /** linear : (joueurs - place + 1) x factor ; sqrt : factor x racine(joueurs / place). */
  factor: number;
  participation: number;
  koPoints: number;
  /** Nombre de résultats retenus (null = tous). */
  bestOf: number | null;
  /** Les invités (sans fiche adhérent) figurent-ils au classement ? */
  rankGuests: boolean;
}

export interface Championship {
  id: string;
  name: string;
  season: string;
  description: string;
  status: 'active' | 'archived';
  visibility: Visibility;
  scoring: Scoring;
  created_at: string;
}

export type BountyMode = 'none' | 'fixed' | 'progressive';
export type BountyUnit = 'pts' | 'eur' | 'lot';

export interface Settings {
  /** Coefficient des points de place dans le championnat. */
  coefficient: number;
  buyIn: number;
  fee: number;
  /** Dernier niveau (numéro affiché) d'inscription tardive ; 0 = aucune. */
  lateRegLevel: number;
  rebuy: { enabled: boolean; price: number; stack: number; untilLevel: number; max: number };
  addon: { enabled: boolean; price: number; stack: number };
  bounty: { mode: BountyMode; unit: BountyUnit; amount: number };
  payouts: { mode: 'none' | 'auto' | 'percent' | 'lots'; percents: number[]; lots: string[]; rounding: number };
}

export interface Tournament {
  id: string;
  championship_id: string | null;
  name: string;
  description: string;
  venue: string;
  starts_at: string;
  status: TournamentStatus;
  visibility: Visibility;
  max_players: number | null;
  seats_per_table: number;
  starting_stack: number;
  structure_name: string;
  levels: Level[];
  chips: Chip[];
  settings: Settings;
  clock_level: number;
  clock_elapsed_ms: number;
  clock_anchor: string | null;
  finished_at: string | null;
  rev: number;
  created_at: string;
}

export interface Entry {
  id: string;
  tournament_id: string;
  member_id: string | null;
  name: string;
  status: EntryStatus;
  registered_at: string;
  checked_in: boolean;
  rebuys: number;
  addons: number;
  table_no: number | null;
  seat_no: number | null;
  /** Prime posée sur la tête de ce joueur (remplace la prime du tournoi). */
  bounty_start: number | null;
  points_adjust: number;
  final_position: number | null;
  final_kos: number | null;
  final_bounty: number | null;
}

export interface Payment {
  entry_id: string;
  tournament_id: string;
}

export interface Knockout {
  id: string;
  seq: number;
  tournament_id: string;
  victim_id: string;
  killer_ids: string[];
  rebuy: boolean;
  level: number | null;
  created_at: string;
}

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Brouillon',
  open: 'Inscriptions ouvertes',
  closed: 'Inscriptions fermées',
  running: 'En direct',
  finished: 'Terminé',
  cancelled: 'Annulé',
};

export const ROLE_LABEL: Record<Role, string> = {
  member: 'Adhérent',
  director: 'Gestionnaire',
  admin: 'Administrateur',
};

export const ROLE_HINT: Record<Role, string> = {
  member: 'Consulte et s\'inscrit aux tournois',
  director: 'Gère tournois, championnats, horloge, structures et adhérents',
  admin: 'Comme un gestionnaire, et nomme gestionnaires et administrateurs',
};

/** Ceux qui gèrent le club, administrateurs d'abord. */
export function clubTeam(members: Member[]): Member[] {
  return members.filter(m => m.active && m.role !== 'member')
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name, 'fr'));
}

/** Même règle que la base : le club garde un administrateur actif, avec un compte. */
export function isLastAdmin(members: Member[], m: Member): boolean {
  const counts = (x: Member) => x.role === 'admin' && x.active && !!x.user_id;
  return counts(m) && !members.some(x => x.id !== m.id && counts(x));
}

export const DEFAULT_SETTINGS: Settings = {
  coefficient: 1,
  buyIn: 0,
  fee: 0,
  lateRegLevel: 4,
  rebuy: { enabled: false, price: 0, stack: 0, untilLevel: 4, max: 1 },
  addon: { enabled: false, price: 0, stack: 0 },
  bounty: { mode: 'none', unit: 'pts', amount: 0 },
  payouts: { mode: 'none', percents: [50, 30, 20], lots: [], rounding: 1 },
};

/** Les points par place repris du modèle de la première version de PokerClub. */
export const DEFAULT_SCORING: Scoring = {
  method: 'table',
  brackets: [{ minPlayers: 0, points: [100, 75, 55, 40, 30, 20, 15, 10] }],
  factor: 1,
  participation: 5,
  koPoints: 0,
  bestOf: null,
  rankGuests: false,
};

/** Complète les réglages enregistrés par une version antérieure de l'application. */
export function withSettings(s: Partial<Settings> | null | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    ...d, ...s,
    rebuy: { ...d.rebuy, ...s?.rebuy },
    addon: { ...d.addon, ...s?.addon },
    bounty: { ...d.bounty, ...s?.bounty },
    payouts: { ...d.payouts, ...s?.payouts },
  };
}

export function withScoring(s: Partial<Scoring> | null | undefined): Scoring {
  return { ...DEFAULT_SCORING, ...s };
}
