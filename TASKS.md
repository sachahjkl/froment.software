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

- [x] PDF-001 Replace Angular, Playwright, and Chromium document rendering with local Typst compilation. Complete every requirement below before removing the current renderer.

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
- Replace the current template implementations in place.

### Greenfield Replacement

- Replace the current renderer and templates directly.
- Do not add a compatibility renderer, data migration, or dual-engine deployment.
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

## API Greenfield Cleanup

- [x] API-001 Enforce Origin from the selected authentication mode. Remove the global exemption based on any `Authorization` header. Require the configured Origin for browser mutations. Exempt only a Bearer credential selected by the API-token middleware. Cover arbitrary, Basic, mixed, missing, and valid credentials through HTTP tests.
- [x] API-002 Make global request errors match their contracts. Return typed `RequestInvalidOrigin` and `RequestTooLarge` errors through `HttpApiBuilder`, including `_tag` and `code`. Declare each error only on endpoints that can produce it. Cover fixed-length and chunked oversized bodies, then verify that the server remains available.
- [x] API-003 Use one administrator authorization pipeline. Annotate frontend and API-token endpoints with their required permission set and mutation quota. Execute authentication, current owner permission checks, CSRF, and quotas in one middleware. Remove `authorizeAdministratorSession`, `authorizeAdministratorWrite`, and `Authentication.authorizeWrite`.
- [x] API-004 Select Cookie and Bearer credentials without cross-decoding. Give each Effect security handler one credential type. Reject absent, malformed, and mixed credentials explicitly. Remove application calls to `HttpApiBuilder.securityDecode`. Test that each credential invokes exactly one security branch.
- [x] API-005 Apply Bearer admission quotas before token HMAC and SQLite work. Consume an address quota before `ApiTokens.authenticate`, then consume the token quota before permission checks. Test the exact execution order with rejected and accepted requests.
- [x] API-006 Define every permission once. Replace the separate general and API-token literal lists with one permission registry containing API-token and client-role metadata. Derive schemas, UI options, OpenAPI eligibility, and role expectations from this registry. Reject duplicate requested permissions in the contract schema.
- [x] API-007 Enforce reusable token names in SQLite. Replace the removed global unique index with an indexed trigger that rejects a duplicate name only while an existing token remains unrevoked and unexpired at the new token creation time. Translate only this database constraint into `ApiTokenNameConflict`. Cover direct SQL writes, revocation, expiration, whitespace, and case policy.
- [x] API-008 Index and validate token pagination. Add an index on `(created_at DESC, id DESC)`. Resolve each cursor to its immutable boundary, use a tuple comparison, and return a typed `400` error for an unknown ULID. Cover equal timestamps, exact page sizes, inserted rows, revoked rows, and unknown cursors.
- [x] API-009 Merge concurrent Angular token loads. Remove the revision-based response discard. Merge initial and subsequent pages by identifier while preserving local creation and revocation results. Preserve the server cursor and retry state. Cover creation during initial loading, pagination failures, retries, and duplicate suppression.
- [x] API-010 Prevent secret loss during token creation. Block Angular route deactivation while a creation request is pending. Require confirmation only after the one-time secret exists. Keep external navigation protection active. Cover pending creation, rejected navigation, secret acknowledgement, and component destruction.
- [x] API-011 Remove redundant token authorization surfaces. Delete `ApiTokens.authorize` and test the production sequence through `authenticate` followed by `authorizePermission`. Remove any wrapper that permits authentication, quota, and permission ordering to diverge.
- [x] API-012 Align API-token failures and UI states. Include every typed request-policy failure in the frontend API outcome schema. Keep initial-load errors distinct from an empty list. Clear stale clipboard errors after success. Cover creation, revocation, pagination, request-policy, and clipboard failures.
- [x] API-013 Localize the OpenAPI reference. Move every API title, group description, operation summary, and operation description into `@froment/l10n`. Generate localized OpenAPI content for French and English without changing operation identifiers or schemas. Configure Scalar's `localization.locale` for its interface and serve the matching localized document. Cover both locales, fallback behavior, and the absence of hard-coded documentation prose in contracts.

