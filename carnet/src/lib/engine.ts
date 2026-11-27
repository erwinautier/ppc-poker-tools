/**
 * Moteur d'une main de No Limit Hold'em, pour la rejouer action par action.
 *
 * Les places sont rangées dans l'ordre de parole préflop (UTG … BTN, SB, BB) :
 * l'indice d'un joueur est donc aussi sa position. Une action donne le joueur,
 * sa nature et, pour une mise ou une relance, le total engagé dans le tour.
 * Le moteur calcule le reste : à qui de parler, pot, tapis restants, mise non
 * suivie rendue, fin des tours et de la main.
 *
 * C'est un outil de prise de notes, pas un arbitre : une relance trop petite
 * (tapis court, erreur de mémoire) est acceptée telle quelle.
 */
import type { Card } from './cards';

export type Street = 0 | 1 | 2 | 3;
export const STREETS = ['Préflop', 'Flop', 'Turn', 'River'] as const;
/** Cartes du board visibles à chaque tour d'enchères. */
export const BOARD_AT = [0, 3, 4, 5] as const;

export type Kind = 'fold' | 'check' | 'call' | 'bet' | 'raise';
export interface Action { p: number; k: Kind; to?: number }

/** bb : une ante payée par la grosse blinde pour toute la table ; each : chaque joueur paie la sienne. */
export type AnteMode = 'bb' | 'each';
export interface Blinds { sb: number; bb: number; ante: number; anteMode: AnteMode }

export interface Seat { stack: number; cards?: Card[] }

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

const POSITIONS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};
export const clampPlayers = (n: number) => Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(n) || 9));
export const positions = (n: number): string[] => POSITIONS[clampPlayers(n)];
/** En tête-à-tête, le bouton paie la petite blinde. */
export const sbIndex = (n: number) => (n === 2 ? 0 : n - 2);
export const bbIndex = (n: number) => n - 1;
export const buttonIndex = (n: number) => (n === 2 ? 0 : n - 3);

/** Ordre de parole : préflop UTG d'abord ; ensuite à partir de la petite blinde (la grosse en tête-à-tête). */
export function order(n: number, street: Street): number[] {
  const all = Array.from({ length: n }, (_, i) => i);
  if (street === 0) return all;
  if (n === 2) return [1, 0];
  return [n - 2, n - 1, ...all.slice(0, n - 2)];
}

export interface Player {
  stack: number;
  /** Engagé dans le tour en cours. */
  bet: number;
  /** Engagé depuis le début de la main, antes comprises. */
  put: number;
  folded: boolean;
  allin: boolean;
}

export interface State {
  n: number;
  street: Street;
  ps: Player[];
  /** Jetons ramassés : tours précédents et antes (hors mises du tour en cours). */
  pot: number;
  /** Plus grosse mise du tour. */
  current: number;
  /** Écart de la dernière relance complète : la relance minimale suivante. */
  minRaise: number;
  acted: boolean[];
  toAct: number | null;
  /** Plus aucune enchère possible : abattage, ou un seul joueur restant. */
  over: boolean;
  /** Fin par abandon : le joueur qui reste. */
  won: number | null;
  /** Mise non suivie rendue à la clôture du tour. */
  returned: { p: number; amount: number } | null;
}

const clone = (s: State): State => ({ ...s, ps: s.ps.map(p => ({ ...p })), acted: [...s.acted], returned: null });
const needs = (s: State, i: number) => {
  const p = s.ps[i];
  return !p.folded && !p.allin && (!s.acted[i] || p.bet < s.current);
};
const live = (s: State) => s.ps.flatMap((p, i) => (p.folded ? [] : [i]));

function firstToAct(s: State): number | null {
  return order(s.n, s.street).find(i => needs(s, i)) ?? null;
}
function nextAfter(s: State, from: number): number | null {
  const o = order(s.n, s.street);
  const at = o.indexOf(from);
  for (let k = 1; k <= o.length; k++) {
    const i = o[(at + k) % o.length];
    if (needs(s, i)) return i;
  }
  return null;
}

/** Clôt le tour : rend la mise que personne n'a suivie, puis ramasse les mises. */
function closeStreet(s: State) {
  const bets = s.ps.map(p => p.bet);
  const max = Math.max(...bets);
  const top = bets.flatMap((b, i) => (b === max ? [i] : []));
  if (max > 0 && top.length === 1) {
    const i = top[0];
    const back = max - Math.max(0, ...bets.filter((_, j) => j !== i));
    if (back > 0) {
      const p = s.ps[i];
      p.stack += back; p.bet -= back; p.put -= back; p.allin = p.stack === 0;
      s.returned = { p: i, amount: back };
    }
  }
  s.pot += s.ps.reduce((t, p) => t + p.bet, 0);
  for (const p of s.ps) p.bet = 0;
}

