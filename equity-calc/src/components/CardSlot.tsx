import { intToCard, SUIT_SYMBOL, SUIT_COLOR } from '../lib/cards';

interface Props {
  card: number | null;
  onClick: () => void;
  large?: boolean;
  title?: string;
}

export function CardSlot({ card, onClick, large, title }: Props) {
  const cls = `slot${card !== null ? ' filled' : ''}${large ? ' lg' : ''}`;
  if (card === null) return <div className={cls} onClick={onClick} title={title} />;
  const s = intToCard(card);
  const color = SUIT_COLOR[s[1]] === '#c8d6f0' ? '#1a1f2e' : SUIT_COLOR[s[1]];
  return (
    <div className={cls} onClick={onClick} title={title} style={{ color }}>
      <span>{s[0]}</span>
      <span style={{ fontSize: '0.8em' }}>{SUIT_SYMBOL[s[1]]}</span>
    </div>
  );
}
