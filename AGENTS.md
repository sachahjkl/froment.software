# AGENTS.md

## Commit Discipline

After every change that is considered "done" — i.e., a self-contained unit of work that compiles, passes tests, and accomplishes a discrete goal — commit **and push** immediately with a clear, descriptive message. Do not batch unrelated changes. Do not leave uncommitted work sitting in the tree.

**Amending is fine** for small corrections, typos, or tweaks to the same logical unit of work — use `git commit --amend` (and force-push if already pushed) to keep the history clean rather than making a separate "fix typo" commit.

Each commit should be:

- **Atomic**: one logical change, one commit.
- **Signed**: all commits are GPG-signed with the project SSH key via `commit.gpgsign=true`.
- **Well-described**: imperative mood, specific (e.g., "Add dark mode toggle" not "Update styles").

Push after a meaningful batch of commits, or when the work is ready for CI/review.

## Intent

This project follows https://srcmd.org, with the Markdown in `docs/intent` (the project has no root `src` folder). Read [docs/intent/README.md](docs/intent/README.md) first. Change the intent first, then the code and the tests. A change of design changes its intent file in the same commit. The other files of `docs/` are documentation and reviews, not intent.

## Changelog

- [CHANGELOG.md](CHANGELOG.md) follows Keep a Changelog and semantic versioning. Do not edit it by hand.
- Write each change that a visitor can see as one fragment in `changelog.d/`, in the same commit as the change. [changelog.d/README.md](changelog.d/README.md) gives the format.
- A change that no visitor can see has no fragment.

## Roadmap

- [ROADMAP.md](ROADMAP.md), next to `CHANGELOG.md`, holds the planned work of this project.
- Use plain Markdown: `# Roadmap`, then `## Now`, `## Next` and `## Later`, in this order. Each section is a list. Give no dates.
- Start each entry with a bold summary, then one or two sentences on what it gives the visitor. If a design exists, link its intent file in `docs/intent`.
- When a work is done, remove its entry in the same commit as its changelog fragment.

## Tests de l’interface

- Ne lancez pas les tests d’intégration navigateur ou Playwright dans les checks Nix, la CI ou les étapes de publication.
- Ne conditionnez pas une livraison à la réussite des scénarios navigateur ou d’une matrice visuelle.
- N’ajoutez pas de tests d’intégration de l’IHM sans demande explicite de l’utilisateur.
- Utilisez les outils navigateur existants uniquement pour des vérifications visuelles locales et ponctuelles.
- Ne figez pas la structure du DOM, les libellés, l’ordre des contrôles ou les détails visuels par des assertions exhaustives.
- Ne modifiez pas le produit uniquement pour satisfaire un scénario navigateur fragile.
- Gardez les tests proportionnés au risque. Préférez des tests ciblés sur les routes, les métadonnées et le flux Atom.
- Conservez les tests, la compilation, le lint et le formatage dans les checks.

## Composition de l’interface

- Réservez `details` et `summary` aux disclosures éditoriaux, comme les FAQ.
- Groupez les boutons et les liens avec un espacement explicite.
- Calculez les valeurs dérivées dans des fonctions typées ou des `computed`. Évitez les ternaires dans les templates.
- Importez les styles partagés avec les chemins Sass `shared/...`, configurés dans `angular.json`. Évitez les remontées `../../../shared`.
- Laissez le conteneur principal gérer la hauteur de la page. N’imposez pas une hauteur de viewport à chaque page interne.
- Conservez les URL des notes dans le sitemap, les métadonnées et le flux Atom.

## Learning More About Effect

This repository uses the Effect TypeScript library.

Before writing Effect code, read `packages/marketing/node_modules/effect/AGENTS.md` completely.

If the guide does not cover an API, search `packages/marketing/node_modules/effect/src`.

## Runtime Configuration

- Declare runtime settings in `packages/marketing/src/runtime-config.ts` with Effect `Config`.
- Read runtime settings through the injected `RuntimeConfiguration`.
- Do not store runtime settings in standalone constants or shared contracts.
- Validate runtime-dependent limits with the injected configuration.
- Use `ConfigProvider` or a configuration layer in tests instead of changing the global environment.
