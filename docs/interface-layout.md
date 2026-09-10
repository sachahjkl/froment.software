# Mise en page de l’interface

## Principes

Le site conserve ses polices, sa texture, ses boutons à dégradés et ses bordures.
Cette reprise concerne la disposition, la hiérarchie et la lisibilité, pas les fonctions métier.

- Alignez l’en-tête, le contenu et le pied de page publics avec `--page-x`.
- Conservez la largeur publique de 60 rem.
- Utilisez toute la largeur disponible dans le backoffice.
- Limitez localement la largeur des formulaires lorsque leur contenu le nécessite.
- Utilisez `--panel-padding` pour les sous-groupes qui nécessitent un panneau.
- Ne placez pas le formulaire principal dans un panneau supplémentaire.
- Regroupez les champs liés avec `.field-grid` et réservez `.wide` aux champs occupant toute la ligne.
- Conservez un seul titre `h1` par page, y compris dans les pages de configuration imbriquées.
- Rendez la valeur complète accessible lorsqu’un texte est tronqué.

## Surfaces et composition

Les alertes utilisent `Notice` sur un paragraphe ou un bloc contenant plusieurs éléments.
Le composant gère la présentation, pas la position dans la page.
Dans une grille ou un conteneur flex, le parent gère l’espacement avec `gap`.
Dans un flux de blocs sans espacement existant, ajoutez `.notice-flow` au parent direct.
Cette classe sépare les alertes de leurs voisins avec `--space-4`.
N’ajoutez pas cette classe à une grille qui possède déjà un `gap`.

Le conteneur `main` reste transparent et gère uniquement la disposition.
Chaque page de premier niveau applique `.page-container`.
Les pages de configuration imbriquées ne répètent pas ce conteneur.

Les pages publiques conservent leur bordure, leur ombre et leur marge extérieure sur la texture.
Dans le backoffice, la surface de page reste opaque, sans bordure extérieure ni ombre.
La navigation latérale utilise les couleurs du thème existant.
L’impression retire la navigation et les marges extérieures.

Les pages publiques utilisent `.page-intro` pour leur introduction et `.contact-panel` pour leur zone de contact.
Les titres d’introduction utilisent `--text-hero`, sans modifier les titres des éditeurs métier.
Les blocs de contenu réutilisent `.ds-panel` et les couleurs des deux thèmes.
Les blocs internes utilisent un fond uniforme gris neutre, sans dégradé, contour ni ombre.
Le token de marque `--color-panel` définit ce fond : `#f0f0f0` en clair et `#2b2b2b` en sombre.
Les petits arrondis et l’espacement distinguent les groupes de contenu.
Cette règle couvre notamment la recherche, les indicateurs et le bloc « Nos prestations ».
Les boutons, les champs, les alertes et les séparateurs conservent leurs marques de contrôle ou de structure.

L’accueil place les prestations à côté de son introduction sur grand écran.
La grille d’expertise regroupe les sujets dans une surface commune.
Le déroulement d’une mission devient horizontal lorsque cinq étapes tiennent sur la largeur disponible.
Les projets et la présentation personnelle occupent ensuite deux colonnes.
Sur écran étroit, ces groupes suivent l’ordre du document dans une seule colonne.

Les prestations, secteurs clients, projets et articles utilisent des panneaux distincts.
La FAQ conserve les éléments natifs `details` et `summary`.
Un signe moins indique une réponse ouverte ; un signe plus indique une réponse fermée.
La navigation publique donne à la rubrique active une forme d’onglet et une bordure inférieure renforcée.
Le tableau de bord distingue les indicateurs, les actions requises et l’activité par des panneaux.

Ces choix appliquent le regroupement de `better-layout` et la séparation des surfaces de `better-ui`.
Ils conservent les polices, les petits rayons et les dégradés des contrôles existants.

## Éditeurs de documents

Les devis et factures partagent `packages/web/src/app/pages/back-office/_document-editor.scss`.
Sur grand écran, le formulaire et le récapitulatif occupent deux colonnes.
Sur écran étroit, le récapitulatif suit le formulaire dans l’ordre du document.

