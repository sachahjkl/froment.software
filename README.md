# froment.software

Ce dépôt contient la vitrine Froment Software. Le backoffice générique vit dans le dépôt `backoffice`. Le dossier [`backoffice/`](backoffice/) assemble l’instance réelle depuis `@sachahjkl/backoffice` sur npm.

## Code

- `packages/web` contient la vitrine Angular pré-rendue.
- `packages/marketing` sert les fichiers publics, le flux Atom `/notes/feed` et la configuration du navigateur.
- `packages/l10n` contient les textes français et anglais des pages publiques.
- `packages/contracts` contient les schémas de configuration et de version du déploiement.
- `packages/web/public/sitemap.xml` liste les pages indexables.

Le serveur redirige `/backoffice` et `/quote` vers l’instance réelle sur `backoffice.froment.software`. Il ne sert aucune API métier.

## Développement

Utilisez Node.js 26 et pnpm 11, ou entrez dans `nix develop`.

```sh
pnpm install --frozen-lockfile
pnpm start
pnpm build
pnpm test
pnpm lint
pnpm format:check
```

Les pages publiques utilisent `/fr/...` ou `/en/...`. La racine redirige vers `/fr`. Les routes `/fr/version` et `/en/version` lisent les métadonnées du déploiement depuis `/api/version`. Le flux des notes reste disponible sur `/notes/feed`.

## Construction et déploiement

```sh
nix flake check "path:$PWD" --no-write-lock-file
nix build .#dockerImage
```

L’image OCI démarre `froment-software-marketing` sur le port 3000. Elle contient le site pré-rendu et le serveur Effect, sans base de données ni migration. Le job de vérification ne construit pas l’image ; le job de publication la construit une seule fois.

La CI déploie d’abord en préproduction. Le workflow `deploy-production.yml` promeut ensuite le digest testé vers la production.

Définissez `PUBLIC_ORIGIN` à l’origine HTTPS de l’environnement. `APP_ENV`, `SITE_PHASE`, `BACKOFFICE_ORIGIN` et `GITHUB_REPOSITORY_URL` configurent l’affichage public et les redirections.
