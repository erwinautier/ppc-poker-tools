/**
 * Le vote « Et toi, tu fais quoi ? » : uniquement des choix tout faits.
 * Ni commentaire libre ni nom d'adversaire : on discute du coup, pas des gens.
 */
import { chips } from './format';
import { canReopen, chipUnit, potOf, type Action, type Kind, type State } from './engine';

export interface VoteOption { k: Kind; to?: number; allin?: boolean }

/** Les raisons qu'on peut cocher (deux au plus). Indices stockés en base : n'ajouter qu'à la fin. */
export const REASONS = [
  'La cote le permet',
  'Sa range est trop forte',
  'Ma main est assez forte',
  'Pour la valeur',
  'Bluff ou semi-bluff',
  'Protéger ma main',
  'Taille des tapis',
  'Profil du joueur',
] as const;
export const MAX_REASONS = 2;

/** Les réponses possibles à la décision : abandon, suivi ou parole, une taille courante, tapis. */
export function voteOptions(s: State, bb: number): VoteOption[] {
  const i = s.toAct;
  if (i === null) return [];
  const p = s.ps[i];
  const max = p.bet + p.stack;
  const diff = s.current - p.bet;
  const out: VoteOption[] = [];
  if (diff > 0) out.push({ k: 'fold' }, { k: 'call', to: Math.min(s.current, max), ...(diff >= p.stack ? { allin: true } : {}) });
  else out.push({ k: 'check' });
  if (max <= s.current || !canReopen(s, i)) return out;

  const kind: Kind = s.current === 0 ? 'bet' : 'raise';
  const unit = chipUnit(bb);
  const floor = s.current === 0 ? Math.max(1, bb) : s.current + s.minRaise;
  const pot = potOf(s);
  const sizes =
    s.current === 0 ? [pot / 3, (pot * 2) / 3]
      : s.street === 0 && s.current <= bb ? [diff > 0 ? 2.5 * bb : 4 * bb]
        : [s.current * 3];
  for (const x of sizes) {
    const to = Math.max(floor, Math.round(x / unit) * unit);
    // Au-delà de 70 % du tapis, autant le mettre : on ne garde que « Tapis ».
    if (to < max * 0.7 && !out.some(o => o.to === to)) out.push({ k: kind, to });
  }
  out.push({ k: kind, to: max, allin: true });
  return out;
}

export function optionLabel(o: VoteOption): string {
  switch (o.k) {
    case 'fold': return 'Passer';
    case 'check': return 'Parole';
    case 'call': return `Suivre${o.to ? ` ${chips(o.to)}` : ''}${o.allin ? ' (tapis)' : ''}`;
    case 'bet': return o.allin ? `Tapis (${chips(o.to ?? 0)})` : `Miser ${chips(o.to ?? 0)}`;
    case 'raise': return o.allin ? `Tapis (${chips(o.to ?? 0)})` : `Relancer à ${chips(o.to ?? 0)}`;
  }
}

/** La réponse la plus proche de ce que le héros a vraiment fait. */
export function matchOption(options: VoteOption[], prev: State, a: Action): number {
  const p = prev.ps[a.p];
  const max = p.bet + p.stack;
  if (a.k === 'fold' || a.k === 'check' || a.k === 'call') return options.findIndex(o => o.k === a.k);
  const to = Math.min(a.to ?? 0, max);
  if (to >= max) {
    const j = options.findIndex(o => o.allin && (o.k === 'bet' || o.k === 'raise'));
    if (j >= 0) return j;
  }
  let best = -1;
  let gap = Infinity;
  options.forEach((o, j) => {
    if ((o.k !== 'bet' && o.k !== 'raise') || !o.to) return;
    const g = Math.abs(Math.log(o.to / Math.max(1, to)));
    if (g < gap) { gap = g; best = j; }
  });
  return best;
}

/** Options reçues de la base : on ne garde que ce qui a du sens. */
export function readOptions(x: unknown): VoteOption[] {
  if (!Array.isArray(x)) return [];
  const kinds: Kind[] = ['fold', 'check', 'call', 'bet', 'raise'];
  return x.slice(0, 6).flatMap(o => {
    const k = kinds.find(z => z === (o as VoteOption)?.k);
    if (!k) return [];
    const to = Number((o as VoteOption).to);
    return [{ k, ...(Number.isFinite(to) && to > 0 ? { to: Math.round(to) } : {}), ...((o as VoteOption).allin ? { allin: true } : {}) }];
  });
}

export interface Results {
  total: number;
  /** Votes par réponse. */
  counts: number[];
  /** Raisons cochées, par réponse puis par raison. */
  reasons: number[][];
}
