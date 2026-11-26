/**
 * PPC · Choix de la direction artistique (DA), commun à toute la suite Poker Tools.
 *
 * Les couleurs, polices et décors de chaque DA sont dans ppc-da.css. Ce module
 * choisit celle qui s'affiche : il pose data-da sur <html>, met à jour l'icône
 * d'onglet et la couleur de barre du téléphone, et prévient les composants
 * abonnés (logo, sélecteurs).
 *
 *   - Tout le monde voit la DA par défaut, décidée par ppc-da.css.
 *   - Les administrateurs du club ont la bascule (data-da-admin sur <html>
 *     l'affiche) et leur choix est mémorisé dans le navigateur (localStorage
 *     « ppc-da », partagé par toutes les apps du site ; les onglets ouverts suivent).
 *   - ?da=nuit ou ?da=vice dans l'adresse montre cette DA sur la page ouverte,
 *     pour tout le monde (aperçu) ; pour un administrateur, le choix est mémorisé.
 *
 * Qui est administrateur ? Seul Le Club connaît les rôles : il appelle
 * setDAAdmin(id du compte) ou setDAAdmin(null). Les autres apps le croient tant
 * que la session de connexion commune (« ppc-auth ») est celle de ce compte.
 * C'est un réglage d'affichage, pas une protection : il ne donne accès à rien.
 *
 * Fichier en JavaScript pour que l'accueil (page HTML sans build) l'utilise
 * tel quel ; ses types sont dans ppc-da.d.ts.
 */

export const DA_LIST = [
  // La première sert de secours tant que ppc-da.css n'est pas chargée : y garder la DA par défaut.
  { id: 'nuit', label: 'Bleu nuit & or', logo: 'logo-ppc-nuit.png' },
  { id: 'vice', label: 'Vice City',      logo: 'logo-ppc.png' },
];

const KEY = 'ppc-da';
const ADMIN_KEY = 'ppc-da-admin';   // compte administrateur de cet appareil, posé par Le Club
const AUTH_KEY = 'ppc-auth';        // session Supabase commune à toute la suite
const root = document.documentElement;
const listeners = new Set();
const isDA = v => DA_LIST.some(d => d.id === v);

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value); else localStorage.removeItem(key);
  } catch { /* navigation privée : le réglage vaut pour la page */ }
}

/** Un administrateur du club est connecté sur cet appareil (d'après Le Club). */
export function isDAAdmin() {
  const id = read(ADMIN_KEY), session = read(AUTH_KEY);
  return !!id && !!session && session.includes(id);
}

/** Appelé par Le Club, seul à connaître les rôles : id du compte s'il est administrateur, sinon null. */
export function setDAAdmin(userId) {
  if (read(ADMIN_KEY) !== (userId || null)) write(ADMIN_KEY, userId);
  // Même sans changement : la session vient peut-être de s'ouvrir dans cet onglet.
  apply(wanted());
}

// ?da=… : vaut pour la page ouverte, quel que soit le visiteur.
const fromUrl = new URLSearchParams(location.search).get('da');
let pageChoice = isDA(fromUrl) ? fromUrl : null;

/** DA demandée : l'aperçu de la page, sinon le choix mémorisé d'un administrateur. */
function wanted() {
  return pageChoice ?? (isDAAdmin() ? read(KEY) : null);
}

/** DA affichée : celle posée sur <html>, sinon la DA par défaut de ppc-da.css. */
export function getDA() {
  const chosen = root.getAttribute('data-da');
  if (isDA(chosen)) return chosen;
  const byCss = getComputedStyle(root).getPropertyValue('--ppc-da').trim();
  return isDA(byCss) ? byCss : DA_LIST[0].id;
}

/** Nom du fichier logo (jeton rond) de la DA, à préfixer par le dossier public de l'app. */
export function logoFile(id = getDA()) {
  return (DA_LIST.find(d => d.id === id) ?? DA_LIST[0]).logo;
}

export function subscribeDA(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Change de DA (réservé aux administrateurs : pour les autres, rien ne change). */
export function setDA(id) {
  if (!isDA(id) || !isDAAdmin()) return;
  write(KEY, id);
  pageChoice = null;
  apply(id);
}

/** Passe à l'autre DA (il n'y en a que deux). */
export function toggleDA() {
  const i = DA_LIST.findIndex(d => d.id === getDA());
  setDA(DA_LIST[(i + 1) % DA_LIST.length].id);
}

function apply(id) {
  root.toggleAttribute('data-da-admin', isDAAdmin());
  if (isDA(id)) root.setAttribute('data-da', id);
  else {
    // Pas de choix : on lit la DA par défaut dans ppc-da.css et on l'écrit en clair sur <html>
    // (si la feuille n'est pas encore chargée, on laisse le CSS appliquer son défaut tout seul).
    root.removeAttribute('data-da');
    const byCss = getComputedStyle(root).getPropertyValue('--ppc-da').trim();
    if (isDA(byCss)) root.setAttribute('data-da', byCss);
  }

  const logo = logoFile();
  document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => {
    l.href = l.href.replace(/logo-ppc[\w-]*\.(png|jpg)$/, logo);
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  const ink = getComputedStyle(root).getPropertyValue('--ppc-prune').trim();
  if (meta && ink) meta.setAttribute('content', ink);

  listeners.forEach(fn => fn());
}

// Démarrage. Un administrateur qui ouvre un lien ?da=… garde ce choix.
if (pageChoice && isDAAdmin()) write(KEY, pageChoice);
apply(wanted());

// Les autres onglets ouverts suivent : choix de DA, administrateur, connexion ou déconnexion.
window.addEventListener('storage', e => {
  if (e.key === KEY || e.key === ADMIN_KEY || e.key === AUTH_KEY || e.key === null) apply(wanted());
});
