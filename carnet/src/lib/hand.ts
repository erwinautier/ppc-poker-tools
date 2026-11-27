/** Une main notée : contexte, places, actions, board ; et sa lecture en phrases. */
import { cardsText, isCard, type Card } from './cards';
import { chips } from './format';
import {
  BOARD_AT, MAX_PLAYERS, MIN_PLAYERS, positions, potOf, replay, tell,
  type Action, type AnteMode, type Blinds, type Kind, type Replay, type Seat, type State, type Street,
} from './engine';

/** Le tournoi où la main a été jouée. */
export interface Ctx {
  /** club : un tournoi du Club, blindes lues sur son horloge ; other : saisi à la main. */
  kind: 'club' | 'other';
  name: string;
  /** Numéro du niveau, s'il est connu. */
  level: number | null;
  blinds: Blinds;
  /** Joueurs à la table, pour la prochaine main. */
  table: number;
  tournamentId?: string;
  /** Blindes changées à la main : l'horloge du club ne les remplace plus. */
  manual?: boolean;
}

/** Ce qui se partage : jamais la note personnelle. */
export interface HandData {
  v: 1;
  date: number;
  ctx: Ctx;
  /** Dans l'ordre de parole préflop (voir engine.ts). */
  seats: Seat[];
  hero: number;
  actions: Action[];
  board: Card[];
  /** Indice de l'action du héros soumise à la question « Et toi ? ». */
  decision: number | null;
  /** Gagnants à l'abattage (vide si inconnu, ou main gagnée sans abattage). */
  winners: number[];
  tags: string[];
  /** Déroulé saisi en entier (sinon : note express). */
  complete: boolean;
}

export interface Hand extends HandData {
  id: string;
  updated: number;
  /** Note libre, privée : elle ne quitte jamais le téléphone. */
  note: string;
  /** Identifiant de la main publiée au club. */
  published?: string;
}

export const TAGS = ['Hésitation', 'À revoir', 'Erreur ?', 'Bad beat', 'Cooler', 'Belle main'] as const;

export const heroCards = (h: HandData): Card[] => h.seats[h.hero]?.cards ?? [];
export const replayOf = (h: HandData): Replay => replay(h.ctx.blinds, h.seats, h.actions);
export const seatName = (h: HandData, i: number) => positions(h.seats.length)[i] + (i === h.hero ? ' (héros)' : '');

export function blindsText(b: Blinds): string {
  const ante = b.ante > 0 ? `, ante ${chips(b.ante)}${b.anteMode === 'each' ? ' par joueur' : ''}` : '';
  return `${chips(b.sb)}/${chips(b.bb)}${ante}`;
}
export function ctxText(c: Ctx): string {
  return [c.name.trim() || (c.kind === 'club' ? 'Tournoi du club' : 'Tournoi'), c.level ? `niveau ${c.level}` : '', blindsText(c.blinds)].filter(Boolean).join(' · ');
}

export function actionText(told: { k: Kind; to: number; allin: boolean }): string {
  switch (told.k) {
    case 'fold': return 'passe';
    case 'check': return 'parole';
    case 'call': return told.allin ? `suit ${chips(told.to)} (tapis)` : `suit ${chips(told.to)}`;
    case 'bet': return told.allin ? `tapis ${chips(told.to)}` : `mise ${chips(told.to)}`;
    case 'raise': return told.allin ? `tapis ${chips(told.to)}` : `relance à ${chips(told.to)}`;
  }
}

export interface StreetLine {
  street: Street;
  /** Board au début du tour. */
  board: Card[];
  /** Pot au début du tour. */
  pot: number;
  items: { index: number; p: number; k: Kind; text: string }[];
}

/** Le déroulé, tour par tour, jusqu'à l'action « upto » exclue. */
export function story(h: HandData, r: Replay = replayOf(h), upto = h.actions.length): StreetLine[] {
  const lines: StreetLine[] = [];
  const last = Math.min(upto, r.states.length - 1);
  for (let i = 0; i < last; i++) {
    const s = r.states[i];
    let line = lines.at(-1);
    if (!line || line.street !== s.street) {
      line = { street: s.street, board: h.board.slice(0, BOARD_AT[s.street]), pot: potOf(s), items: [] };
      lines.push(line);
    }
    const a = h.actions[i];
    line.items.push({ index: i, p: a.p, k: a.k, text: actionText(tell(s, a)) });
  }
  return lines;
}