function settle(s: State, bb: number) {
  closeStreet(s);
  const left = live(s);
  s.toAct = null;
  if (left.length === 1) { s.over = true; s.won = left[0]; return; }
  const active = left.filter(i => !s.ps[i].allin);
  if (s.street === 3 || active.length <= 1) { s.over = true; return; }
  s.street = (s.street + 1) as Street;
  s.current = 0;
  s.minRaise = bb;
  s.acted = s.acted.map(() => false);
  s.toAct = firstToAct(s);
  if (s.toAct === null) settle(s, bb);
}

/** Antes et blindes posées ; le premier joueur va parler. */
export function start(blinds: Blinds, seats: Seat[]): State {
  const n = seats.length;
  const ps: Player[] = seats.map(x => ({ stack: Math.max(0, Math.round(x.stack)), bet: 0, put: 0, folded: false, allin: false }));
  const pay = (i: number, amount: number) => {
    const p = ps[i];
    const a = Math.max(0, Math.min(Math.round(amount), p.stack));
    p.stack -= a; p.put += a;
    if (p.stack === 0) p.allin = true;
    return a;
  };
  let pot = 0;
  if (blinds.ante > 0) {
    if (blinds.anteMode === 'each') for (let i = 0; i < n; i++) pot += pay(i, blinds.ante);
    else pot += pay(bbIndex(n), blinds.ante);
  }
  ps[sbIndex(n)].bet += pay(sbIndex(n), blinds.sb);
  ps[bbIndex(n)].bet += pay(bbIndex(n), blinds.bb);
  const s: State = {
    n, street: 0, ps, pot, current: Math.max(...ps.map(p => p.bet)), minRaise: Math.max(1, blinds.bb),
    acted: ps.map(() => false), toAct: null, over: false, won: null, returned: null,
  };
  s.toAct = firstToAct(s);
  if (s.toAct === null) settle(s, blinds.bb);
  return s;
}

/** Joue une action ; renvoie le nouvel état, ou la raison du refus. */
export function apply(s0: State, a: Action, bb: number): State | string {
  if (s0.over || s0.toAct === null) return 'La main est terminée.';
  if (a.p !== s0.toAct) return 'Ce n\'est pas à ce joueur de parler.';
  const s = clone(s0);
  const p = s.ps[a.p];
  const diff = s.current - p.bet;
  switch (a.k) {
    case 'fold':
      p.folded = true;
      break;
    case 'check':
      if (diff > 0) return 'Impossible de checker face à une mise.';
      break;
    case 'call': {
      if (diff <= 0) return 'Il n\'y a rien à suivre.';
      const add = Math.min(diff, p.stack);
      p.stack -= add; p.bet += add; p.put += add;
      break;
    }
    case 'bet':
    case 'raise': {
      if (a.k === 'bet' && s.current > 0) return 'Il y a déjà une mise : c\'est une relance.';
      if (a.k === 'raise' && s.current === 0) return 'Personne n\'a misé : c\'est une mise.';
      const to = Math.min(Math.round(a.to ?? 0), p.bet + p.stack);
      if (to <= s.current) return 'Le montant doit dépasser la mise en cours.';
      const add = to - p.bet;
      p.stack -= add; p.put += add; p.bet = to;
      if (to - s.current >= s.minRaise) s.minRaise = to - s.current;
      s.current = to;
      s.acted = s.acted.map((x, i) => (i === a.p ? x : false));
      break;
    }
    default:
      return 'Action inconnue.';
  }
  if (!p.folded && p.stack === 0) p.allin = true;
  s.acted[a.p] = true;
  if (live(s).length === 1) { settle(s, bb); return s; }
  const next = nextAfter(s, a.p);
  if (next === null) settle(s, bb);
  else s.toAct = next;
  return s;
}

export interface Replay {
  /** États successifs : avant la première action, puis après chacune. */
  states: State[];
  /** Première action refusée (main modifiée après coup) : les suivantes sont ignorées. */
  error: { index: number; message: string } | null;
}

export function replay(blinds: Blinds, seats: Seat[], actions: Action[]): Replay {
  let s = start(blinds, seats);
  const states = [s];
  for (let i = 0; i < actions.length; i++) {
    const r = apply(s, actions[i], blinds.bb);
    if (typeof r === 'string') return { states, error: { index: i, message: r } };
    s = r;
    states.push(s);
  }
  return { states, error: null };
}

