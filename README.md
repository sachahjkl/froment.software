# froment.software

Froment Software pnpm workspace. An Effect server serves the API and the pre-rendered Angular site.

## Architecture

- `packages/web` contains the Angular application.
- `packages/api` contains the Effect server.
- `packages/contracts` contains the shared Effect schemas.
- `packages/documents` contains the Angular document components.
- `@angular/build:application` produces the browser and server rendering with `outputMode: "static"`.
- `packages/web/src/app/app.routes.server.ts` configures the rendering of each Angular route.
- `pnpm build` writes the site to `packages/web/dist/froment-software/browser`.
- `packages/web/src/app/app.routes.ts` contains the route components and metadata.
- `packages/web/src/app/app.ts` updates the metadata during navigation.
- Public assets are in `packages/web/public`.
- The social card declared in `packages/web/src/index.html` measures 1200 × 630.

### Languages

The initial HTML and all pre-rendered content are in French (`<html lang="fr">`). In the browser, `I18nService` switches between French and English without changing the URL. It first restores the preference saved in `localStorage`. Otherwise, it selects French for a French-language browser and English for other browsers.

This preference takes effect only after the client loads. Add each text to `packages/web/src/app/i18n.service.ts`.

## Routes and indexing

The indexable public routes are listed in `packages/web/public/sitemap.xml`.

- `/design` is a visual QA workshop. It is intentionally absent from public navigation and the sitemap, with `noindex, follow`.
- `/404` is pre-rendered, uses `noindex, nofollow`, and provides the error content.
- The generic Angular route displays the same component during unknown client-side navigation.
- The Effect server returns a `404` status for a missing URL.

The server resolves pre-rendered files and directories. It does not use a general fallback to `/index.html`.

### Add a route

1. Add the component to `packages/web/src/app/pages/`.
2. Declare the path without a trailing slash in `packages/web/src/app/app.routes.ts`.
3. Provide `titleKey` and `descriptionKey` in both languages.
4. Set `robots` for a non-indexable route.
5. Add the required navigation links.
6. If the route is indexable, add its URL to `packages/web/public/sitemap.xml`.
7. Check the HTML, metadata, languages, and HTTP statuses.

## Design system and visual QA

The global tokens are in `packages/web/src/tokens.css`.

The global primitives are in `packages/web/src/styles.scss`.

The shared layout rules are in [docs/interface-layout.md](docs/interface-layout.md).
Run `nix develop --command pnpm test:interface` for the eight focused browser checks.

Component-specific styles remain with that component.

Before you change a shared value or primitive, open `/design`. This route groups foundations, components, data, states, responsive compositions, and motion. After a change, keep its specimens current and check at least:

- French and English;
- keyboard use, visible focus, and normal/hover/active/disabled/error states;
- mobile and desktop widths, without horizontal overflow;
- the system preference for reduced motion.

The `/design` route remains hidden and non-indexable. Do not add it to the sitemap.

## Local development

Prerequisites: Node.js 22 and pnpm 11.20.0, or `nix develop`.

```bash
pnpm install --frozen-lockfile
pnpm start       # serveur de développement
pnpm watch       # build de développement en continu
pnpm build       # pré-rendu de production
pnpm --filter @froment/api db:migrate # migration explicite de la base
pnpm test        # tests Angular
```

The flake builds and checks the site without network access during the build:

```bash
nix flake check          # build, tests, workflow et image
nix build                # site pré-rendu
nix run                  # serveur Effect local sur le port 3000
nix build .#dockerImage  # archive Docker reproductible
```

## Podman deployment

The flake builds a Docker archive with Node.js, the Effect server, and the pre-rendered site.

The image runs `froment-software-migrate`, then starts `froment-software` only after it succeeds. Starting the server directly does not run migrations.

During deployment, stop the old container before you start the new one. Back up the volume, then start the new container with the command below.

```bash
podman load < result
podman run --rm \
  -e PUBLIC_ORIGIN=https://froment.software \
  -p 8080:3000 \
  -v froment-data:/var/lib/froment-software \
  froment-software:0.0.0
```

GitHub Actions checks the flake, builds the site, then publishes the image with the SHA and the `latest` tag on the default branch.

The server requires `PUBLIC_ORIGIN` at startup. Provide the complete public origin for each environment, without a path.

The image uses the non-root user `froment` with UID 1000. Make this UID the owner of volumes mounted from the host.

The server requires `BUSINESS_TIME_ZONE` with a valid IANA time zone name. Production explicitly uses `Europe/Paris`.

This time zone defines the business date for invoice issuance. Technical timestamps remain in UTC.

## Legal content

The legal pages use the text from `packages/web/src/app/i18n.service.ts`.

Their content must describe the behavior that is actually deployed.
