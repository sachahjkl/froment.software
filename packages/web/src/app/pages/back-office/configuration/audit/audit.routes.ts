import { type Route } from '@angular/router';
import { administratorGuard } from '@backoffice/authentication-guards';

export const auditRoute: Route = {
  path: 'backoffice/audit',
  loadComponent: () => import('./audit').then((module) => module.Audit),
  canActivate: [administratorGuard],
  data: { titleKey: 'audit.title', robots: 'noindex, nofollow' },
};
