import { type Routes } from '@angular/router';
import { administratorGuard, permissionData } from '@backoffice/authentication-guards';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const apiTokenRoutes: Routes = [
  {
    path: 'backoffice/api/new',
    loadComponent: () => import('./api-token-editor').then((module) => module.ApiTokenEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      ...permissionData('api-token.manage'),
      titleKey: 'backOffice.apiTokens.create',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/api',
    loadComponent: () => import('./api-tokens').then((module) => module.ApiTokens),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      ...permissionData('api-token.manage'),
      titleKey: 'backOffice.apiTokens.title',
      robots: 'noindex, nofollow',
    },
  },
];