## API Documentation And Account Authentication

### Target Architecture

- Keep one `Api` contract containing every server route.
- Keep API contracts independent from natural-language documentation and `@froment/l10n`.
- Generate French and English OpenAPI documents in `@froment/api` by joining `Api` with `apiDocumentation`.
- Keep business tags on every operation. Add the localized `Frontend` tag to routes used only by the Froment frontend.
- Authenticate browser API requests with short-lived PASETO `v4.public` access tokens in the `Authorization: Bearer` header.
- Keep access tokens in frontend memory. Do not store access tokens in cookies, `localStorage`, or `sessionStorage`.
- Use opaque rotating refresh tokens in one `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/auth`.
- Use email and password for administrator and client login. Keep API tokens as separate bearer credentials.
- Store only password hashes and refresh-token HMACs. Never persist or log plaintext credentials.

### Documentation

- [x] API-014 Move API documentation composition into `@froment/api`. Keep `applyApiDocumentation` private, pass one locale dictionary into it, and expose only `apiForLanguage`. Make `@froment/l10n` a runtime dependency of `@froment/api`. Remove the `@froment/contracts` dependency on `@froment/l10n`. Move localization behavior and translation-coverage tests beside the adapter.
- [x] API-015 Document every route in one OpenAPI specification. Replace `frontendSpecific` exclusion with an additive `frontend` tag while preserving each business tag. Add localized `Frontend` group prose. Require exact French and English keys for every group and operation, including frontend routes. Verify that Scalar displays both tags and no operation disappears.
- [x] API-016 Remove integration terminology from active code and documentation. Rename integration tokens to API tokens across identifiers, permission codes, routes, database objects, contracts, services, UI, tests, titles, and prose. Use `/api/tokens` for management routes and `api-token.manage` for their permission. Keep immutable migrations unchanged. Verify that active source files contain no remaining integration terminology.

### Account Data

- [x] AUTH-001 Replace access identifiers with password credentials. Add a one-to-one password credential for a user with a canonical email, an Argon2id password hash, creation time, update time, and password-change time. Enforce case-insensitive email uniqueness in SQLite. Keep contact data separate from login credentials. Remove `access_credentials` and every access-identifier contract, service, route, UI, and test.
- [x] AUTH-002 Replace the authentication model without a compatibility path. Drop legacy sessions and access credentials. Remove their routes, configuration, contracts, and UI in the same change. Require a fresh administrator bootstrap and new client portal credentials. Preserve business records only. Do not convert, claim, or accept legacy authentication data.
- [x] AUTH-003 Require an email when client portal access is enabled. Let an administrator set or replace the client login email and initial password through one account-management operation. Keep ordinary client records valid without portal access. Reject duplicate canonical emails and weak passwords with typed errors. Revoke all client refresh sessions after email, password, archival, or access-state changes.

### PASETO Access Tokens

- [x] AUTH-004 Add a focused PASETO service using a maintained PASETO v4 library. Use `v4.public` with Ed25519 keys encoded as PASERK. Load and validate the secret key through Effect `Config`. Derive or configure the matching public key without exposing the secret key. Do not implement cryptographic primitives in this repository.
- [x] AUTH-005 Define and validate one access-token payload with Effect Schema. Include `sub`, refresh-session identifier, account kind, `type: access`, `iss`, `aud`, `iat`, and `exp`. Exclude passwords, email addresses, permissions, and other personal data. Use a ten-minute lifetime and a small explicit clock tolerance. Reject wrong versions, purposes, issuers, audiences, timestamps, signatures, and malformed payloads.
- [x] AUTH-006 Replace browser session-cookie authentication with PASETO bearer authentication. Select PASETO tokens by their `v4.public.` prefix and keep API-token selection explicit. Reject malformed, unknown, and mixed credentials. Load current roles and permissions from SQLite after token validation so authorization changes take effect immediately. Remove `sessionCookie` from normal route security and OpenAPI documentation.

### Refresh Sessions

