# froment.software

Site vitrine Angular 22 de Froment Software, pré-rendu en fichiers statiques puis servi par nginx.

## Architecture

- `@angular/build:application` produit le navigateur et le rendu serveur avec `outputMode: "static"`.
- `src/app/app.routes.server.ts` applique `RenderMode.Prerender` à toutes les routes Angular.
- `pnpm build` écrit le site déployable dans `dist/froment-software/browser` : chaque route connue dispose de son `index.html`, notamment `/404`.
- `src/app/app.routes.ts` porte les composants et les métadonnées de route. `src/app/app.ts` met à jour titre, description, URL canonique, robots, Open Graph et Twitter lors de la navigation.
- Les ressources publiques (`robots.txt`, `sitemap.xml`, favicons et carte sociale) sont dans `public/`. La carte sociale déclarée dans `src/index.html` mesure 1200 × 630.

### Langues

Le HTML initial et tout le pré-rendu sont en français (`<html lang="fr">`). Dans le navigateur, `I18nService` permet de passer entre français et anglais sans changer d’URL. Il restaure d’abord la préférence enregistrée dans `localStorage`, sinon choisit le français pour un navigateur francophone et l’anglais pour les autres.

Cette préférence n’agit qu’après le chargement côté client : elle ne produit ni HTML anglais pré-rendu, ni URL localisée, ni version anglaise distincte pour les moteurs de recherche. Toute nouvelle copie et toute métadonnée doivent être ajoutées dans les deux dictionnaires de `src/app/i18n.service.ts`.

## Routes et indexation

Les routes publiques indexables sont `/`, `/about`, `/clients`, `/services`, `/tools`, `/legal`, `/privacy` et `/cookies`. Elles figurent dans `public/sitemap.xml`.

- `/design` est un atelier de QA visuelle, volontairement absent de la navigation publique et du sitemap, avec `noindex, follow`.
- `/404` est pré-rendue, porte `noindex, nofollow` et sert de contenu d’erreur.
- La route Angular générique affiche le même composant pour une navigation cliente inconnue, mais nginx ne transforme pas les URL inconnues en réponses `200`.

`nginx.conf` impose les URL sans slash final par redirection `308`. Il résout une route avec `$uri/index.html`; un fichier ou une route absente renvoie un vrai statut `404` avec le document `/404/index.html`. Ne pas remplacer cette règle par un fallback général vers `/index.html`, qui rendrait les erreurs indexables comme des succès.

### Ajouter une route

1. Ajouter le composant dans `src/app/pages/` et déclarer le chemin sans slash final dans `src/app/app.routes.ts`.
2. Fournir `titleKey` et `descriptionKey`, avec les textes français et anglais correspondants dans `i18n.service.ts`. Définir explicitement `robots` pour une route non indexable.
3. Ajouter les accès de navigation nécessaires. Ajouter l’URL canonique à `public/sitemap.xml` seulement si la route est publique et indexable.
4. Le wildcard de `app.routes.server.ts` pré-rend automatiquement les routes statiques déclarées; conserver cette politique sauf besoin de rendu différent explicite.
5. Vérifier le HTML produit, les métadonnées, le changement de langue et le comportement nginx de l’URL avec et sans slash.

## Système de design et QA visuelle

Les tokens globaux (couleurs sémantiques, typographie, espacements, rayons, ombres, mouvement et dimensions de mise en page) ainsi que les primitives partagées vivent dans `src/styles.scss`. Les styles de coque sont dans `src/app/app.scss`; les ajustements propres à une page restent avec son composant.

Avant de modifier une valeur ou une primitive partagée, ouvrir `/design`. Cette route rassemble fondations, composants, données, états, compositions responsives et mouvement. Après une modification, maintenir ses spécimens à jour et contrôler au minimum :

- français et anglais;
- clavier, focus visible, états normal/survol/actif/désactivé/erreur;
- largeurs mobile et bureau, sans débordement horizontal;
- préférence système de réduction des animations.

La route `/design` reste cachée et non indexable; ne pas l’ajouter au sitemap.

## Développement local

Prérequis : Node.js 22 et pnpm 11.20.0, ou `nix develop`.

```bash
pnpm install --frozen-lockfile
pnpm start       # serveur de développement
pnpm watch       # build de développement en continu
pnpm build       # pré-rendu de production
pnpm test        # tests Angular
```

Le flake construit et vérifie le site sans accès réseau pendant la compilation :

```bash
nix flake check          # build, tests, workflow et image
nix build                # site pré-rendu
nix run                  # serveur nginx local sur le port 80
nix build .#dockerImage  # archive Docker reproductible
```

## Déploiement Podman

Le flake construit une archive Docker avec le site pré-rendu et nginx.

```bash
podman load < result
podman run --rm -p 8080:80 froment-software:0.0.0
```

GitHub Actions vérifie le flake, construit le site, puis publie l’image avec le SHA et le tag `latest` sur la branche par défaut.

## Contenus juridiques

Les pages `/legal`, `/privacy` et `/cookies` utilisent les textes bilingues de `i18n.service.ts` et leurs templates de `src/app/pages/`. Toute modification de ces textes ou de leur date doit être précédée d’une revue du déploiement réel et de sa journalisation : les mentions sur l’hébergement, les données techniques, la conservation ou les cookies doivent décrire le comportement effectivement exploité, pas seulement le code de l’application.
