/**
 * Le carnet vit sur le téléphone (localStorage) : aucun compte n'est nécessaire
 * pour noter, rejouer ou envoyer une main. Seule la publication au club passe par la base.
 */
import { useSyncExternalStore } from 'react';
import { positions, type Seat } from './engine';
import { upgrade, type Ctx, type Hand } from './hand';

const KEY = 'ppc-carnet-v1';

export interface Carnet {
  hands: Hand[];
  /** Le tournoi en cours : repris pour chaque nouvelle main. */
  ctx: Ctx;
  /** Derniers tournois extérieurs, pour les retrouver d'un geste. */
  recent: Ctx[];
}

export const DEFAULT_CTX: Ctx = {
  kind: 'other', name: '', level: null, table: 9,
  blinds: { sb: 100, bb: 200, ante: 200, anteMode: 'bb' },
};

function load(): Carnet {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Carnet> | null;
    if (raw && Array.isArray(raw.hands)) {
      return { hands: raw.hands.map(h => upgrade(h)), ctx: raw.ctx ?? DEFAULT_CTX, recent: Array.isArray(raw.recent) ? raw.recent : [] };
    }
  } catch { /* stockage illisible ou bloqué : carnet vide */ }
  return { hands: [], ctx: DEFAULT_CTX, recent: [] };
}

let state: Carnet = load();
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

function write(next: Carnet) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* plein ou bloqué : gardé jusqu'à la fermeture */ }
  emit();
}

if (typeof window !== 'undefined') {
  // Le carnet ouvert dans un autre onglet.
  window.addEventListener('storage', e => { if (e.key === KEY) { state = load(); emit(); } });
}

export function useCarnet(): Carnet {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => state);
}
export const getCarnet = () => state;
export const getHand = (id: string) => state.hands.find(h => h.id === id) ?? null;

export function saveHand(h: Hand) {
  const hand = { ...h, updated: Date.now() };
  const others = state.hands.filter(x => x.id !== h.id);
  write({ ...state, hands: [hand, ...others].sort((a, b) => b.date - a.date) });
}
export function removeHand(id: string): Hand | null {
  const h = getHand(id);
  write({ ...state, hands: state.hands.filter(x => x.id !== id) });
  return h;
}

export function setCtx(ctx: Ctx) {
  const recent = ctx.kind === 'other' && ctx.name.trim()
    ? [ctx, ...state.recent.filter(r => r.name.trim().toLowerCase() !== ctx.name.trim().toLowerCase())].slice(0, 5)
    : state.recent;
  write({ ...state, ctx, recent });
}

export const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** Une main vide pour le contexte courant ; tous les tapis valent celui du héros. */
export function blankHand(ctx: Ctx, stack: number, heroPos?: string): Hand {
  const n = ctx.table;
  const pos = positions(n);
  const hero = Math.max(0, heroPos ? pos.indexOf(heroPos) : pos.indexOf('BTN'));
  const seats: Seat[] = pos.map(() => ({ stack }));
  return {
    v: 1, id: newId(), date: Date.now(), updated: Date.now(),
    ctx: { ...ctx }, seats, hero, actions: [], board: [], decisions: [], winners: [], tags: [],
    complete: false, note: '',
  };
}

/** Change la taille de la table d'une main sans action : le héros garde sa position si elle existe. */
export function resizeTable(h: Hand, n: number): Hand {
  const before = positions(h.seats.length)[h.hero];
  const pos = positions(n);
  const stack = h.seats[h.hero]?.stack ?? 1;
  const cards = h.seats[h.hero]?.cards;
  let hero = pos.indexOf(before);
  if (hero < 0) hero = Math.max(0, pos.indexOf('BTN'));
  const seats: Seat[] = pos.map((_, i) => ({ stack: h.seats[i]?.stack ?? stack }));
  seats[hero] = { stack, ...(cards ? { cards } : {}) };
  return { ...h, seats, hero, actions: [], decisions: [], winners: [], ctx: { ...h.ctx, table: n } };
}

/** Le dernier tapis noté : point de départ de la main suivante. */
export function lastStack(): number | null {
  const h = state.hands[0];
  return h ? h.seats[h.hero]?.stack ?? null : null;
}
