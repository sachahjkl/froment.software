# UX checkpoint — 2026-09-10

This checkpoint preserves unfinished work for handoff. It is not a release candidate.

## Delivered

- `eaba432d` is deployed. Audit pagination uses Effect `Config` through the injected `RuntimeConfiguration`.
- Authentication loads on demand. Compact Catalog and Email controls are already deployed.

## Included in this checkpoint

- Shared list controls across Affairs, Billing, Banking, Clients, and administration.
- Separate list, detail, and task routes, with existing authorization and form-exit protections.
- Separate Team, API, External services, and Audit navigation.
- Customer document pages and administrator-only global search.
- Shared plural formatting and literal-safe translation interpolation.
- A full-width component reference with searchable navigation, variants, and editable properties.
- Bounded financial API reads, detail endpoints, and permission tests.
- Browser scenarios and real 200% zoom coverage, still awaiting a complete passing run.

## Verification already completed

These results apply to earlier snapshots, not every final checkpoint edit.

- Angular build: initial bundle **853.34 kB**, below the unchanged **1.05 MB** limit.
- Frontend: **702 tests passed** before the latest PDF and component-reference additions.
- Localization: **78 tests passed**.
- Contracts: **51 tests passed**.
- Bounded API suite: **142 tests passed**.
- The last lint run found one test-helper type error. It is corrected but not rechecked.
- The full browser run failed in all eight scenarios, with three shared causes.

## Next work

1. Review the latest PDF download service and contextual component-reference additions.
2. Complete the six contextual reference entries. Their routes, catalogue entries, tests, and browser checks are not connected.
3. Implement the Mermaid and CopyNotice demonstrations. Mermaid currently contains only generated scaffolding.
4. Remove the six reference exclusions after completing their demonstrations. The target is 56 entries, including `DesignWorkspace`.
5. Run Angular build, frontend tests, localization tests, and lint through `nix develop -c`.
6. Run exactly eight existing Playwright checks. Do not add a ninth check.
7. Verify the fixes for closed-search ARIA references, PDF downloads, and public-quote fixtures.
8. Complete real 200% zoom checks and inspect desktop, narrow, light, dark, focus, and modal states.
9. Confirm the component-reference dictionary and Mermaid remain outside the initial public bundle.
10. Split verified changes into reviewable units before merging the checkpoint into `master`.
11. Check CI, image publication, and `/api/version` separately after release pushes.

## Verification files

The temporary snapshot is older than the final checkpoint. Copy current source changes before reusing it.

- Snapshot: `/tmp/nix-shell.7rmpGh/opencode/workspace-verification-2`
- Latest frontend log: `/tmp/nix-shell.7rmpGh/opencode/workspace-web-checks-6.log`
- API log: `/tmp/nix-shell.7rmpGh/opencode/workspace-api-checks-3.log`
- Failed browser log: `/tmp/nix-shell.7rmpGh/opencode/workspace-interface-3.log`
- Browser captures: `test-results/interface/` inside that snapshot.

## Boundaries

- The user explicitly approved including both encrypted SOPS files in this checkpoint.
- Keep credentials encrypted. Do not expose credentials or change SecretSpec fallback behavior.
- Do not modify backups, production DNS, Tuta MX, or activate paid services.
- Keep business messages simulated and financial providers in test or sandbox mode.
- Do not resend Resend tests or create another Stripe verification session.
- Preserve immutable documents, audit history, idempotency, passkeys, and permission checks.
- Preserve pinned tool versions and Nix inputs. Do not run full local `nix flake check`.
- Do not overlap heavy local verification with self-hosted CI.
- Backlog tools are unavailable. Do not edit `BACKLOG.json` directly.

All agents and local verification commands were stopped at handoff.
