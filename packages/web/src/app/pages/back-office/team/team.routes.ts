import { type Routes } from '@angular/router';
import { administratorGuard } from '@backoffice/authentication-guards';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const teamRoutes: Routes = [
  {
    path: 'backoffice/equipe/invitations/new',
    loadComponent: () => import('./team-invitation').then((module) => module.TeamInvitation),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'configurationWorkspace.newInvitation', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/equipe',
    loadComponent: () => import('./team').then((module) => module.Team),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'team.title', robots: 'noindex, nofollow' },
  },
];
