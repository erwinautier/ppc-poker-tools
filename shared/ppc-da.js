/**
 * PPC · Choix de la direction artistique (DA), commun à toute la suite Poker Tools.
 *
 * Les couleurs, polices et décors de chaque DA sont dans ppc-da.css. Ce module
 * choisit celle qui s'affiche : il pose data-da sur <html>, mémorise le choix
 * dans le navigateur (localStorage « ppc-da », partagé par toutes les apps du
 * site), met à jour l'icône d'onglet et la couleur de barre du téléphone, et
 * prévient les composants abonnés (logo, sélecteurs).
 *
 *   - Raccourci : ajouter ?da=nuit ou ?da=vice à n'importe quelle adresse.
 *   - Sans choix mémorisé : la DA par défaut, décidée par ppc-da.css.
 *   - Les onglets déjà ouverts suivent le changement.
 *
 * Fichier en JavaScript pour que l'accueil (page HTML sans build) l'utilise
 * tel quel ; ses types sont dans ppc-da.d.ts.
 */

export const DA_LIST = [
  { id: 'vice', label: 'Vice City',      logo: 'logo-ppc.png' },
  { id: 'nuit', label: 'Bleu nuit & or', logo: 'logo-ppc-nuit.png' },
];

const KEY = 'ppc-da';
const root = document.documentElement;
const listeners = new Set();
const isDA = v => DA_LIST.some(d => d.id === v);

function stored() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function store(id) {
  try { localStorage.setItem(KEY, id); } catch { /* navigation privée : le choix vaut pour la page */ }
}

/** DA affichée : le choix posé sur <html>, sinon la DA par défaut de ppc-da.css. */
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

export function setDA(id) {
  if (!isDA(id)) return;
  store(id);
  apply(id);
}

/** Passe à la DA suivante (il n'y en a que deux : bascule de l'une à l'autre). */
export function toggleDA() {
  const i = DA_LIST.findIndex(d => d.id === getDA());
  setDA(DA_LIST[(i + 1) % DA_LIST.length].id);
}

function apply(id) {
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

// Démarrage : ?da=… dans l'adresse l'emporte et devient le choix mémorisé.
const fromUrl = new URLSearchParams(location.search).get('da');
if (isDA(fromUrl)) store(fromUrl);
apply(stored());

window.addEventListener('storage', e => { if (e.key === KEY) apply(e.newValue); });
