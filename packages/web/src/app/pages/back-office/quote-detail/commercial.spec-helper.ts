import { Component } from '@angular/core';
import { type Routes } from '@angular/router';
import { QuoteDetail, OrderSummary, DocumentArtifact } from '@froment/contracts';
import { Schema } from 'effect';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';
import { QuoteEditor } from '../quote-editor/quote-editor';
import { QuotePublication } from '../quote-publication/quote-publication';
import { OrderDetail } from '../order-detail/order-detail';
import { QuoteDetail as QuoteDetailPage } from './quote-detail';

const revision = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
  version: 2,
  previewAvailable: true,
  pdfAvailable: false,
  clientDisplayName: 'Acme',
  title: 'Audit',
  conditions: '',
  currency: 'EUR',
  netTotalCents: 1000,
  vatTotalCents: 200,
  totalCents: 1200,
  createdAt: '2026-08-20T06:00:00.000Z',
  createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  lines: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      position: 0,
      description: 'Audit',
      quantityMilli: 1000,
      unitPriceCents: 1000,
      vatRateBasisPoints: 2000,
      netTotalCents: 1000,
      vatTotalCents: 200,
      totalCents: 1200,
    },
  ],
};
export const quoteFixture = Schema.decodeUnknownSync(QuoteDetail)({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
  reference: 'DE-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status: 'draft',
  version: 2,
  currentRevision: revision,
  revisions: [
    { ...revision, id: '01ARZ3NDEKTSV4RRFFQ69G5FB0', version: 1, title: 'First version' },
    revision,
  ],
});
export const quoteId = quoteFixture.id;
export const orderFixture = Schema.decodeUnknownSync(OrderSummary)({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAD',
  reference: 'CO-2026-000001',
  quoteId,
  quoteReference: quoteFixture.reference,
  revisionId: quoteFixture.currentRevision.id,
  clientId: quoteFixture.clientId,
  clientDisplayName: 'Acme',
  title: 'Audit',
  currency: 'EUR',
  totalCents: 1200,
  createdAt: '2026-08-20T07:00:00.000Z',
  invoiceId: null,
  pdfAvailable: false,
});
export const artifactFixture = Schema.decodeUnknownSync(DocumentArtifact)({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
  quoteReference: quoteFixture.reference,
  revisionId: quoteFixture.currentRevision.id,
  kind: 'quote-pdf',
  contentType: 'application/pdf',
  byteSize: 100,
  sha256: 'a'.repeat(64),
  createdAt: '2026-08-20T07:00:00.000Z',
});

@Component({ template: '' })
export class CommercialDestination {}

export function detailTabs(panel: string, tabs: readonly string[]): Routes {
  return [
    { path: '', pathMatch: 'full', redirectTo: tabs[0] },
    ...tabs.map((tab) => ({ path: tab, component: TabPanelOutlet, data: { panel, tab } })),
  ];
}
export const commercialTestRoutes: Routes = [
  { path: 'backoffice/quotes/new', component: QuoteEditor, canDeactivate: [unsavedChangesGuard] },
  {
    path: 'backoffice/quotes/:quoteId/edit',
    component: QuoteEditor,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'backoffice/quotes/:quoteId/publication',
    component: QuotePublication,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'backoffice/quotes/:quoteId',
    component: QuoteDetailPage,
    canDeactivate: [unsavedChangesGuard],
    children: detailTabs('quote-detail', ['summary', 'document', 'versions']),
  },
  { path: 'backoffice/orders/:orderId', component: OrderDetail },
  { path: 'backoffice/affairs', component: CommercialDestination },
  { path: 'backoffice/invoices/new', component: CommercialDestination },
  { path: 'backoffice/invoices/:invoiceId', component: CommercialDestination },
];

export function control<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing control: ${selector}`);
  return element;
}
export function labelControl<T extends HTMLInputElement | HTMLSelectElement>(
  root: ParentNode,
  label: string,
): T {
  const wrapper = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith(label),
  );
  if (!wrapper) throw new Error(`Missing control label: ${label}`);
  return control<T>(wrapper, 'input, select');
}
export function inputValue(root: ParentNode, selector: string, value: string): void {
  const input = control<HTMLInputElement | HTMLTextAreaElement>(root, selector);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur'));
}
export function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
