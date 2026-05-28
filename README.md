# froment.software

Site vitrine Angular pour `froment.software`.

## Stack

- Angular 21
- SCSS
- i18n runtime `fr` / `en`
- build statique
- Docker + `joseluisq/static-web-server`
- Nix flake pour le devshell et la génération du Dockerfile

## Développement local

Pré-requis:

- Node.js 22
- npm 10

Installation:

```bash
npm ci
```

Lancer le serveur de dev:

```bash
npm start
```

Build production:

```bash
npm run build
```

Le build est généré dans `dist/froment-software/browser`.

## Nix

Entrer dans le devshell:

```bash
nix develop
```

Afficher le Dockerfile généré par le flake:

```bash
nix run .#dockerfile
```

Ou construire l'artefact correspondant:

```bash
nix build .#dockerfile
```

## i18n

Le site fonctionne avec une traduction runtime:

- détection automatique via `navigator.language`
- fallback `fr` puis `en`
- persistance du choix dans `localStorage`
- changement de langue à chaud via le `select` du footer

Le service principal est dans:

- `src/app/i18n.service.ts`

Cette approche est volontairement pragmatique pour un site vitrine avec switch runtime. Elle ne suit pas le mode Angular i18n compile-time classique basé sur fichiers d'extraction et builds séparés par locale.

## SEO

Le site inclut:

- titres de page dynamiques
- meta description par route
- Open Graph de base
- Twitter cards de base
- `robots.txt`
- `sitemap.xml`

Fichiers concernés:

- `src/app/app.ts`
- `src/app/app.routes.ts`
- `src/index.html`
- `public/robots.txt`
- `public/sitemap.xml`

## Docker

Build local de l'image:

```bash
docker build -t froment-software .
```

L'image:

1. build l'application Angular
2. copie le contenu de `dist/froment-software/browser`
3. sert le site statique avec `joseluisq/static-web-server`

## GitLab CI

Pipeline défini dans `.gitlab-ci.yml`.

Étapes:

1. `build_site`
   build Angular via `npm ci` puis `npm run build`
2. `build_container`
   build l'image Docker puis la pousse dans le registre GitLab

Tags poussés:

- `:$CI_COMMIT_SHA`
- `:latest` sur la branche par défaut

## Structure utile

```text
src/app/
  app.ts
  app.html
  app.scss
  app.routes.ts
  i18n.service.ts
  pages/

public/
  favicon.svg
  robots.txt
  sitemap.xml

.gitlab-ci.yml
Dockerfile
flake.nix
```
