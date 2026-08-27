[English](README.md) | [Français](README.fr.md)

# froment.software

Workspace pnpm de Froment Software. Un serveur Effect sert l'API et le site Angular pré-rendu.

## Architecture

- `packages/web` contient l'application Angular.
- `packages/api` contient le serveur Effect.
- `packages/contracts` contient les schémas Effect partagés.
- `packages/documents` contient les composants Angular des documents.
- `@angular/build:application` produit le navigateur et le rendu serveur avec `outputMode: "static"`.
- `packages/web/src/app/app.routes.server.ts` configure le rendu de chaque route Angular.
- `pnpm build` écrit le site dans `packages/web/dist/froment-software/browser`.
- `packages/web/src/app/app.routes.ts` porte les composants et les métadonnées de route.
- `packages/web/src/app/app.ts` met à jour les métadonnées lors de la navigation.
- Les ressources publiques sont dans `packages/web/public`.
- La carte sociale déclarée dans `packages/web/src/index.html` mesure 1200 × 630.

### Langues

Le HTML initial et tout le pré-rendu sont en français (`<html lang="fr">`). Dans le navigateur, `I18nService` permet de passer entre français et anglais sans changer d’URL. Il restaure d’abord la préférence enregistrée dans `localStorage`, sinon choisit le français pour un navigateur francophone et l’anglais pour les autres.

Cette préférence agit seulement après le chargement côté client. Ajoutez chaque texte dans `packages/web/src/app/i18n.service.ts`.

## Routes et indexation

Les routes publiques indexables figurent dans `packages/web/public/sitemap.xml`.

- `/design` est un atelier de QA visuelle, volontairement absent de la navigation publique et du sitemap, avec `noindex, follow`.
- `/404` est pré-rendue, porte `noindex, nofollow` et sert de contenu d’erreur.
- La route Angular générique affiche le même composant pendant une navigation cliente inconnue.
- Le serveur Effect renvoie un statut `404` pour une URL absente.

Le serveur résout les fichiers et les répertoires pré-rendus. Il n'utilise pas de fallback général vers `/index.html`.

### Ajouter une route

1. Ajoutez le composant dans `packages/web/src/app/pages/`.
2. Déclarez le chemin sans slash final dans `packages/web/src/app/app.routes.ts`.
3. Fournissez `titleKey` et `descriptionKey` dans les deux langues.
4. Définissez `robots` pour une route non indexable.
5. Ajoutez les accès de navigation nécessaires.
6. Si la route est indexable, ajoutez son URL dans `packages/web/public/sitemap.xml`.
7. Vérifiez le HTML, les métadonnées, les langues et les statuts HTTP.

## Système de design et QA visuelle

Les tokens globaux sont dans `packages/web/src/tokens.css`.

Les primitives globales sont dans `packages/web/src/styles.scss`.

Les styles propres à un composant restent avec ce composant.

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
pnpm --filter @froment/api db:migrate # migration explicite de la base
pnpm test        # tests Angular
```

Le flake construit et vérifie le site sans accès réseau pendant la compilation :

```bash
nix flake check          # build, tests, workflow et image
nix build                # site pré-rendu
nix run                  # serveur Effect local sur le port 3000
nix build .#dockerImage  # archive Docker reproductible
```

## Déploiement Podman

Le flake construit une archive Docker avec Node.js, le serveur Effect et le site pré-rendu.

L'image exécute `froment-software-migrate`, puis démarre `froment-software` seulement après sa réussite. Le démarrage direct du serveur n'exécute aucune migration.

Lors d'un déploiement, arrêtez l'ancien conteneur avant de démarrer le nouveau. Sauvegardez le volume, puis lancez le nouveau conteneur avec la commande ci-dessous.

```bash
podman load < result
podman run --rm \
  -e PUBLIC_ORIGIN=https://froment.software \
  -p 8080:3000 \
  -v froment-data:/var/lib/froment-software \
  froment-software:0.0.0
```

GitHub Actions vérifie le flake, construit le site, puis publie l’image avec le SHA et le tag `latest` sur la branche par défaut.

Le serveur exige `PUBLIC_ORIGIN` au démarrage. Fournissez l'origine publique complète de chaque environnement, sans chemin.

L'image utilise l'utilisateur non-root `froment` avec l'UID 1000. Donnez cet UID comme propriétaire aux volumes montés depuis l'hôte.

Le serveur exige `BUSINESS_TIME_ZONE`, avec un nom de fuseau IANA valide. La production utilise explicitement `Europe/Paris`.

Ce fuseau définit la date métier des émissions de facture. Les horodatages techniques restent en UTC.

## Contenus juridiques

Les pages juridiques utilisent les textes de `packages/web/src/app/i18n.service.ts`.

Leur contenu doit décrire le comportement réellement déployé.
