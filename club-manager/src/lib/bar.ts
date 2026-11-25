/**
 * Buvette : l'ardoise de chacun. Types, calculs et contrat commun à la vraie base
 * (cloudBar) et à la démo (demoBar). Montants en centimes : jamais d'arrondi sur de l'argent.
 */
export interface BarItem { id: string; name: string; emoji: string; price: number; active: boolean; sort: number }

/** Une consommation, ou une correction (item_id nul). Le prix est celui du moment. */
export interface BarLine {
  id: string;
  item_id: string | null;
  label: string;
  price: number;
  /** Pour un invité, sur l'ardoise de l'adhérent. */
  guest: boolean;
  /** Qui l'a notée, si ce n'est pas la personne elle-même. */
  by: string | null;
  created_at: string;
  cancelled_at: string | null;
  /** Gardée sur l'appareil, pas encore envoyée. */
  queued?: boolean;
}

export type PayMethod = 'cash' | 'transfer' | 'other';
export type PayStatus = 'pending' | 'validated' | 'refused';
export interface BarPayment {
  id: string;
  member_id: string;
  name: string;
  amount: number;
  method: PayMethod;
  status: PayStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface BarSettings {
  /** À partir de ce montant, l'ardoise est signalée. */
  alert: number;
  /** Une ardoise plus ancienne est signalée aussi. */
  days: number;
  /** Comment payer, affiché aux adhérents et dans les rappels. */
  payInfo: string;
}
export const DEFAULT_BAR: BarSettings = { alert: 2000, days: 30, payInfo: 'Espèces dans la caisse, ou virement au club.' };

/** Ce que la base renvoie pour une ardoise. */
export interface RawSlate {
  member_id: string;
  name: string;
  active: boolean;
  /** A un compte : peut recevoir un rappel dans l'application. */
  account: boolean;
  taken: number;
  paid: number;
  /** Déclaré, pas encore validé. */
  pending: number;
  /** Date de la plus ancienne conso ni payée, ni couverte par un paiement déclaré. */
  since: string | null;
  last: string | null;
  /** Dernier rappel, tant qu'il reste quelque chose à payer. */
  reminder: { created_at: string; seen_at: string | null } | null;
}
export interface Slate extends RawSlate {
  /** Négatif : avance. */
  due: number;
  /** Ce qui reste à déclarer. */
  open: number;
}
export const totals = (r: RawSlate): Slate => ({ ...r, due: r.taken - r.paid, open: Math.max(0, r.taken - r.paid - r.pending) });
export const bySize = (a: Slate, b: Slate) => b.due - a.due || a.name.localeCompare(b.name, 'fr');

/** Ce que la personne connectée a le droit de voir. */
export interface BarData {
  items: BarItem[];
  settings: BarSettings;
  /** Voit toutes les ardoises : gestionnaires, administrateurs, trésorerie. */
  manage: boolean;
  /** Valide les paiements : trésorerie et administrateurs. */
  validate: boolean;
  slate: Slate;
  lines: BarLine[];
  payments: BarPayment[];
  team: { slates: Slate[]; pending: BarPayment[] } | null;
  /** Consos gardées sur l'appareil faute de réseau. */
  queued: number;
}

/** Le comptoir : les noms, les produits, les traits de la soirée, et rien d'autre. */
export interface Counter {
  items: BarItem[];
  people: { id: string; name: string }[];
  tally: { member_id: string; item_id: string; n: number }[];
  queued: number;
}
export interface Kiosk { id: string; name: string; created_at: string; used_at: string | null }
export interface ItemStat { label: string; count: number; amount: number; guests: number }

export const METHOD: Record<PayMethod, string> = { cash: 'Espèces', transfer: 'Virement', other: 'Autre' };
/** Une conso notée par erreur s'annule soi-même pendant ce délai. */
export const UNDO_MINUTES = 10;

const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (cents: number) => `${nf.format(cents / 100).replace(/ /g, ' ')} €`;
/** Saisie en euros vers des centimes exacts. */
export const cents = (euros: number) => Math.round(euros * 100);

const DAY = 86_400_000;
export const daysSince = (iso: string | null, now: number) => iso ? Math.floor((now - Date.parse(iso)) / DAY) : 0;

/** En retard : trop lourde ou trop ancienne, une fois retiré ce qui attend la validation. */
export function isLate(s: Slate, set: BarSettings, now: number): boolean {
  return s.open > 0 && (s.open >= set.alert || daysSince(s.since, now) >= set.days);
}

export function canUndo(l: BarLine, now: number): boolean {
  return l.cancelled_at === null && l.item_id !== null && now - Date.parse(l.created_at) < UNDO_MINUTES * 60_000;
}

export function reminderText(s: Slate, set: BarSettings): string {
  const since = s.since ? `, depuis le ${new Date(s.since).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : '';
  return `Bonjour ${s.name.split(' ')[0]}, petit rappel de la buvette : ton ardoise est de ${money(s.open)}${since}. ${set.payInfo} Merci !`.replace(/\s{2,}/g, ' ');
}

export function csv(list: Slate[]): string {
  const cell = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const n = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '';
  return '﻿' + [['Adhérent', 'Consommé', 'Payé', 'En attente', 'Reste dû', 'Impayé depuis'].map(cell).join(';'),
    ...list.map(s => [cell(s.name), n(s.taken), n(s.paid), n(s.pending), n(s.due), cell(day(s.since))].join(';'))].join('\r\n');
}

/** Opérations de la buvette. Les règles sont celles de 003_club_bar.sql. */
export interface BarApi {
  /** Nul tant que le script 003 n'est pas exécuté. */
  load(): Promise<BarData | null>;
  detail(memberId: string): Promise<{ lines: BarLine[]; payments: BarPayment[] }>;
  report(from: number): Promise<ItemStat[]>;
  counter(): Promise<Counter>;
  /** Rend l'identifiant de la conso, et si elle attend le réseau. */
  take(memberId: string, item: BarItem, guest?: boolean): Promise<{ id: string; queued: boolean }>;
  undo(lineId: string): Promise<void>;
  declare(amount: number, method: PayMethod): Promise<void>;
  withdraw(paymentId: string): Promise<void>;
  decide(paymentId: string, ok: boolean): Promise<void>;
  /** Paiement reçu en main propre : validé d'emblée. */
  receive(memberId: string, amount: number, method: PayMethod): Promise<void>;
  /** Reprise du tableau papier, erreur, geste : + ajoute à l'ardoise, - en retire. */
  adjust(memberId: string, amount: number, label: string): Promise<void>;
  remind(memberIds: string[]): Promise<number>;
  seen(): Promise<void>;
  saveItem(item: Pick<BarItem, 'name' | 'emoji' | 'price' | 'active'> & { id?: string }): Promise<void>;
  moveItem(id: string, by: -1 | 1): Promise<void>;
  saveSettings(s: BarSettings): Promise<void>;
  kiosks(): Promise<Kiosk[]>;
  /** Rend la clé, montrée une seule fois. */
  createKiosk(name: string): Promise<string>;
  revokeKiosk(id: string): Promise<void>;
  /** Prévient quand il faut relire. */
  watch(cb: () => void): () => void;
}
