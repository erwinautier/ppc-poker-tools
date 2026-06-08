import type { Range } from '../types';
import { combosCount } from '../hands';

interface Props {
  range: Range;
}

const TOTAL_COMBOS = 1326;

export default function RangeStats({ range }: Props) {
  const colorStats: Record<string, number> = {};
  let totalWeightedCombos = 0;

  for (const [hand, assignment] of Object.entries(range.hands)) {
    const n = combosCount(hand);
    for (const [cid, freq] of Object.entries(assignment)) {
      const combos = (n * freq) / 100;
      colorStats[cid] = (colorStats[cid] || 0) + combos;
      totalWeightedCombos += combos;
    }
  }

  const totalPct = ((totalWeightedCombos / TOTAL_COMBOS) * 100).toFixed(1);

  return (
    <div className="range-stats">
      <div className="stat-total">
        <span className="stat-number">{totalWeightedCombos.toFixed(0)}</span>
        <span className="stat-label">combos ({totalPct}%)</span>
      </div>
      {range.palette.map(color => {
        const combos = colorStats[color.id] || 0;
        const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1);
        return (
          <div key={color.id} className="stat-color">
            <span className="color-dot" style={{ background: color.hex }} />
            <span>{color.label}</span>
            <span className="stat-value">{combos.toFixed(0)} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}