// ── Lectures ─────────────────────────────────────────────────────────────────

export const potOf = (s: State) => s.pot + s.ps.reduce((t, p) => t + p.bet, 0);
/** Ce que doit mettre le joueur qui parle pour suivre. */
export function toCall(s: State): number {
  if (s.toAct === null) return 0;
  const p = s.ps[s.toAct];
  return Math.max(0, Math.min(s.current - p.bet, p.stack));
}
/** Cote du pot : part du pot final que représente le paiement (null s'il n'y a rien à payer). */
export function potOdds(s: State): number | null {
  const c = toCall(s);
  return c > 0 ? c / (potOf(s) + c) : null;
}
/** Tapis effectif du joueur face aux adversaires encore en jeu (jetons du tour compris). */
export function effective(s: State, i: number): number {
  const mine = s.ps[i].stack + s.ps[i].bet;
  const others = s.ps.filter((q, j) => j !== i && !q.folded).map(q => q.stack + q.bet);
  return others.length ? Math.min(mine, Math.max(...others)) : 0;
}
/** Rapport tapis effectif / pot, au début d'un tour après le flop. */
export function spr(s: State, i: number): number | null {
  const pot = potOf(s);
  return pot > 0 ? effective(s, i) / pot : null;
}

/** Cartes du board encore à donner avant de continuer ; à l'abattage, le reste du board est facultatif. */
export function boardMissing(s: State, boardLength: number): { count: number; optional: boolean } {
  if (s.over) return s.won === null ? { count: Math.max(0, 5 - boardLength), optional: true } : { count: 0, optional: true };
  return { count: Math.max(0, BOARD_AT[s.street] - boardLength), optional: false };
}

/** Pas de jeton plus petit que nécessaire dans les tailles proposées. */
export function chipUnit(bb: number): number {
  if (bb >= 1000) return 100;
  if (bb >= 200) return 50;
  if (bb >= 50) return 25;
  if (bb >= 10) return 5;
  return 1;
}

/** Un adversaire pourrait-il encore répondre à une relance ? (sinon : suivre ou passer seulement) */
export const canReopen = (s: State, i: number) => s.ps.some((q, j) => j !== i && !q.folded && !q.allin);

export interface Size { label: string; to: number; allin: boolean }

/** Tailles toutes prêtes pour le joueur qui parle (montants totaux du tour), tapis compris. */
export function sizes(s: State, bb: number): Size[] {
  const i = s.toAct;
  if (i === null) return [];
  const p = s.ps[i];
  const max = p.bet + p.stack;
  if (max <= s.current || !canReopen(s, i)) return [];
  const unit = chipUnit(bb);
  const minTo = s.current === 0 ? Math.min(max, Math.max(1, bb)) : Math.min(max, s.current + s.minRaise);
  const out: Size[] = [];
  const add = (label: string, x: number) => {
    const to = Math.max(minTo, Math.round(x / unit) * unit);
    if (to >= max || out.some(o => o.to === to)) return;
    out.push({ label, to, allin: false });
  };
  const pot = potOf(s);
  if (s.current === 0) {
    add('⅓ pot', pot / 3); add('½ pot', pot / 2); add('⅔ pot', (pot * 2) / 3); add('Pot', pot);
  } else if (s.street === 0 && s.current <= bb) {
    add('2 bb', 2 * bb); add('2,5 bb', 2.5 * bb); add('3 bb', 3 * bb);
  } else {
    add('×2,5', s.current * 2.5); add('×3', s.current * 3);
    if (s.street > 0) add('Pot', s.current + pot + (s.current - p.bet));
  }
  out.push({ label: 'Tapis', to: max, allin: true });
  return out;
}
/** Plus petit total accepté pour une mise ou une relance. */
export function minTotal(s: State, bb: number): number {
  if (s.toAct === null) return 0;
  const p = s.ps[s.toAct];
  const max = p.bet + p.stack;
  return s.current === 0 ? Math.min(max, Math.max(1, bb)) : Math.min(max, s.current + s.minRaise);
}

/** L'action telle qu'on la raconte, montants compris (lue dans l'état d'avant). */
export interface Told { k: Kind; to: number; allin: boolean }
export function tell(prev: State, a: Action): Told {
  const p = prev.ps[a.p];
  const max = p.bet + p.stack;
  if (a.k === 'call') { const to = Math.min(prev.current, max); return { k: a.k, to, allin: to === max }; }
  if (a.k === 'bet' || a.k === 'raise') { const to = Math.min(a.to ?? 0, max); return { k: a.k, to, allin: to === max }; }
  return { k: a.k, to: 0, allin: false };
}
