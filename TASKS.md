# Back-Office Delivery

## Rendering

- [x] Serve the client-rendered shell for private and capability routes.
- [x] Prevent the login page from navigating during prerender.
- [x] Add a regression test for direct back-office navigation.

## Invoices

- [x] Expose confirmed orders for invoice creation.
- [x] Add the Angular invoice API client.
- [x] Add the invoice list and dashboard entry.
- [x] Add invoice creation and draft revision forms.
- [x] Add issue, paid, and void actions.
- [x] Add invoice preview and PDF actions.
- [x] Add invoice translations and tests.

## Client Portal

- [x] Add the client role and assign it to existing and new clients.
- [x] Add tenant-scoped quote, order, and invoice contracts.
- [x] Add tenant-scoped list endpoints.
- [x] Add tenant-scoped PDF download endpoints.
- [x] Replace the empty portal with document tables.
- [x] Add tenant-isolation and portal tests.

## Review Hardening

- [x] Reject impossible invoice calendar dates at every boundary.
- [x] Generate the final invoice PDF during invoice issuance.
- [x] Protect PDF layouts against long content and page breaks.
- [x] Make invoice form validation accessible.
- [x] Make the client-role migration fail on identifier collisions.
- [x] Cover invoice creation, revisions, transitions, failures, and PDFs in Angular tests.
- [x] Add browser coverage for direct private-route rendering.
- [x] Validate all packages, lint, formatting, and migrations.

## Full Review

- [x] REV-001 Preserve published migrations and add a corrective migration.
- [x] REV-002 Make invoice PDF rendering durable after issuance.
- [x] REV-003 Expire sent quotes and allow revision after expiration.
- [x] REV-004 Revoke public quote links when a client is archived.
- [x] REV-005 Validate document line calculations and aggregates.
- [x] REV-006 Format all safe monetary integers without precision loss.
- [x] REV-007 Isolate pull-request CI from persistent runners.
- [x] REV-008 Run Chromium as a sandboxed non-root user.
- [x] REV-009 Expose API test failures in Nix and make the test derivation pass twice.
- [x] REV-010 Revoke old client access during rotation.
- [x] REV-011 Rate-limit successful authentication.
- [x] REV-012 Rate-limit public quote reads and downloads.
- [x] REV-013 Make published documents immutable and verify artifact hashes.
- [x] REV-014 Enforce cross-table business relationships.
- [x] REV-015 Roll back migrations that violate foreign keys.
- [x] REV-016 Validate canonical UTC timestamps.
- [x] REV-017 Render quote dates in UTC.
- [x] REV-018 Store invoice issue dates in the business time zone.
- [x] REV-019 Validate invoice issue retry versions.
- [x] REV-020 React to document route parameter changes.
- [x] REV-021 Disable invoice issuance for dirty drafts.
- [x] REV-022 Expose public quote form validation errors.
- [x] REV-023 Expose private form validation errors.
- [x] REV-024 Prevent stale client-list responses.
- [x] REV-025 Preserve preset reload errors.
- [x] REV-026 Make mobile navigation modal.
- [x] REV-027 Make overflowing tables keyboard accessible.
- [x] REV-028 Configure the production origin at runtime.
- [x] REV-029 Serialize image publication.
- [x] REV-030 Pin Skopeo through the flake.
- [x] REV-031 Support dirty local image checks.
- [x] REV-032 Lint all tracked TypeScript files.
- [x] REV-033 Separate database migrations from application startup.
- [x] REV-034 Redact CSRF headers from traces.
- [x] REV-035 Preserve literal translation replacements.
- [x] REV-036 Validate client invoice dates.
- [x] REV-037 Limit document snapshots to 20 lines.
- [x] REV-038 Verify PDF hashes on every download.
- [x] REV-039 Make client archival idempotent.
- [x] REV-040 Use a memory-hard bootstrap password hash.
- [x] REV-041 Limit route versions to safe integers.
- [x] REV-042 Validate generated quote URLs.
- [x] REV-043 Reject whitespace-only display names.
- [x] REV-044 Keep one main landmark on public quotes.
- [x] REV-045 Prevent public quote mobile overflow.
- [x] REV-046 Clear stale blog metadata.
- [x] REV-047 Translate public quote accessible names.
- [x] REV-048 Enforce invoice dates and numbers in SQLite.
- [x] REV-049 Correct the documented container port.
- [x] REV-050 Enforce coverage thresholds for sensitive code.

## Back-Office Usability

- [x] Replace decorative document styling with a compact utility layout.
- [x] Give line fieldset legends an explicit background.
- [x] Add client detail and editing workflows.
- [x] Use consistent form panels on client pages.
- [x] Remove table-row hover transitions.
- [x] Verify generated PDFs contain extractable text.
- [x] Match quote and invoice documents to the USGC business layout.

## Back-Office Operations

