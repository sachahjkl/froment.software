import { type Routes } from '@angular/router';
import { administratorGuard, permissionData } from '@backoffice/authentication-guards';

export const accountingRoutes: Routes = [
  {
    path: 'backoffice/accounting',
    loadComponent: () => import('./accounting').then((module) => module.Accounting),
    canActivate: [administratorGuard],
    data: {
      ...permissionData('accounting.read'),
      titleKey: 'accounting.title',
      robots: 'noindex, nofollow',
    },
  },
];
