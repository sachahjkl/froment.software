import { type Routes } from '@angular/router';
import { administratorGuard } from '@backoffice/authentication-guards';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const serviceRoutes: Routes = [
  {
    path: 'backoffice/services',
    pathMatch: 'full',
    loadComponent: () => import('./connections').then((module) => module.Connections),
    canActivate: [administratorGuard],
    data: { titleKey: 'connections.title', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/simulations',
    loadComponent: () =>
      import('../integrations/integrations').then((module) => module.Integrations),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'configurationWorkspace.simulations', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/resend/tests/new',
    loadComponent: () => import('../email-test/email-test').then((module) => module.EmailTest),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'configurationWorkspace.newTest', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/resend/tests/:requestId',
    loadComponent: () =>
      import('../email-test/email-test-detail').then((module) => module.EmailTestDetail),
    canActivate: [administratorGuard],
    data: { titleKey: 'configurationWorkspace.testDetail', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/resend/tests',
    loadComponent: () =>
      import('../email-test/email-test-list').then((module) => module.EmailTestList),
    canActivate: [administratorGuard],
    data: { titleKey: 'configurationWorkspace.tests', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/stripe/tests/new',
    loadComponent: () => import('../checkout/checkout').then((module) => module.Checkout),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'configurationWorkspace.newTest', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/stripe/tests/:requestId',
    loadComponent: () =>
      import('../checkout/checkout-detail').then((module) => module.CheckoutDetail),
    canActivate: [administratorGuard],
    data: { titleKey: 'configurationWorkspace.testDetail', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/services/stripe/tests',
    loadComponent: () => import('../checkout/checkout-list').then((module) => module.CheckoutList),
    canActivate: [administratorGuard],
    data: { titleKey: 'configurationWorkspace.tests', robots: 'noindex, nofollow' },
  },
  ...['resend', 'stripe', 'signwell', 'superpdp'].map((provider) => ({
    path: `backoffice/services/${provider}`,
    data: { provider, titleKey: 'configurationWorkspace.connection', robots: 'noindex, nofollow' },
    loadComponent: () =>
      import('./provider-connection').then((module) => module.ProviderConnection),
    canActivate: [administratorGuard],
  })),
];
