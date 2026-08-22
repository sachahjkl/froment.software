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

## Integration API Greenfield Cleanup

- [ ] API-001 Enforce Origin from the selected authentication mode. Remove the global exemption based on any `Authorization` header. Require the configured Origin for browser mutations. Exempt only a Bearer credential selected by the integration middleware. Cover arbitrary, Basic, mixed, missing, and valid credentials through HTTP tests.
- [ ] API-002 Make global request errors match their contracts. Return typed `RequestInvalidOrigin` and `RequestTooLarge` errors through `HttpApiBuilder`, including `_tag` and `code`. Declare each error only on endpoints that can produce it. Cover fixed-length and chunked oversized bodies, then verify that the server remains available.
- [ ] API-003 Use one administrator authorization pipeline. Annotate internal and integration endpoints with their required permission set and mutation quota. Execute authentication, current owner permission checks, CSRF, and quotas in one middleware. Remove `authorizeAdministratorSession`, `authorizeAdministratorWrite`, and `Authentication.authorizeWrite`.
- [ ] API-004 Select Cookie and Bearer credentials without cross-decoding. Give each Effect security handler one credential type. Reject absent, malformed, and mixed credentials explicitly. Remove application calls to `HttpApiBuilder.securityDecode`. Test that each credential invokes exactly one security branch.
- [ ] API-005 Apply Bearer admission quotas before token HMAC and SQLite work. Consume an address quota before `IntegrationTokens.authenticate`, then consume the token quota before permission checks. Test the exact execution order with rejected and accepted requests.
- [ ] API-006 Define every permission once. Replace the separate general and integration literal lists with one permission registry containing integration and client-role metadata. Derive schemas, UI options, OpenAPI eligibility, and role expectations from this registry. Reject duplicate requested permissions in the contract schema.
- [ ] API-007 Enforce reusable token names in SQLite. Replace the removed global unique index with an indexed trigger that rejects a duplicate name only while an existing token remains unrevoked and unexpired at the new token creation time. Translate only this database constraint into `IntegrationTokenNameConflict`. Cover direct SQL writes, revocation, expiration, whitespace, and case policy.
- [ ] API-008 Index and validate token pagination. Add an index on `(created_at DESC, id DESC)`. Resolve each cursor to its immutable boundary, use a tuple comparison, and return a typed `400` error for an unknown ULID. Cover equal timestamps, exact page sizes, inserted rows, revoked rows, and unknown cursors.
- [ ] API-009 Merge concurrent Angular token loads. Remove the revision-based response discard. Merge initial and subsequent pages by identifier while preserving local creation and revocation results. Preserve the server cursor and retry state. Cover creation during initial loading, pagination failures, retries, and duplicate suppression.
- [ ] API-010 Prevent secret loss during token creation. Block Angular route deactivation while a creation request is pending. Require confirmation only after the one-time secret exists. Keep external navigation protection active. Cover pending creation, rejected navigation, secret acknowledgement, and component destruction.
- [ ] API-011 Remove redundant token authorization surfaces. Delete `IntegrationTokens.authorize` and test the production sequence through `authenticate` followed by `authorizePermission`. Remove any wrapper that permits authentication, quota, and permission ordering to diverge.
- [ ] API-012 Align integration-token failures and UI states. Include every typed request-policy failure in the internal API outcome schema. Keep initial-load errors distinct from an empty list. Clear stale clipboard errors after success. Cover creation, revocation, pagination, request-policy, and clipboard failures.
