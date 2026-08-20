import '@angular/compiler';

import { ChangeDetectionStrategy, Component, InjectionToken, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { type InvoiceRenderSnapshotValue } from '@froment/contracts';

export const INVOICE_DEFAULT_TEMPLATE_ID = 'invoice-default';
export const INVOICE_DEFAULT_TEMPLATE_VERSION = 1;

const INVOICE_SNAPSHOT = new InjectionToken<InvoiceRenderSnapshotValue>('INVOICE_SNAPSHOT');

@Component({
  selector: 'froment-invoice-document',
  templateUrl: './invoice-default-template.html',
  styleUrl: './quote-default-template.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDefaultTemplate {
  protected readonly invoice = inject(INVOICE_SNAPSHOT);

  protected money(cents: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
      cents / 100,
    );
  }

  protected quantity(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value / 1_000);
  }

  protected percent(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value / 100);
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(value),
    );
  }
}

export const renderInvoiceDefaultTemplate = (
  snapshot: InvoiceRenderSnapshotValue,
): Promise<string> =>
  renderApplication(
    (context) =>
      bootstrapApplication(
        InvoiceDefaultTemplate,
        {
          providers: [provideServerRendering(), { provide: INVOICE_SNAPSHOT, useValue: snapshot }],
        },
        context,
      ),
    {
      document:
        '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Facture</title></head><body><froment-invoice-document></froment-invoice-document></body></html>',
      url: 'https://documents.froment.software/invoice',
      allowedHosts: ['documents.froment.software'],
    },
  );
