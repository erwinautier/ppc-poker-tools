/** Clé de la tablette du comptoir, gardée sur l'appareil. Arrive par un lien, puis disparaît de l'adresse. */
const KEY = 'ppc-bar-kiosk';

function read(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
let key = read();

/** #/buvette/comptoir?cle=… : l'ancre n'est jamais envoyée au serveur. */
export function adoptKioskLink(): string | null {
  const m = /^#\/buvette\/comptoir\?cle=([0-9a-z]{4,80})$/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.hash.split('?')[0]);
  return m[1];
}

export const kioskKey = () => key;
export function setKiosk(k: string) {
  key = k;
  try { localStorage.setItem(KEY, k); } catch { /* le temps de cette page */ }
}
export function leaveKiosk() {
  key = null;
  try { localStorage.removeItem(KEY); localStorage.removeItem('ppc-bar-counter'); } catch { /* rien à effacer */ }
}
export const kioskLink = (k: string) => `${location.origin}${location.pathname}${location.search}#/buvette/comptoir?cle=${k}`;
