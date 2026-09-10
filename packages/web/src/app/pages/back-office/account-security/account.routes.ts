import { type Routes } from '@angular/router';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const accountRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'security' },
  {
    path: 'security',
    loadComponent: () => import('./account-security').then((module) => module.AccountSecurity),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'passkeys',
    loadComponent: () => import('./account-passkeys').then((module) => module.AccountPasskeys),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'sessions',
    loadComponent: () => import('./account-sessions').then((module) => module.AccountSessions),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'preferences',
    loadComponent: () =>
      import('./account-preferences').then((module) => module.AccountPreferences),
    canDeactivate: [unsavedChangesGuard],
  },
];
