import { type Routes } from '@angular/router';
import { administratorGuard, permissionData } from '@backoffice/authentication-guards';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const bankWorkspaceRoutes: Routes = [
  {
    path: 'backoffice/banking/import',
    loadComponent: () => import('../bank-import/bank-import').then((module) => module.BankImport),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      ...permissionData('bank.import'),
      titleKey: 'bank.import',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/banking/transactions/:transactionId',
    loadComponent: () =>
      import('../bank-reconciliation/bank-reconciliation').then(
        (module) => module.BankReconciliation,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      ...permissionData('bank.read'),
      titleKey: 'bankWorkspace.reconciliation',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/banking/ledger/post/:sourceKind/:sourceId',
    loadComponent: () => import('../ledger-post/ledger-post').then((module) => module.LedgerPost),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      ...permissionData('ledger.read', 'ledger.post'),
      titleKey: 'bankWorkspace.postTitle',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/banking/ledger/:entryId/reverse',
    loadComponent: () =>
      import('../ledger-reversal/ledger-reversal').then((module) => module.LedgerReversal),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      ...permissionData('ledger.read'),
      titleKey: 'bankWorkspace.reverseTitle',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/banking/ledger',
    loadComponent: () => import('../bank-ledger/bank-ledger').then((module) => module.BankLedger),
    canActivate: [administratorGuard],
    data: {
      ...permissionData('ledger.read'),
      titleKey: 'bankWorkspace.entries',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/banking',
    loadComponent: () => import('./banking').then((module) => module.Banking),
    canActivate: [administratorGuard],
    data: {
      ...permissionData('bank.read'),
      titleKey: 'bankWorkspace.transactions',
      robots: 'noindex, nofollow',
    },
  },
];