- [x] Add a unified affair detail with documents and chronological history.
- [x] Add contextual next actions to each affair.
- [x] Add manual quote and overdue invoice reminders.
- [x] Add due dates, overdue states, and upcoming deadlines.
- [x] Record a structured reason when a quote is cancelled.
- [x] Offer client access creation after client reactivation.
- [x] Add a business event journal to each affair.
- [x] Add global search across clients and document references.
- [x] Add bulk invoice reminders and document exports.
- [x] Add an operational dashboard for pending and recent work.

## Typst PDF Rendering

- [ ] PDF-001 Replace Angular, Playwright, and Chromium document rendering with local Typst compilation. Complete every requirement below before removing the current renderer.

### Rendering Architecture

- Keep `DocumentRendererService` as the boundary for quote, invoice, and order rendering.
- Replace HTML rendering and `page.pdf()` with a Typst compiler process.
- Pass a validated, document-specific JSON input to each Typst template.
- Keep business calculations, date formatting, and monetary formatting in TypeScript.
- Pass display-ready values to Typst so templates contain no business rules.
- Create an isolated temporary directory for each compilation.
- Restrict Typst file access to the template, input, font, and output directories.
- Use only local templates, assets, and fonts during compilation.
- Remove every network dependency from document rendering.
- Delete temporary inputs and outputs after each success or failure.
- Preserve the current rendering concurrency limit and Effect resource lifecycle.
- Return typed renderer failures without exposing paths, commands, or document content.
- Keep output stable for the same snapshot, template files, and toolchain.

### PDF-Only Preview

- Remove HTML document previews from the API and Angular application.
- Change quote, invoice, and order preview routes to return `application/pdf`.
- Compile preview PDFs directly from the current draft snapshot.
- Display preview responses as object URLs in the existing `iframe` surfaces.
- Revoke each replaced or destroyed object URL.
- Preserve loading, retry, empty, and failure states in every editor.
- Keep preview responses private, uncached, and protected by the current authorization rules.
- Do not store preview PDFs as immutable document artifacts.
- Remove the Angular server-rendered document package after all previews use PDF responses.

### Typst Templates

- Create separate Typst templates for quotes, invoices, and order confirmations.
- Add shared Typst functions only for repeated business identity, address, table, total, and footer structures.
- Reproduce the current templates as closely as Typst permits.
- Preserve A4 portrait pages, white backgrounds, and `12.7mm` content margins.
- Preserve the current compact USGC-inspired visual hierarchy, spacing, borders, and alignment.
- Preserve all French labels, legal notices, references, dates, conditions, and payment details.
- Preserve `fr-FR` date output in UTC and `fr-FR` EUR monetary output.
- Use Cousine as the primary font and Liberation Mono as the fallback font.
- Embed the required font subsets in every generated PDF.
- Preserve selectable and extractable text. Do not rasterize complete pages.
- Support one through twenty document lines without horizontal overflow.
- Support 160-character line descriptions and 2,000-character terms without content loss.
- Keep monetary columns on one line and align their values consistently.
- Prevent a document line from splitting across pages when it fits on one page.
- Repeat table headings after each automatic page break.
- Keep totals, legal notices, and the final footer readable across page breaks.
- Preserve the current flow-based header and footer unless a reviewed reference requires a change.
- Do not add page numbers or repeated page furniture without an approved visual change.
- Replace the current template implementations in place. Do not introduce template version `2`.

### Greenfield Replacement

- Replace the current renderer and templates directly.
- Do not add a compatibility renderer, migration path, cutover mode, or dual-engine deployment.
- Reset development artifacts and document data when the new renderer requires incompatible data.
- Remove obsolete HTML rendering code as soon as the PDF preview path works.
- Remove the Chromium renderer in the same change that enables Typst rendering.
- Keep the artifact and signature integrity rules for all documents generated after the replacement.

### Artifact Behavior

- Preserve `document_artifacts` identifiers, relations, MIME type, size, SHA-256, content, and creation time.
- Preserve one immutable artifact per revision and artifact type.
- Preserve idempotent rendering under concurrent requests.
- Preserve SHA-256 verification on every administrator, client, and public download.
- Preserve `document.rendered` audit events.
- Preserve the public quote proof relationship between snapshot, PDF, signature, and SHA-256.
- Preserve durable invoice PDF jobs, retries, restart recovery, and public status values.
- Keep invoice issuance successful when PDF compilation fails after the issuance transaction.
- Preserve all current download routes, file names, authorization checks, and response headers.

### Nix And Container

- Package Typst, the local templates, Cousine, and Liberation Mono through Nix.
- Pin the Typst version through the repository flake.
- Remove `playwright-core` from production dependencies.
- Remove Chromium, its sandbox, `CHROMIUM_PATH`, and browser-specific container setup.
- Keep Chromium only in test derivations that still require browser testing.
- Ensure the production image closure contains no Chromium or Playwright paths.
- Keep Poppler in test derivations for PDF inspection. Do not add it to the production image.
- Build the production image from the existing Nix `scratch`-style image definition.
- Record compressed and unpacked image sizes before and after the replacement.

### Verification

