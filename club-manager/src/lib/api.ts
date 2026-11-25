/**
 * Accès aux données. Deux implémentations :
 *  - supabaseApi : la vraie base, partagée avec la suite ;
 *  - demoApi     : un club fictif dans le navigateur (adresse « ?demo »).
 */
export interface AuthUser { id: string; email: string }

export interface Query {
  eq?: Record<string, string | number | boolean>;
  in?: [column: string, values: string[]];
  order?: [column: string, direction: 'asc' | 'desc'];
}

export type TableName =
  | 'club_members' | 'club_join_requests' | 'club_structures' | 'club_championships'
  | 'club_tournaments' | 'club_entries' | 'club_payments' | 'club_knockouts';

export type Rpc =
  | 'club_request_join' | 'club_approve_request' | 'club_register' | 'club_unregister'
  | 'club_set_clock' | 'club_save_seats' | 'club_finish' | 'club_reopen';

export interface Api {
  kind: 'cloud' | 'demo';
  /** Heure du serveur, en ms : la même sur tous les écrans. */
  now(): number;
  user(): Promise<AuthUser | null>;
  onAuth(cb: (user: AuthUser | null, event: string) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, username: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  select<T>(table: TableName, q?: Query): Promise<T[]>;
  insert<T>(table: TableName, rows: object | object[]): Promise<T[]>;
  update(table: TableName, id: string, patch: object): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  rpc<T = void>(fn: Rpc, args?: object): Promise<T>;
  /** Prévient à chaque changement d'un tournoi (inscriptions et éliminations comprises). */
  watch(cb: (tournamentId: string | null) => void): () => void;
}

/** Les tables n'existent pas encore : le script SQL n'a pas été exécuté. */
export class NotInstalled extends Error {}

export function messageOf(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return 'Pas de connexion : la modification n\'est pas enregistrée.';
  if (/row-level security|permission denied/i.test(raw)) return 'Action réservée aux organisateurs.';
  if (/club_knockouts_out/i.test(raw)) return 'Ce joueur est déjà éliminé.';
  if (/club_entries_tournament_id_member_id_key/i.test(raw)) return 'Cet adhérent est déjà inscrit.';
  if (/invalid login credentials/i.test(raw)) return 'Adresse ou mot de passe incorrect.';
  if (/email not confirmed/i.test(raw)) return 'Adresse non confirmée : ouvre le lien reçu par e-mail.';
  if (/user already registered/i.test(raw)) return 'Un compte existe déjà avec cette adresse.';
  if (/for security purposes|rate limit/i.test(raw)) return 'Trop de demandes : patiente une minute avant de réessayer.';
  return raw;
}