- [x] AUTH-007 Replace legacy sessions with refresh sessions. Store a session identifier, family identifier, user identifier, refresh-token HMAC, creation time, rotation time, absolute expiry, consumption time, and revocation time. Index active token lookup, user revocation, family revocation, and expiry cleanup. Use a cryptographically random 256-bit refresh token and a dedicated HMAC key.
- [x] AUTH-008 Implement transactional refresh-token rotation. Consume each token once, create its replacement, issue a new access token, and replace the cookie in one successful flow. Detect replay and revoke the complete token family. Permit a short bounded concurrency grace period so simultaneous browser tabs do not revoke a valid family. Test exact replay behavior, concurrent refreshes, expiration, disabled users, password changes, and database rollback.
- [x] AUTH-009 Restrict the refresh cookie to authentication routes. Set `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`, and an explicit expiry. Require the configured browser Origin for refresh and logout because the browser sends this cookie automatically. Clear the cookie after rejection, logout, expiry, and family revocation. Never accept the refresh cookie as authentication for business routes.

### Authentication Flows

- [x] AUTH-010 Replace login with email and password. Normalize the email before lookup, verify Argon2id hashes with constant-work failure behavior, apply address and account rate limits, and return one generic invalid-credentials error. On success, create a refresh family, set its cookie, and return the PASETO access token with its expiry and account kind. Record stable audit events without email, password, or token values.
- [x] AUTH-011 Replace bootstrap input with bootstrap password, administrator email, and administrator password. Verify the configured bootstrap password, validate the account password policy, and create or claim the administrator account transactionally. Return an access token and refresh cookie through the normal token issuer. Disable bootstrap after the administrator password credential exists. Cover duplicate submissions, concurrent bootstrap, invalid email, weak password, rate limits, and rollback.
- [x] AUTH-012 Replace session status and logout semantics. Add an authenticated current-account endpoint for frontend initialization. Make logout revoke the current refresh family and clear its cookie. Add an administrator action to revoke all sessions for one account. Accept that an already issued access token remains usable for at most ten minutes unless the normal authorization lookup finds a disabled account.

### Frontend

- [x] AUTH-013 Add an Angular access-token store that keeps the PASETO token only in memory. Add one HTTP interceptor that attaches it to API requests, performs one shared refresh after an authentication failure, retries the original request once, and prevents refresh loops. Exclude login, bootstrap, refresh, public routes, and API-token use from automatic attachment.
- [x] AUTH-014 Restore authentication after navigation and page reload through the refresh endpoint. Merge concurrent initialization and refresh requests within one tab. Handle another tab rotating the cookie without revoking the family. Clear local authentication state after refresh rejection. Preserve administrator and client route guards and their return URLs.
- [x] AUTH-015 Replace the shared access-identifier login form with email and password fields. Use standard `email`, `current-password`, and `new-password` autocomplete values for password managers. Add bootstrap administrator email and password fields. Add client portal credential management to the client editor. Localize validation, errors, account state, password replacement, and logout outcomes in French and English.

### Removal And Verification

- [x] AUTH-016 Remove legacy cookie-session and CSRF infrastructure after bearer migration. Delete session-cookie security, CSRF cookies and headers, access-identifier generation, obsolete configuration, old database tables, and dead translations. Keep Origin checks for refresh, logout, login, bootstrap, and other cookie or browser-sensitive mutations. Keep request-body limits and rate limits as independent policies.
- [ ] AUTH-017 Verify the complete authentication boundary. Cover administrator and client login, bootstrap, refresh rotation, replay, logout, account disablement, permission changes, client archival, password replacement, mixed credentials, API tokens, concurrent tabs, page reloads, redaction, OpenAPI security, and both Scalar locales. Run migration tests, all package tests, lint, formatting, builds, `nix flake check`, and production startup smoke tests.

- [ ] ARCH-001 Remove natural-language literals from application code. Move user-facing prose, API documentation, HTML metadata, operational labels, and runtime messages into `@froment/l10n`. Keep only stable codes, identifiers, protocol values, and typed machine data outside tests. Add a lint or generated consistency check that prevents new prose literals. Preserve immutable migration artifacts and replace their active runtime messages through corrective migrations using stable error codes.
