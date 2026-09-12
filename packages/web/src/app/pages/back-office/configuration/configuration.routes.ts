import { type Routes } from '@angular/router';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { permissionData, permissionsGuard } from '@backoffice/authentication-guards';

export const configurationRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./configuration-index').then((module) => module.ConfigurationIndex),
  },
  {
    path: 'company',
    canActivate: [permissionsGuard],
    data: permissionData('company.read'),
    loadComponent: () =>
      import('../company-settings/company-settings').then((module) => module.CompanySettingsPage),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'issuer',
    canActivate: [permissionsGuard],
    data: permissionData('issuer.read'),
    loadComponent: () =>
      import('../issuer-settings/issuer-settings').then((module) => module.IssuerSettings),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'conditions/new',
    canActivate: [permissionsGuard],
    data: permissionData('condition.manage'),
    loadComponent: () =>
      import('../quote-condition-presets/condition-editor').then(
        (module) => module.ConditionEditor,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'conditions/:presetId/edit',
    canActivate: [permissionsGuard],
    data: permissionData('condition.read', 'condition.manage'),
    loadComponent: () =>
      import('../quote-condition-presets/condition-editor').then(
        (module) => module.ConditionEditor,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'conditions',
    canActivate: [permissionsGuard],
    data: permissionData('condition.read'),
    loadComponent: () =>
      import('../quote-condition-presets/quote-condition-presets').then(
        (module) => module.QuoteConditionPresets,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'business-card',
    canActivate: [permissionsGuard],
    data: permissionData('issuer.read'),
    loadComponent: () =>
      import('../../business-card/business-card').then((module) => module.BusinessCard),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'supplier-invoice-analysis',
    canActivate: [permissionsGuard],
    data: permissionData('integration.configure'),
    loadComponent: () =>
      import('../supplier-invoice-analysis-settings/supplier-invoice-analysis-settings').then(
        (module) => module.SupplierInvoiceAnalysisSettingsPage,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
];
