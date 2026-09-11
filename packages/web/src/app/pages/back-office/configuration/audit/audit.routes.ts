import { type Route } from '@angular/router';
import { administratorGuard, permissionData } from '@backoffice/authentication-guards';

export const auditRoute: Route = {
  path: 'backoffice/audit',
  loadComponent: () => import('./audit').then((module) => module.Audit),
  canActivate: [administratorGuard],
  data: { ...permissionData('audit.read'), titleKey: 'audit.title', robots: 'noindex, nofollow' },
};
