# Le Club : mise en service

Le module « Le Club » (championnats, tournois, inscriptions, horloge) est servi à
l'adresse `/club/` de PPC Poker Tools. Il utilise le même projet Supabase et les
mêmes comptes que le Range Editor et le Poker Trainer.

Tant que la base n'est pas installée, la page affiche « Bientôt ouvert ».
La démo (`/club/?demo`) marche sans rien installer.

## 1. Installer la base (une seule fois)

1. Ouvre le projet Supabase de la suite, puis **SQL Editor**.
2. Colle tout le contenu de `club-manager/supabase/001_club.sql` et exécute-le.
   Le script ne crée que des tables préfixées `club_`. Il peut être relancé sans
   risque : il ne supprime aucune donnée.

## 2. Déclarer le premier administrateur

Toujours dans l'éditeur SQL, avec l'adresse d'un compte **déjà créé** dans la suite :

```sql
select club_bootstrap_admin('adresse-du-compte', 'Nom affiché');
```

La réponse doit être « Administrateur enregistré. ». Les autres rôles se donnent
ensuite depuis l'application, page **Adhérents**.

## 3. Autoriser le lien « mot de passe oublié »

Dans **Authentication > URL Configuration > Redirect URLs**, ajoute l'adresse
publique du module, par exemple `https://<domaine de la suite>/club/`.

## 4. Premiers pas dans l'application

1. **Adhérents** : colle la liste des noms, un par ligne.
2. **Structures** : ajoute les trois modèles proposés, ou génère la tienne.
3. **Championnats** : crée la saison et vérifie le barème de points.
4. **Tournois** : programme la première manche.

Chaque adhérent se connecte avec son compte de la suite, demande son rattachement
(page Compte), et un organisateur valide en choisissant sa fiche.

## Rôles

| Rôle | Peut faire |
| --- | --- |
| Visiteur | voir les championnats et tournois « publics » |
| Adhérent | tout consulter (sauf brouillons et règlements), s'inscrire, se désinscrire |
| Organisateur | gérer championnats, tournois, horloge, éliminations, structures, adhérents |
| Administrateur | en plus, attribuer les rôles et détacher un compte |

Ces droits sont appliqués par la base elle-même (RLS), pas seulement par l'écran.

## Le soir du tournoi

1. Onglet **Joueurs** : pointer « Sur place ».
2. Onglet **Tables** : tirer les places au sort.
3. Onglet **Direct** : lancer. **Écran d'horloge** sur la télé ou le vidéoprojecteur,
   puis « Son coupé » pour activer le son, et « Plein écran ».
4. Depuis un téléphone, onglet **Direct** : bouton **KO** à chaque élimination. Tous
   les écrans suivent.
5. Quand il ne reste qu'un joueur : **Valider le classement**. Les points du
   championnat se calculent seuls.

Raccourcis de l'écran d'horloge (organisateur) : espace = lancer ou arrêter, flèches
gauche et droite = niveau précédent ou suivant, haut et bas = plus ou moins une minute.

L'horloge avance toute seule sur chaque écran : une coupure du réseau ne l'arrête
pas. Les éliminations et les inscriptions, elles, demandent une connexion.

## Développement

```bash
npm --prefix club-manager run dev
npm --prefix club-manager test
```

`npm test` vérifie le moteur (horloge, points, primes, tables) et exécute le script SQL
et les droits dans un vrai PostgreSQL embarqué (PGlite), sans toucher à Supabase.
