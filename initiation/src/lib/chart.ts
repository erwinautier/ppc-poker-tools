/**
 * Charte préflop simplifiée pour débutants — table à 8, tournoi, environ 40 BB.
 * Notation : "77+" (77 à AA), "AJs+" (AJs, AQs, AKs), "KQs" (main exacte).
 */
import { RANKS_DESC, cellToHand } from './cards';

const ORDER = '23456789TJQKA';

export function parseRange(spec: string): Set<string> {
  const out = new Set<string>();
  for (const raw of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    const plus = raw.endsWith('+');
    const t = plus ? raw.slice(0, -1) : raw;
    const hi = ORDER.indexOf(t[0]), lo = ORDER.indexOf(t[1]);
    if (t.length === 2 && t[0] === t[1]) {
      if (plus) for (let r = hi; r <= 12; r++) out.add(ORDER[r] + ORDER[r]);
      else out.add(t);
    } else {
      const suf = t[2];
      if (plus) for (let r = lo; r < hi; r++) out.add(t[0] + ORDER[r] + suf);
      else out.add(t);
    }
  }
  return out;
}

export type PosGroup = 'precoce' | 'milieu' | 'tardive' | 'bouton' | 'sb';

export const SEAT_GROUP: Record<string, PosGroup> = {
  UTG: 'precoce', 'UTG+1': 'precoce', MP: 'milieu', HJ: 'milieu', CO: 'tardive', BTN: 'bouton', SB: 'sb',
};

export const OPEN_SPEC: Record<PosGroup, string> = {
  precoce: '77+, AJs+, KQs, AQo+',
  milieu: '55+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo',
  tardive: '22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, ATo+, KJo+, QJo',
  bouton: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A7o+, K9o+, Q9o+, J9o+, T9o',
  sb: '22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, ATo+, KJo+, QJo',
};

export const OPEN: Record<PosGroup, Set<string>> = Object.fromEntries(
  Object.entries(OPEN_SPEC).map(([k, v]) => [k, parseRange(v)]),
) as Record<PosGroup, Set<string>>;

export const VS_RAISE_3BET_SPEC = 'QQ+, AKs, AKo';
export const VS_RAISE_CALL_SPEC = '77+, AQs, AJs, KQs';
export const VS_RAISE_3BET = parseRange(VS_RAISE_3BET_SPEC);
export const VS_RAISE_CALL = new Set([...parseRange(VS_RAISE_CALL_SPEC)].filter(h => !VS_RAISE_3BET.has(h)));

export const BB_CALL_SPEC = '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo+, KJo+, QJo';
export const BB_3BET = VS_RAISE_3BET;
export const BB_CALL = new Set([...parseRange(BB_CALL_SPEC)].filter(h => !BB_3BET.has(h)));

export type Decision = 'fold' | 'call' | 'raise';

export function openDecision(group: PosGroup, hand: string): Decision {
  return OPEN[group].has(hand) ? 'raise' : 'fold';
}
export function vsRaiseDecision(hand: string): Decision {
  if (VS_RAISE_3BET.has(hand)) return 'raise';
  if (VS_RAISE_CALL.has(hand)) return 'call';
  return 'fold';
}
export function bbDecision(hand: string): Decision {
  if (BB_3BET.has(hand)) return 'raise';
  if (BB_CALL.has(hand)) return 'call';
  return 'fold';
}

export const GROUP_LABEL: Record<PosGroup, string> = {
  precoce: 'Positions précoces (UTG, UTG+1)',
  milieu: 'Positions du milieu (MP, HJ)',
  tardive: 'Cutoff (CO)',
  bouton: 'Bouton (BTN)',
  sb: 'Petite blinde (SB), si tout le monde s’est couché',
};

export const ALL_HANDS: string[] = (() => {
  const s: string[] = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) s.push(cellToHand(r, c));
  return s;
})();

export function pct(set: Set<string>): number {
  let n = 0;
  for (const h of set) n += h.length === 2 ? 6 : h[2] === 's' ? 4 : 12;
  return Math.round((n / 1326) * 100);
}

export { RANKS_DESC };