La largeur du formulaire détermine le regroupement des champs de ligne.
La description occupe une ligne entière.
La quantité, le prix et la TVA occupent trois colonnes lorsque la place le permet.
L’abandon d’un devis reste accessible dans une section dépliable explicitement nommée.

## Autres écrans

Le backoffice possède une navigation latérale avec icônes et un en-tête contenant le lien vers la documentation API.
La rubrique active couvre aussi ses éditeurs associés.
Le menu du compte occupe le haut de la navigation et remplace le titre visible du tiroir.
Il présente le compte actif, sa sécurité, la langue, le thème et la déconnexion.
Le tiroir conserve son nom accessible et son bouton de fermeture.
L’API actuelle ne fournit pas de liste de comptes disponibles ni de permissions au navigateur.
Les contrôles d’accès serveur restent inchangés.

Sous 64 rem, un tiroir remplace la navigation latérale.
Le composant `Drawer` utilise Angular CDK pour le focus, Échap, le fond modal et le blocage du défilement.
Le contenu `[drawerHeading]` remplace son titre visible sans modifier son nom accessible.
Les confirmations de sortie restent accessibles au-dessus du tiroir.
Une navigation annulée conserve le tiroir et la saisie.

La déconnexion passe par `/backoffice/sign-out` après les protections de sortie du formulaire.
Une sortie refusée ne modifie pas la session.
Un échec de déconnexion affiche une erreur et une action de nouvelle tentative.

Le composant `PageHeader` sépare le titre des actions avec retour à la ligne.
L’atelier `/design/navigation` présente ce composant et le tiroir interactif.

### Parcours Clients

La liste `/backoffice/clients` contient les onglets, la recherche et le tableau.
La recherche Fuse couvre le nom, l’adresse e-mail, la ville et le pays.
Les cellules longues reviennent à la ligne sur ordinateur.
Le tableau conserve un défilement horizontal local sur écran étroit.

La création utilise `/backoffice/clients/new`.
La fiche `/backoffice/clients/:clientId/profile` présente les coordonnées sans formulaire.
La modification utilise `/backoffice/clients/:clientId/edit`.
Les onglets Documents et Accès restent associés à la fiche.
L’archivage se trouve dans les actions de la fiche et nécessite une confirmation.

Le formulaire sépare l’identité de l’adresse de facturation.
Sa largeur locale maximale est de 44 rem.
Les modifications conservent le contrôle de version et les erreurs détaillées.
Les formulaires protègent les champs modifiés et les requêtes en cours lors d’une sortie de page.
Les documents publiés restent inchangés.

`ListToolbar` regroupe la recherche, les filtres et le nombre de résultats.
`EmptyState` sépare le titre, l’explication et l’action de création.
`DataTable` propose le mode `fluid` pour répartir les colonnes et autoriser le retour à la ligne.
L’atelier `/design/data` présente une recherche interactive et le tableau fluide.
L’atelier `/design/feedback` présente l’état vide.

Les actions rapides du tableau de bord se trouvent dans son en-tête.
Les indicateurs utilisent deux colonnes sur mobile.
Le menu du compte affiche l’adresse complète sans imposer sa largeur à l’en-tête.
Les champs du devis public restent contenus dans le panneau de signature.
Les formulaires de connexion ont une largeur limitée sur grand écran.
L’atelier `/design/inputs` présente la grille de champs partagée.

## Vérification

```sh
nix develop --command pnpm lint
nix develop --command pnpm --filter @froment/web build
nix develop --command pnpm --filter @froment/web test
nix develop --command pnpm test:interface
```

La suite navigateur conserve huit contrôles ciblés : quatre parcours en configuration mobile et desktop.
Elle utilise des données fictives et des réponses HTTP simulées.
Elle vérifie les éditeurs, le formulaire client, l’adresse du compte et le panneau de signature.
Elle ne certifie pas les parcours métier serveur ni toute l’accessibilité du site.

Le check Nix `interface` fournit Chromium uniquement pour les tests.
L’image de production conserve le contrôle qui interdit Chromium et Playwright dans sa closure.
