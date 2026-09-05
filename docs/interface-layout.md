# Mise en page de l’interface

## Principes

Le site conserve ses polices, sa texture, ses boutons à dégradés et ses bordures.
Cette reprise concerne la disposition, la hiérarchie et la lisibilité, pas les fonctions métier.

- Alignez l’en-tête, le contenu et le pied de page avec `--page-x` dans une même largeur maximale.
- Conservez la largeur publique de 60 rem.
- Utilisez la largeur de 76 rem du backoffice pour les tableaux et les éditeurs.
- Utilisez `--panel-padding` pour les panneaux et les formulaires.
- Regroupez les champs liés avec `.field-grid` et réservez `.wide` aux champs occupant toute la ligne.
- Conservez un seul titre `h1` par page, y compris dans les pages de configuration imbriquées.
- Rendez la valeur complète accessible lorsqu’un texte est tronqué.

## Surfaces et composition

La texture reste visible autour du contenu, pas derrière le texte des pages.
Le conteneur principal utilise un fond opaque, une bordure et l’ombre `--shadow-page`.
La marge extérieure `--shell-gutter` conserve la texture sur les écrans étroits.
L’impression retire cette marge, la bordure et l’ombre du conteneur.

Les pages publiques utilisent `.page-intro` pour leur introduction et `.contact-panel` pour leur zone de contact.
Les titres d’introduction utilisent `--text-hero`, sans modifier les titres des éditeurs métier.
Les blocs de contenu réutilisent `.ds-panel` et les couleurs des deux thèmes.
Ces panneaux internes utilisent uniquement le fond `--color-panel` et les petits arrondis, sans bordure ni ombre.
Cette règle couvre notamment la recherche, les indicateurs et le bloc « Nos prestations ».
Le fond est plus sombre que la page en thème clair et plus clair en thème sombre.
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