- Add compact and maximum-content fixtures for every document type.
- Add reviewed PDF or rasterized-page references for all three templates.
- Compare every page against its reviewed visual reference with an explicit tolerance.
- Verify A4 dimensions, page counts, text extraction, and embedded Cousine fonts with Poppler.
- Verify all twenty lines and complete long terms remain in multipage output.
- Verify table headings repeat and monetary columns do not wrap.
- Verify repeated rendering of one fixture produces identical PDF bytes.
- Verify previews return PDF content and never create stored artifacts.
- Verify preview object URLs are replaced and revoked correctly in Angular tests.
- Verify signed quote proofs match their stored Typst PDF hashes.
- Verify concurrent requests create one logical artifact.
- Verify invoice jobs recover after compiler failure and process restart.
- Verify compilation uses no network access.
- Run all package tests, lint, formatting, migration tests, and `nix flake check`.
- Deploy only after the production image starts without Chromium and all PDF routes pass smoke tests.

## Integration API Greenfield Cleanup

- [x] API-001 Enforce Origin from the selected authentication mode. Remove the global exemption based on any `Authorization` header. Require the configured Origin for browser mutations. Exempt only a Bearer credential selected by the integration middleware. Cover arbitrary, Basic, mixed, missing, and valid credentials through HTTP tests.
- [ ] API-002 Make global request errors match their contracts. Return typed `RequestInvalidOrigin` and `RequestTooLarge` errors through `HttpApiBuilder`, including `_tag` and `code`. Declare each error only on endpoints that can produce it. Cover fixed-length and chunked oversized bodies, then verify that the server remains available.
- [x] API-003 Use one administrator authorization pipeline. Annotate internal and integration endpoints with their required permission set and mutation quota. Execute authentication, current owner permission checks, CSRF, and quotas in one middleware. Remove `authorizeAdministratorSession`, `authorizeAdministratorWrite`, and `Authentication.authorizeWrite`.
- [x] API-004 Select Cookie and Bearer credentials without cross-decoding. Give each Effect security handler one credential type. Reject absent, malformed, and mixed credentials explicitly. Remove application calls to `HttpApiBuilder.securityDecode`. Test that each credential invokes exactly one security branch.
- [x] API-005 Apply Bearer admission quotas before token HMAC and SQLite work. Consume an address quota before `IntegrationTokens.authenticate`, then consume the token quota before permission checks. Test the exact execution order with rejected and accepted requests.
- [x] API-006 Define every permission once. Replace the separate general and integration literal lists with one permission registry containing integration and client-role metadata. Derive schemas, UI options, OpenAPI eligibility, and role expectations from this registry. Reject duplicate requested permissions in the contract schema.
- [x] API-007 Enforce reusable token names in SQLite. Replace the removed global unique index with an indexed trigger that rejects a duplicate name only while an existing token remains unrevoked and unexpired at the new token creation time. Translate only this database constraint into `IntegrationTokenNameConflict`. Cover direct SQL writes, revocation, expiration, whitespace, and case policy.
- [x] API-008 Index and validate token pagination. Add an index on `(created_at DESC, id DESC)`. Resolve each cursor to its immutable boundary, use a tuple comparison, and return a typed `400` error for an unknown ULID. Cover equal timestamps, exact page sizes, inserted rows, revoked rows, and unknown cursors.
- [x] API-009 Merge concurrent Angular token loads. Remove the revision-based response discard. Merge initial and subsequent pages by identifier while preserving local creation and revocation results. Preserve the server cursor and retry state. Cover creation during initial loading, pagination failures, retries, and duplicate suppression.
- [x] API-010 Prevent secret loss during token creation. Block Angular route deactivation while a creation request is pending. Require confirmation only after the one-time secret exists. Keep external navigation protection active. Cover pending creation, rejected navigation, secret acknowledgement, and component destruction.
- [x] API-011 Remove redundant token authorization surfaces. Delete `IntegrationTokens.authorize` and test the production sequence through `authenticate` followed by `authorizePermission`. Remove any wrapper that permits authentication, quota, and permission ordering to diverge.
- [x] API-012 Align integration-token failures and UI states. Include every typed request-policy failure in the internal API outcome schema. Keep initial-load errors distinct from an empty list. Clear stale clipboard errors after success. Cover creation, revocation, pagination, request-policy, and clipboard failures.
- [ ] API-013 Localize the OpenAPI reference. Move every API title, group description, operation summary, and operation description into `@froment/l10n`. Generate localized OpenAPI content for French and English without changing operation identifiers or schemas. Configure Scalar's `localization.locale` for its interface and serve the matching localized document. Cover both locales, fallback behavior, and the absence of hard-coded documentation prose in contracts.
- [ ] ARCH-001 Remove natural-language literals from application code. Move user-facing prose, API documentation, HTML metadata, operational labels, and runtime messages into `@froment/l10n`. Keep only stable codes, identifiers, protocol values, and typed machine data outside tests. Add a lint or generated consistency check that prevents new prose literals. Preserve immutable migration artifacts and replace their active runtime messages through corrective migrations using stable error codes.
