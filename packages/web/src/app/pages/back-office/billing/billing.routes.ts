import { type Routes } from '@angular/router';
import { administratorGuard } from '@backoffice/authentication-guards';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

export const billingRoutes: Routes = [
  {
    path: 'backoffice/facturation',
    pathMatch: 'full',
    loadComponent: () => import('./billing').then((m) => m.Billing),
    canActivate: [administratorGuard],
    data: { titleKey: 'billingWorkspace.invoices', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/facturation/encaissements',
    loadComponent: () => import('../receipt-list/receipt-list').then((m) => m.ReceiptList),
    canActivate: [administratorGuard],
    data: { titleKey: 'billingWorkspace.receipts', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/facturation/avoirs',
    loadComponent: () => import('../credit-notes/credit-notes').then((m) => m.CreditNotes),
    canActivate: [administratorGuard],
    data: { titleKey: 'billingWorkspace.credits', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/facturation/remboursements',
    loadComponent: () => import('../refund-list/refund-list').then((m) => m.RefundList),
    canActivate: [administratorGuard],
    data: { titleKey: 'billingWorkspace.refunds', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/new',
    loadComponent: () => import('../invoice-editor/invoice-editor').then((m) => m.InvoiceEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'backOffice.invoice.title.new', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/edit',
    loadComponent: () => import('../invoice-editor/invoice-editor').then((m) => m.InvoiceEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'billingWorkspace.edit', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/issue',
    loadComponent: () => import('../invoice-issue/invoice-issue').then((m) => m.InvoiceIssue),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'billingWorkspace.issueTitle', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/payments/new',
    loadComponent: () => import('../payment-editor/payment-editor').then((m) => m.PaymentEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'billingWorkspace.recordReceipt', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/payments/:paymentId/cancel',
    loadComponent: () => import('../receipt-cancel/receipt-cancel').then((m) => m.ReceiptCancel),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'payment.cancel', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/credits/new',
    loadComponent: () => import('../credit-editor/credit-editor').then((m) => m.CreditEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'credit.issue', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/refunds/new',
    loadComponent: () => import('../refund-editor/refund-editor').then((m) => m.RefundEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'credit.recordRefund', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/refunds/:refundId/cancel',
    loadComponent: () => import('../refund-cancel/refund-cancel').then((m) => m.RefundCancel),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'credit.cancelRefund', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/void',
    loadComponent: () => import('../invoice-void/invoice-void').then((m) => m.InvoiceVoid),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'backOffice.invoice.void', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId',
    loadComponent: () => import('../invoice-detail/invoice-detail').then((m) => m.InvoiceDetail),
    canActivate: [administratorGuard],
    data: { titleKey: 'billingWorkspace.invoices', robots: 'noindex, nofollow' },
  },
];
