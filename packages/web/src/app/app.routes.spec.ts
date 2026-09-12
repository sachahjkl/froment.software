import { type Routes } from '@angular/router';
import { routes } from './app.routes';
import {
  administratorGuard,
  administratorChildGuard,
  clientGuard,
} from './back-office/authentication-guards';
import { unsavedChangesGuard } from './back-office/unsaved-changes-guard';

const fullPaths = (entries: Routes, parent = ''): string[] =>
  entries.flatMap((route) => {
    const path = [parent, route.path].filter(Boolean).join('/');
    return [path, ...fullPaths(route.children ?? [], path)];
  });

describe('back-office route organization', () => {
  it('declares session-only account and configuration routes with child checks', () => {
    for (const path of ['backoffice/account', 'backoffice/configuration']) {
      const route = routes.find((entry) => entry.path === path);
      expect(route?.data?.['access']).toBe('session');
      expect(route?.data?.['permissions']).toBeUndefined();
      expect(route?.canActivateChild).toContain(administratorChildGuard);
    }
  });
  it('aligns provider test routes with their API permissions', () => {
    for (const suffix of ['', '/new', '/:requestId']) {
      expect(
        routes.find((entry) => entry.path === `backoffice/services/resend/tests${suffix}`)?.data?.[
          'permissions'
        ],
      ).toEqual(['integration.configure']);
      expect(
        routes.find((entry) => entry.path === `backoffice/services/stripe/tests${suffix}`)?.data?.[
          'permissions'
        ],
      ).toEqual(['integration.configure', 'invoice.read']);
    }
  });
  it('declares public invitation and authenticated shells in route data', () => {
    expect(routes.find((route) => route.path === 'backoffice/join')?.data?.['shell']).toBe(
      'public',
    );
    for (const route of routes) {
      if (route.canActivate?.includes(administratorGuard))
        expect(route.data?.['shell'], route.path).toBe('administrator');
      if (route.canActivate?.includes(clientGuard))
        expect(route.data?.['shell'], route.path).toBe('client');
    }
  });

  it.each([
    ['backoffice/clients/new', 'client.create'],
    ['backoffice/clients/:clientId/edit', 'client.update'],
    ['backoffice/suppliers/new', 'supplier.create'],
    ['backoffice/suppliers/:supplierId/edit', 'supplier.update'],
    ['backoffice/purchases/new', 'supplier-invoice.create'],
    ['backoffice/purchases/:invoiceId/edit', 'supplier-invoice.update'],
    ['backoffice/quotes/new', 'quote.create'],
    ['backoffice/quotes/:quoteId/publication', 'quote.send'],
    ['backoffice/invoices/new', 'invoice.create'],
    ['backoffice/invoices/:invoiceId/payments/new', 'invoice.mark-paid'],
    ['backoffice/team/invitations/new', 'user.create'],
  ])('declares the write permission for %s', (path, permission) => {
    const route = routes.find((entry) => entry.path === path);
    expect(route?.canActivate).toContain(administratorGuard);
    expect(route?.data?.['permissions']).toContain(permission);
  });
  it('keeps administrative subjects separate from company configuration', () => {
    const paths = fullPaths(routes);
    for (const subject of ['team', 'api', 'services', 'audit', 'configuration']) {
      const route = routes.find((entry) => entry.path === `backoffice/${subject}`);
      expect(route, subject).toBeDefined();
      expect(route?.canActivate, subject).toContain(administratorGuard);
    }
    expect(
      paths.some((path) =>
        /^backoffice\/configuration\/(equipe|api|services|audit)(\/|$)/.test(path),
      ),
    ).toBe(false);
    expect(paths).toContain('backoffice/configuration/conditions/:presetId/edit');
    expect(paths).toContain('backoffice/configuration/business-card');
    expect(paths).not.toContain('backoffice/configuration/identite');
  });

  it('keeps document detail pages distinct from guarded tasks', () => {
    for (const path of [
      'backoffice/quotes/:quoteId/edit',
      'backoffice/quotes/:quoteId/publication',
      'backoffice/invoices/:invoiceId/edit',
      'backoffice/purchases/:invoiceId/edit',
      'backoffice/invoices/:invoiceId/issue',
      'backoffice/invoices/:invoiceId/payments/new',
      'backoffice/invoices/:invoiceId/credits/new',
      'backoffice/invoices/:invoiceId/refunds/new',
      'backoffice/emails/new',
      'backoffice/emails/reminders/new',
    ]) {
      const route = routes.find((entry) => entry.path === path);
      expect(route?.canActivate, path).toContain(administratorGuard);
      expect(route?.canDeactivate, path).toContain(unsavedChangesGuard);
    }
    for (const path of [
      'backoffice/quotes/:quoteId',
      'backoffice/invoices/:invoiceId',
      'backoffice/orders/:orderId',
    ]) {
      expect(routes.find((entry) => entry.path === path)?.loadComponent, path).toBeDefined();
    }
  });

  it('keeps customer pages protected separately and public signature exits guarded', () => {
    for (const path of [
      'backoffice/client',
      'backoffice/client/account',
      'backoffice/client/documents/:kind/:documentId',
    ]) {
      expect(routes.find((entry) => entry.path === path)?.canActivate, path).toContain(clientGuard);
    }
    expect(routes.find((entry) => entry.path === 'quote')?.canDeactivate).toContain(
      unsavedChangesGuard,
    );
  });

  it('defines each top-level path once', () => {
    const paths = routes.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('uses English route segments', () => {
    const forbidden = new Set([
      'affaires',
      'avoirs',
      'banque',
      'carte-de-visite',
      'catalogue',
      'comptabiliser',
      'contrepasser',
      'courriels',
      'ecritures',
      'encaissements',
      'entreprise',
      'equipe',
      'facturation',
      'fournisseurs',
      'importer',
      'remboursements',
      'societe',
    ]);
    for (const path of fullPaths(routes)) {
      for (const segment of path.split('/')) expect(forbidden.has(segment), path).toBe(false);
    }
  });
});
