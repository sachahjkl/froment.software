# AGENTS.md

## Commit Discipline

After every change that is considered "done" — i.e., a self-contained unit of work that compiles, passes tests, and accomplishes a discrete goal — commit **and push** immediately with a clear, descriptive message. Do not batch unrelated changes. Do not leave uncommitted work sitting in the tree.

**Amending is fine** for small corrections, typos, or tweaks to the same logical unit of work — use `git commit --amend` (and force-push if already pushed) to keep the history clean rather than making a separate "fix typo" commit.

Each commit should be:

- **Atomic**: one logical change, one commit.
- **Signed**: all commits are GPG-signed with the project SSH key via `commit.gpgsign=true`.
- **Well-described**: imperative mood, specific (e.g., "Add dark mode toggle" not "Update styles").

Push after a meaningful batch of commits, or when the work is ready for CI/review.

## Learning More About Effect

This repository uses the Effect TypeScript library.

Before writing Effect code, read `node_modules/effect/AGENTS.md` completely.

If the guide does not cover an API, search `node_modules/effect/src`.
