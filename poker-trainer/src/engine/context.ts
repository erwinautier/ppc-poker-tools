import type { GameFormat, RangeContext, Scenario } from './types';
import { SCENARIO_LABELS } from './types';

export function getPositions(format: GameFormat): string[] {
  return format === '6max'
    ? ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
    : ['UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
}

export function needsVillain(scenario: Scenario): boolean {
  return scenario === 'call' || scenario === '3bet' || scenario === '3bet-shove';
}

export function validVillains(ctx: RangeContext): string[] {
  if (!needsVillain(ctx.scenario)) return [];
  const positions = getPositions(ctx.format);
  const heroIdx = positions.indexOf(ctx.position);
  if (heroIdx <= 0) return [];
  return positions.slice(0, heroIdx);
}

export function contextKey(ctx: RangeContext): string {
  const base = `${ctx.format}|${ctx.position}|${ctx.stack}|${ctx.scenario}`;
  return ctx.villainPosition ? `${base}|${ctx.villainPosition}` : base;
}

export function contextLabel(ctx: RangeContext): string {
  const parts = [ctx.format, ctx.position, `${ctx.stack} bb`, SCENARIO_LABELS[ctx.scenario]];
  if (ctx.villainPosition) parts.push(`vs ${ctx.villainPosition}`);
  return parts.join(' / ');
}

export function contextShortLabel(ctx: RangeContext): string {
  const base = `${ctx.position} · ${ctx.stack} bb · ${SCENARIO_LABELS[ctx.scenario]}`;
  return ctx.villainPosition ? `${base} vs ${ctx.villainPosition}` : base;
}

/** Sanitize a context: ensure villain is valid, reset if not */
export function sanitizeCtx(ctx: RangeContext): RangeContext {
  const positions = getPositions(ctx.format);
  let position = ctx.position;
  if (!positions.includes(position)) position = positions[0];

  const heroIdx = positions.indexOf(position);
  const villains = heroIdx > 0 ? positions.slice(0, heroIdx) : [];
  let villainPosition = ctx.villainPosition;

  if (!needsVillain(ctx.scenario)) {
    villainPosition = undefined;
  } else if (!villainPosition || !villains.includes(villainPosition)) {
    villainPosition = villains[villains.length - 1]; // default to last valid villain
  }

  return { ...ctx, position, villainPosition };
}

// ── Combo helpers ──────────────────────────────────────────────────────────────

export function combosForKey(key: string): number {
  if (key.length === 2) return 6;        // pair
  return key[2] === 's' ? 4 : 12;        // suited | offsuit
}

/** rangeStats works with HandActions (Record<string, Action[]>) — missing or empty = fold */
export function rangeStats(hands: Record<string, unknown>): { count: number; combos: number; pct: number } {
  let count = 0;
  let combos = 0;
  for (const [key, val] of Object.entries(hands)) {
    const isActive = Array.isArray(val)
      ? val.length > 0
      : typeof val === 'string' && val !== 'fold';
    if (isActive) {
      count++;
      combos += combosForKey(key);
    }
  }
  return { count, combos, pct: Math.round(combos / 1326 * 1000) / 10 };
}
