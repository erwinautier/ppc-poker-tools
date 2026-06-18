import type { StreetAction, NextActor, Street } from '../types';
import type { Position } from '../types';

// Postflop acting order: SB first, BTN last
const IP_RANK: Record<string, number> = {
  SB: 1, BB: 2, LJ: 3, 'UTG+2': 3, 'UTG+1': 3, UTG: 3, HJ: 4, CO: 5, BTN: 6,
};

export function isHeroIP(heroPos: Position, villainPos: Position): boolean {
  return (IP_RANK[heroPos] ?? 3) > (IP_RANK[villainPos] ?? 3);
}

/**
 * Determines who acts next on the current street.
 * Simple model: max 1 raise per street.
 *
 * Street action sequence:
 *   OOP → (IP) → (OOP) → (IP) → done
 *
 * The first actor is OOP. After each action we follow the betting tree.
 */
export function getNextActor(streetActions: StreetAction[], heroIsIP: boolean): NextActor {
  const oopPlayer: 'hero' | 'villain' = heroIsIP ? 'villain' : 'hero';
  const ipPlayer: 'hero' | 'villain'  = heroIsIP ? 'hero'    : 'villain';

  const [a0, a1, a2, a3] = streetActions;

  // No actions yet → OOP acts (open action)
  if (!a0) return { who: oopPlayer, facingBet: 0 };

  if (a0.type === 'fold') {
    return { who: 'hand_over', winner: a0.player === 'hero' ? 'villain' : 'hero' };
  }

  // ── OOP checked ──────────────────────────────────────────────────
  if (a0.type === 'check') {
    if (!a1) return { who: ipPlayer, facingBet: 0 };

    if (a1.type === 'check') return { who: 'done' };
    if (a1.type === 'fold')  return { who: 'hand_over', winner: a1.player === 'hero' ? 'villain' : 'hero' };

    // IP bet or raised → OOP faces it
    if (a1.type === 'bet' || a1.type === 'raise' || a1.type === 'all_in') {
      if (!a2) return { who: oopPlayer, facingBet: a1.amount ?? 0 };
      if (a2.type === 'call') return { who: 'done' };
      if (a2.type === 'fold') return { who: 'hand_over', winner: a1.player === 'hero' ? 'hero' : 'villain' };
      // OOP re-raises → IP faces it (last action allowed)
      if (a2.type === 'raise' || a2.type === 'all_in') {
        if (!a3) return { who: ipPlayer, facingBet: a2.amount ?? 0 };
        if (a3.type === 'call') return { who: 'done' };
        if (a3.type === 'fold') return { who: 'hand_over', winner: a2.player === 'hero' ? 'hero' : 'villain' };
      }
    }
  }

  // ── OOP bet directly ─────────────────────────────────────────────
  if (a0.type === 'bet' || a0.type === 'raise' || a0.type === 'all_in') {
    if (!a1) return { who: ipPlayer, facingBet: a0.amount ?? 0 };
    if (a1.type === 'call') return { who: 'done' };
    if (a1.type === 'fold') return { who: 'hand_over', winner: a0.player === 'hero' ? 'hero' : 'villain' };
    // IP raises → OOP faces it (last action allowed)
    if (a1.type === 'raise' || a1.type === 'all_in') {
      if (!a2) return { who: oopPlayer, facingBet: a1.amount ?? 0 };
      if (a2.type === 'call') return { who: 'done' };
      if (a2.type === 'fold') return { who: 'hand_over', winner: a1.player === 'hero' ? 'hero' : 'villain' };
    }
  }

  return { who: 'done' };
}

export function nextStreet(current: Street): Street | null {
  if (current === 'flop')  return 'turn';
  if (current === 'turn')  return 'river';
  return null;
}

export function streetLabel(s: Street): string {
  return { flop: 'Flop', turn: 'Turn', river: 'River' }[s];
}

export function actionLabel(a: StreetAction): string {
  switch (a.type) {
    case 'check':  return 'Check';
    case 'fold':   return 'Fold';
    case 'call':   return `Call ${a.amount?.toFixed(1)}bb`;
    case 'bet':    return `Bet ${a.amount?.toFixed(1)}bb`;
    case 'raise':  return `Raise à ${a.amount?.toFixed(1)}bb`;
    case 'all_in': return `All-in ${a.amount?.toFixed(1)}bb`;
  }
}

/** Bet sizes as % of pot */
export function betAmounts(pot: number, stack: number): { label: string; amount: number }[] {
  return [
    { pct: 0.33, label: '33%' },
    { pct: 0.50, label: '50%' },
    { pct: 0.75, label: '75%' },
    { pct: 1.00, label: 'Pot' },
  ].map(({ pct, label }) => ({
    label,
    amount: +(Math.min(stack, pot * pct)).toFixed(1),
  })).filter(({ amount }, i, arr) => amount > 0 && (i === 0 || amount !== arr[i - 1].amount));
}

/** Raise sizes when facing a bet */
export function raiseAmounts(facingBet: number, pot: number, stack: number): { label: string; amount: number }[] {
  // Min raise = 2x the bet; pot-raise = call + pot after call
  const minRaise  = +(Math.min(stack, facingBet * 2)).toFixed(1);
  const potAfterCall = pot + facingBet; // pot if we call first
  const potRaise  = +(Math.min(stack, facingBet + potAfterCall)).toFixed(1);
  const allin     = +stack.toFixed(1);

  const sizes = [
    { label: 'Min (2x)', amount: minRaise },
    { label: 'Pot',      amount: potRaise },
    { label: 'All-in',   amount: allin    },
  ];
  // Deduplicate identical amounts
  const seen = new Set<number>();
  return sizes.filter(({ amount }) => {
    if (amount <= facingBet || seen.has(amount)) return false;
    seen.add(amount);
    return true;
  });
}
