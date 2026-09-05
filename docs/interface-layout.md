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
