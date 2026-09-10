# Référence des composants

La référence expose une URL par entrée de `reference-catalog.ts`.
Les six familles de pages se chargent à la demande.
Le catalogue contient 50 entrées, dont la composition locale `DesignWorkspace`.

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
`reference-text.ts` importe ce dictionnaire typé par l’export du paquet `@froment/l10n`.
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

Les contrôles suivants sont exclus et signalés dans la navigation :

- `BackOfficeHeader` et `BackOfficeNav` dépendent du contexte de compte.
- `GlobalSearch` exécute des recherches métier.
- `DocumentIssues` dirige vers les écrans de correction métier.
- `MermaidDiagrams` appartient au rendu de contenu, hors de cette référence.
- `CopyNotice` appartient au shell de l’application.

## Vérification

Les tests sont écrits, mais ils ne sont pas exécutés par cet agent.
Aucune compilation, analyse TypeScript, analyse lint ou session navigateur n’est lancée.

Les tests couvrent les routes, les variantes déclarées, les formulaires, les pluriels, les filtres et le focus du Drawer.
Les tests de composition conservent les exports CSV et les départs protégés par le guard réel.
Le contrôle navigateur vérifie les pages, les réglages, la confirmation, le focus et l’absence de requêtes API.
Il produit des captures et une pièce jointe de sécurité.

La taille des chunks, le rendu à 200 % et les comportements de focus restent à mesurer par le parent.
