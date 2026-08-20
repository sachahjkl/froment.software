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
