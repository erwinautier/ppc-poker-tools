/** Routage par ancre, comme dans l'Initiation : « retour » fonctionne, aucun réglage serveur. */
import { useEffect, useState } from 'react';

export interface Route { parts: string[]; query: URLSearchParams }

export function parse(hash: string): Route {
  const [path, q = ''] = hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}
export function go(path: string) { location.hash = path; }

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    let last = location.hash;
    const on = () => {
      setRoute(parse(location.hash));
      // Changer d'onglet dans un tournoi ne doit pas remonter la page.
      const root = (h: string) => h.split('/').slice(0, 3).join('/');
      if (root(last) !== root(location.hash)) window.scrollTo(0, 0);
      last = location.hash;
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
