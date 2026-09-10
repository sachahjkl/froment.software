# Contrôles des listes

## Composition

Une liste sépare trois fonctions : trouver un élément, comprendre ses valeurs et choisir une action.
La barre d’outils ne contient pas de formulaire de création.
Le titre porte l’action principale de création.

Utilisez les contrôles partagés pour la recherche, les filtres, le tri, l’export et la pagination.
Conservez les filtres propres au sujet dans chaque page.
Ne créez pas de composant CRUD universel.

## Espacement

Le conteneur de la liste contrôle l’espacement entre ses éléments.
La barre d’outils et le tableau n’ajoutent pas de marges verticales externes.
Les contrôles liés utilisent 8 à 12 px d’espace.
La barre d’outils, les filtres actifs, le compteur et le tableau utilisent 12 à 16 px d’espace.
Les sections indépendantes utilisent 32 px d’espace.

Sur écran étroit, placez la recherche sur une ligne complète.
Regroupez les filtres secondaires derrière leur bouton.
Conservez le défilement horizontal dans le tableau, jamais dans la page entière.

## Recherche et filtres

La recherche utilise Fuse et le surlignage partagé.
Les filtres structurés utilisent les statuts, clients, comptes et dates réellement disponibles.
Les filtres actifs restent visibles et supprimables.

Le menu de filtres flotte au-dessus de la liste et ne déplace pas le tableau.
Il affiche les catégories et leurs valeurs actives sur des lignes compactes.
Une catégorie ouvre un seul sous-panneau dans ce menu.
Angular Aria gère la sélection et la navigation clavier des options recherchables.
CDK gère le positionnement du menu et le retour du focus.
Les champs de période apparaissent seulement dans leur sous-panneau.

N’utilisez pas `details` et `summary` pour les filtres des listes.
Conservez le nom accessible de la recherche sans ajouter une ligne de titre au-dessus du champ.

Après suppression d’un filtre, restaurez un focus utilisable.
Conservez la recherche, les filtres et le tri lors du retour depuis une fiche.
Placez uniquement les paramètres non sensibles dans l’URL.

## Tri

Utilisez `button[appTableSort]` dans les en-têtes des colonnes triables.
Exposez le sens courant avec `aria-sort` sur leur cellule `th`.
Annoncez l’action suivante dans le nom accessible du bouton.

Comparez les montants en centimes, pas leurs libellés formatés.
Comparez les dates avant leur formatage localisé.
Utilisez la langue courante pour comparer les noms.
Ajoutez un identifiant stable comme dernier critère.

Si l’API retourne une seule page, indiquez clairement que le tri local porte sur cette page.
Ne présentez pas un tri local comme un tri de tout l’historique.

## Export

Le bouton d’export utilise une icône et un nom accessible complet.
Son infobulle apparaît au survol et au focus.
Échap ferme l’infobulle sans activer le bouton.

L’export CSV de la liste contient les résultats filtrés et chargés, dans leur ordre affiché.
Une limite de chargement reste visible près du compteur.
Les exports serveur de règlements et d’écritures conservent leur période et leurs règles propres.
L’export PDF reste distinct de l’export CSV.

Exportez seulement les colonnes explicitement prévues par la page.
N’exportez aucun secret, jeton, lien personnel de signature ou corps de courriel par défaut.
Protégez les cellules CSV contre l’interprétation de formules par les tableurs.

## Vérification

Vérifiez les thèmes clair et sombre.
Vérifiez le clavier, les infobulles et la restauration du focus.
Vérifiez les états chargement, erreur, vide et aucun résultat.
Vérifiez la recherche, le tri numérique, les filtres et le contenu téléchargé.
Vérifiez le zoom navigateur réel à 200 % pour chaque parcours déclaré couvert.
