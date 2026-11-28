/** Routage par ancre (#/lecon/5/bilan) : le bouton « retour » du navigateur fonctionne. */
import { useEffect, useState } from 'react';
import type { Phase } from './progress';
import type { ParcoursId } from '../content/types';
import { getStore } from './progress';

const lastParcours = (): ParcoursId => getStore().lastParcours ?? 'initiation';

export type Route =
  /** Accueil de l'Académie : choix du parcours. */
  | { name: 'academie' }
  /** p absent : le dernier parcours ouvert. */
  | { name: 'parcours'; p?: ParcoursId }
  | { name: 'lexique' }
  | { name: 'fiches' }
  | { name: 'lecon'; id: number; phase?: Phase };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'exploration') return { name: 'parcours', p: 'exploration' };
  if (parts[0] === 'initiation') return { name: 'parcours', p: 'initiation' };
  if (parts[0] === 'lexique') return { name: 'lexique' };
  if (parts[0] === 'fiches') return { name: 'fiches' };
  if (parts[0] === 'lecon' && parts[1]) {
    const id = Number(parts[1]);
    const ph = parts[2] as Phase | undefined;
    if (Number.isFinite(id)) return { name: 'lecon', id, phase: ph };
  }
  return { name: 'academie' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'academie': return '#/';
    case 'parcours': return `#/${r.p ?? lastParcours()}`;
    case 'lexique': return '#/lexique';
    case 'fiches': return '#/fiches';
    case 'lecon': return `#/lecon/${r.id}${r.phase ? '/' + r.phase : ''}`;
  }
}

export function go(r: Route) {
  const h = href(r);
  if (location.hash !== h) location.hash = h;
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const on = () => { setRoute(parse(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