/** « UTG relance à 1 500, UTG+1, MP et HJ passent, … » : les abandons d'affilée sont regroupés. */
export function lineText(h: HandData, line: StreetLine): string {
  const parts: string[] = [];
  let folds: string[] = [];
  const flush = () => {
    if (folds.length === 1) parts.push(`${folds[0]} passe`);
    else if (folds.length > 1) parts.push(`${folds.slice(0, -1).join(', ')} et ${folds.at(-1)} passent`);
    folds = [];
  };
  for (const it of line.items) {
    if (it.k === 'fold') { folds.push(seatName(h, it.p)); continue; }
    flush();
    parts.push(`${seatName(h, it.p)} ${it.text}`);
  }
  flush();
  return parts.join(', ');
}

/** Joueurs qui ont mis un jeton de leur plein gré : on montre leur tapis. */
export function involved(h: HandData): number[] {
  const set = new Set<number>();
  for (const a of h.actions) if (a.k !== 'fold') set.add(a.p);
  set.add(h.hero);
  return [...set].sort((a, b) => a - b);
}

/** La main s'arrête-t-elle sur une décision du héros ? */
export function decisionState(h: HandData, r: Replay = replayOf(h)): State | null {
  if (h.decision === null) return null;
  const s = r.states[h.decision];
  if (!s || s.toAct !== h.hero || h.actions[h.decision]?.p !== h.hero) return null;
  return s;
}

// ── Données reçues (lien, base) : on vérifie tout ────────────────────────────

const num = (x: unknown, min: number, max: number): number | null =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? Math.round(x) : null;
const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
const KINDS: Kind[] = ['fold', 'check', 'call', 'bet', 'raise'];
const BIG = 1e12;

function cards(x: unknown, max: number, used: Set<number>): Card[] {
  if (!Array.isArray(x)) return [];
  const out: Card[] = [];
  for (const c of x.slice(0, max)) if (isCard(c) && !used.has(c)) { used.add(c); out.push(c); }
  return out;
}

export function sanitize(x: unknown): HandData | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const c = (o.ctx ?? {}) as Record<string, unknown>;
  const b = (c.blinds ?? {}) as Record<string, unknown>;
  const bb = num(b.bb, 1, BIG);
  if (!bb || !Array.isArray(o.seats)) return null;
  const n = o.seats.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) return null;
  const blinds: Blinds = {
    sb: num(b.sb, 0, BIG) ?? Math.round(bb / 2), bb, ante: num(b.ante, 0, BIG) ?? 0,
    anteMode: (b.anteMode === 'each' ? 'each' : 'bb') as AnteMode,
  };
  const used = new Set<number>();
  const seats: Seat[] = [];
  for (const s of o.seats as unknown[]) {
    const so = (s ?? {}) as Record<string, unknown>;
    const stack = num(so.stack, 1, BIG);
    if (!stack) return null;
    const cs = cards(so.cards, 2, used);
    seats.push(cs.length ? { stack, cards: cs } : { stack });
  }
  const hero = num(o.hero, 0, n - 1);
  if (hero === null) return null;
  const actions: Action[] = [];
  if (Array.isArray(o.actions)) {
    for (const a of o.actions.slice(0, 200) as unknown[]) {
      const ao = (a ?? {}) as Record<string, unknown>;
      const p = num(ao.p, 0, n - 1);
      const k = KINDS.find(z => z === ao.k);
      if (p === null || !k) break;
      const to = num(ao.to, 1, BIG);
      actions.push(k === 'bet' || k === 'raise' ? { p, k, to: to ?? 1 } : { p, k });
    }
  }
  const board = cards(o.board, 5, used);
  const decision = num(o.decision, 0, actions.length - 1);
  const winners = Array.isArray(o.winners) ? [...new Set(o.winners.map(w => num(w, 0, n - 1)).filter((w): w is number => w !== null))] : [];
  const tags = Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string').slice(0, 8).map(t => t.slice(0, 30)) : [];
  const h: HandData = {
    v: 1,
    date: num(o.date, 0, 9e15) ?? Date.now(),
    ctx: {
      kind: c.kind === 'club' ? 'club' : 'other',
      name: str(c.name, 80),
      level: num(c.level, 1, 999),
      blinds,
      table: n,
    },
    seats, hero, actions, board, decision, winners, tags,
    complete: o.complete === true,
  };
  // Les actions refusées par le moteur ne sont pas gardées.
  const r = replayOf(h);
  if (r.error) h.actions = h.actions.slice(0, r.error.index);
  if (h.decision !== null && !decisionState(h, r)) h.decision = null;
  return h;
}

/** La part partageable d'une main du carnet. */
export function shareable(h: Hand): HandData {
  const { v, date, ctx, seats, hero, actions, board, decision, winners, tags, complete } = h;
  return { v, date, ctx: { kind: ctx.kind, name: ctx.name, level: ctx.level, blinds: ctx.blinds, table: ctx.table }, seats, hero, actions, board, decision, winners, tags, complete };
}

export const heroLine = (h: HandData) => `${positions(h.seats.length)[h.hero]} · ${cardsText(heroCards(h)) || 'cartes non notées'}`;
