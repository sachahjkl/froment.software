# Référence des composants

La référence expose une URL par entrée de `reference-catalog.ts`.
Les huit familles de pages se chargent à la demande.
Le catalogue contient 56 entrées, dont la composition locale `DesignWorkspace`.

## Routes et chargement

`packages/web/src/app/app.routes.ts` charge le shell et les routes de référence à la demande.

```ts
{
  path: 'design',
  loadComponent: () =>
    import('./pages/design/design.component').then((module) => module.DesignComponent),
  loadChildren: () =>
    import('./pages/design/design.routes').then((module) => module.designRoutes),
  data: {
    titleKey: 'page.design',
    descriptionKey: 'page.description.design',
    robots: 'noindex, follow',
  },
}
```

`packages/web/src/app/app.ts` traite `/design` et ses descendants comme des pages autonomes.
Le shell autonome existant supprime ses en-têtes et son pied de page.
Il donne toute la largeur au contenu.
La référence fournit son propre `SiteFooter`, avec les préférences partagées.

`designRoutes` protège `/design/workflows` avec `unsavedChangesGuard`.
Les anciens onglets ne disposent pas de routes de compatibilité.
Les anciennes pages `design-documents` et `design-navigation` sont supprimées.

N’ajoutez pas `component-reference.ts` au dictionnaire global.
`reference-text.ts` importe ce dictionnaire typé par le point d’entrée `@froment/l10n/component-reference`.
Ne réexportez pas ce dictionnaire depuis `@froment/l10n`. Ses métadonnées calculées empêchent leur élimination du bundle initial.
Seules les pages différées utilisent cet export.
Les compteurs locaux utilisent le formateur partagé `formatPluralText`, avec les formes `one` et `other`.

## Contrôles navigateur existants

`checkDesignWorkspace(page, testInfo)` appelle maintenant `checkComponentReference(page, testInfo)`.
Il conserve ensuite ses huit contrôles de composition.
Aucune déclaration Playwright `test()` n’est ajoutée.

Adaptez le bloc de confirmation dans `tools/interface/interface.spec.mjs` :

```js
await page.goto("/design/confirmation");
const trigger = page.locator("[storyPreview] > button");
const status = page.locator('[storyPreview] [role="status"]');
```

Remplacez les deux recherches `.confirmation-demo [role="status"]` par `status`.
Conservez les assertions de focus, d’annulation et de confirmation.

Adaptez le filtre de `tools/interface/workspace-zoom.mjs` :

1. Ouvrez le `FilterMenu`.
2. Activez son élément `menuitem`.
3. Vérifiez le focus sur `#workspace-status input`.
4. Activez l’option portant le libellé `text.draft`.
5. Vérifiez le retour du focus sur la catégorie.
6. Fermez le dialogue avec Échap.

Ces deux fichiers restent sous la responsabilité du parent.

## Couverture et limites

Chaque entrée contient les propriétés publiques, les valeurs par défaut et un exemple statique.
Les réglages utilisent Signal Forms.
Le nombre de variantes désigne les exemples présentés, pas le produit cartésien des propriétés.
Les données éditées restent locales.
Les liens de `ContactActions` affichent leur destination sans l’ouvrir.
`CopyField` affiche son événement ; `AnchorLink` utilise le service de copie existant.

`SiteHeader` et `MobileNavigation` ne sont instanciés qu’une fois sur leur page.
Leur aperçu constitue leur unique variante.
Les exemples de shell disposent d’une zone de défilement propre.
Le corps principal reste transparent et conserve les styles globaux.

## Composants avec contexte

Les six composants précédemment exclus disposent chacun de leur entrée et de leur route.

`BusinessPreview` fournit un contexte limité à chaque aperçu.
Ses providers implémentent les signatures de lecture utilisées par les composants réels.
Les types `Pick` nomment ces méthodes sans rendre leurs contrats optionnels.
Les listes contiennent des objets complets conformes aux schémas de contrats.
Aucun provider ne crée de client HTTP ni de session authentifiée.

- `BackOfficeHeader` présente les comptes administrateur et client, le chargement, l’indisponibilité et la reprise.
- `BackOfficeNav` suit une URL locale, y compris les descendants et l’absence de page active.
- `GlobalSearch` présente les quatre catégories, le chargement, l’erreur, la reprise et une liste vide.
- `DocumentIssues` présente les devis et les factures, avec les groupes émetteur et client.

L’en-tête, la navigation et la recherche affichent chacun une seule instance réelle par page.
Les réglages changent son état sans dupliquer les identifiants de recherche.
Le compteur indique cette instance affichée, pas le nombre de combinaisons possibles.

Le routeur local enregistre les destinations sans activer de route métier.
Les attributs `href` restent dans la référence, y compris pour une ouverture dans un autre onglet.
Le lien HTML vers `/api/docs` reçoit le même traitement après rendu.
La déconnexion enregistre sa destination sans appeler `Authentication.signOut`.
La destruction de l’aperçu libère les lectures suspendues et supprime ses écouteurs.

`MermaidStories` possède son propre chunk différé.
La directive réelle importe Mermaid après rendu, uniquement dans le navigateur.
Les deux diagrammes prédéfinis contiennent un titre et une description accessibles.
Le sélecteur recrée le conteneur quand le diagramme ou la langue change.
Aucun champ ne permet de fournir du code Mermaid ou du HTML arbitraire.
Les réglages `strict`, `neutral`, `startOnLoad: false` et `suppressErrors: true` restent ceux de la directive partagée.

`CopyNotice` utilise `AnchorCopy` et la notice déjà fournie par le shell.
Le message et le fragment sont éditables.
La page n’ajoute aucune deuxième notice.
La copie écrit uniquement le lien de démonstration dans le presse-papiers.

## Vérification

Exécutez les commandes depuis la racine du dépôt :

```sh
nix develop -c pnpm --filter @froment/web build
nix develop -c pnpm --filter @froment/web test
nix develop -c pnpm --filter @froment/l10n test
nix develop -c pnpm lint
nix develop -c pnpm test:interface
```

Les tests couvrent les routes, les variantes déclarées, les formulaires, les pluriels, les filtres et le focus du Drawer.
Les tests de composition conservent les exports CSV et les départs protégés par le guard réel.
Le contrôle navigateur vérifie les pages, les réglages, la confirmation, le focus et l’absence de requêtes API.
Il produit des captures et une pièce jointe de sécurité.

Les tests ciblés vérifient aussi les contrats des exemples, les états locaux, la destruction et l’interception des destinations.
Les tests Mermaid remplacent uniquement le moteur de rendu pour vérifier les appels de la directive et son comportement serveur.
Le helper navigateur vérifie les SVG réels, les interactions de compte et la notice globale.

Le contrôle navigateur conserve huit scénarios exécutés, avec la matrice de zoom réel à 200 % dans un scénario existant.
Vérifiez que le dictionnaire de référence et Mermaid restent hors des imports statiques du bundle initial.
Le fichier `docs/ux-handoff.md` indique les limites de la vérification en cours.
