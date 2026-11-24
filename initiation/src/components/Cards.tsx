import { type Card, SUIT_SYMBOL, SUIT_NAME, rankLabel, cards as parse, cellToHand } from '../lib/cards';

const SUIT_VAR: Record<string, string> = { s: 'var(--suit-s)', h: 'var(--suit-h)', d: 'var(--suit-d)', c: 'var(--suit-c)' };

interface PCProps {
  c?: Card | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  back?: boolean;
  hl?: boolean;
  dim?: boolean;
  sel?: boolean;
  state?: 'good' | 'bad';
  onClick?: () => void;
}

export function PCard({ c, size = 'md', back, hl, dim, sel, state, onClick }: PCProps) {
  const cls = ['pcard', size !== 'md' && size, back && 'back', !c && !back && 'empty', hl && 'hl', dim && 'dim', sel && 'sel', state, onClick && 'click']
    .filter(Boolean).join(' ');
  if (back || !c) return <span className={cls} onClick={onClick} aria-label={back ? 'Carte cachée' : 'Emplacement vide'} />;
  return (
    <span
      className={cls}
      style={{ color: SUIT_VAR[c[1]] }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`${rankLabel(c)} de ${SUIT_NAME[c[1]]}`}
      aria-pressed={onClick ? !!sel : undefined}
    >
      <span>{rankLabel(c)}</span>
      <span className="su">{SUIT_SYMBOL[c[1]]}</span>
    </span>
  );
}

interface RowProps {
  cs: Card[] | string;
  size?: PCProps['size'];
  hl?: Card[];
  dimOthers?: boolean;
  gap?: number;
}
export function CardRow({ cs, size, hl, dimOthers, gap }: RowProps) {
  const list = typeof cs === 'string' ? parse(cs) : cs;
  return (
    <div className="cards-row" style={gap !== undefined ? { gap } : undefined}>
      {list.map((c, i) => (
        <PCard key={c + i} c={c} size={size} hl={hl?.includes(c)} dim={dimOthers && hl && !hl.includes(c)} />
      ))}
    </div>
  );
}

/** Joueur à l'abattage : nom, cartes, description de la main. */
export function SeatHand({ who, cs, desc, state, hl, size = 'md' }: { who: string; cs: Card[]; desc?: string; state?: 'win' | 'lose'; hl?: Card[]; size?: PCProps['size'] }) {
  return (
    <div className={`seat-hand ${state ?? ''}`}>
      <div className="who">{who}</div>
      <div className="cards-row" style={{ gap: 4 }}>
        {cs.map(c => <PCard key={c} c={c} size={size} hl={hl?.includes(c)} />)}
      </div>
      {desc && <div className="desc">{desc}</div>}
    </div>
  );
}

/** Texte avec cartes inline : « Tu as {As Kd} » → cartes miniatures. */
export function Inline({ cs }: { cs: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', margin: '0 2px' }}>
      {parse(cs).map(c => <PCard key={c} c={c} size="xs" />)}
    </span>
  );
}

// ── Grille 13×13 ───────────────────────────────────────────────────────────

interface GridProps {
  classFor?: (hand: string) => string | undefined;
  onCell?: (hand: string) => void;
  showLabels?: boolean;
}
export function HandGrid({ classFor, onCell, showLabels = true }: GridProps) {
  const cells = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
    const h = cellToHand(r, c);
    const cls = [r === c && 'pair', classFor?.(h)].filter(Boolean).join(' ');
    const label = showLabels ? h.replace(/T/g, 'T') : '';
    cells.push(onCell
      ? <button key={h} className={cls} onClick={() => onCell(h)} aria-label={h}>{label}</button>
      : <div key={h} className={cls}>{label}</div>);
  }
  return <div className="hgrid">{cells}</div>;
}
