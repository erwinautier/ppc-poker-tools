/** Nombres et dates à la française. */
const INT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const ONE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Espaces normales plutôt qu'insécables fines : les messages WhatsApp les gardent telles quelles. */
const plain = (s: string) => s.replace(/[  ]/g, ' ');

export const chips = (n: number) => plain(INT.format(Math.round(n)));
/** En grosses blindes : « 38 bb », « 2,5 bb ». */
export const bbs = (n: number, bb: number) => (bb > 0 ? `${plain(ONE.format(n / bb))} bb` : '');
export const pct = (x: number) => `${plain(INT.format(Math.round(x * 100)))} %`;
export const one = (x: number) => plain(ONE.format(x));

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const dayLabel = (t: number) => { const s = DAY.format(t); return s[0].toUpperCase() + s.slice(1); };
export const timeLabel = (t: number) => TIME.format(t);
export const dateLabel = (t: number) => SHORT.format(t);

/** Lit un montant saisi : « 1 500 », « 1500 », « 1,5k », « 2k ». Rien de lisible : null. */
export function readAmount(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s/g, '').replace(',', '.');
  const m = /^(\d+(?:\.\d+)?)(k?)$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}
