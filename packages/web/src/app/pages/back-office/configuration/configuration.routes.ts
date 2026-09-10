import { type Routes } from '@angular/router';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const configurationRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./configuration-index').then((module) => module.ConfigurationIndex),
  },
  {
    path: 'entreprise',
    loadComponent: () =>
      import('../issuer-settings/issuer-settings').then((module) => module.IssuerSettings),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'conditions/new',
    loadComponent: () =>
      import('../quote-condition-presets/condition-editor').then(
        (module) => module.ConditionEditor,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'conditions/:presetId/edit',
    loadComponent: () =>
      import('../quote-condition-presets/condition-editor').then(
        (module) => module.ConditionEditor,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'conditions',
    loadComponent: () =>
      import('../quote-condition-presets/quote-condition-presets').then(
        (module) => module.QuoteConditionPresets,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'carte-de-visite',
    loadComponent: () =>
      import('../../business-card/business-card').then((module) => module.BusinessCard),
    canDeactivate: [unsavedChangesGuard],
  },
];
