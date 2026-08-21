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
- [ ] Add due dates, overdue states, and upcoming deadlines.
- [ ] Record a structured reason when a quote is cancelled.
- [ ] Offer client access creation after client reactivation.
- [ ] Add a business event journal to each affair.
- [ ] Add global search across clients and document references.
- [ ] Add bulk invoice reminders and document exports.
- [ ] Add an operational dashboard for pending and recent work.
