import type { Level } from './types';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
// L'espace fine du français disparaît presque dans les polices du club : espace insécable normale.
export const num = (x: number) => nf.format(x).replace(/\u202f/g, '\u00a0');
export const eur = (x: number) => `${num(x)}\u00a0€`;

/** Jetons abrégés pour l'écran géant : 12 500 reste lisible, 1 250 000 devient 1,25 M. */
export function chips(x: number): string {
  if (x >= 1_000_000) return `${num(Math.round(x / 10_000) / 100)} M`;
  return num(x);
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

export function kos(n: number): string {
  return `${num(n)} KO`;
}

export function date(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
}
export function dateTime(iso: string): string {
  return `${date(iso)} à ${time(iso)}`;
}

/** Valeur d'un champ datetime-local, dans le fuseau de l'appareil. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function blinds(l: Level | null): string {
  if (!l) return '';
  if (l.kind === 'break') return l.label || 'Pause';
  return `${num(l.sb)} / ${num(l.bb)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${n > 1 ? many : one}`;
}
