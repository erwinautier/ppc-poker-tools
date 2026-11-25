/** Fichier d'agenda (.ics) pour un tournoi. */
import type { Tournament } from './types';

const esc = (s: string) => s.replace(/([\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

export function icsOf(t: Tournament, url: string): string {
  const start = new Date(t.starts_at);
  const end = new Date(start.getTime() + 4 * 3_600_000);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PPC//Championnats et tournois//FR', 'BEGIN:VEVENT',
    `UID:${t.id}@ppc-club`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Poker : ${t.name}`)}`, `LOCATION:${esc(t.venue)}`, `DESCRIPTION:${esc([t.description, url].filter(Boolean).join('\n'))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function download(name: string, content: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
