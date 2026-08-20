import '@angular/compiler';

import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { type InvoiceRenderSnapshotValue } from '@froment/contracts';

import { formatMoney } from './format-money.js';

export const INVOICE_DEFAULT_TEMPLATE_ID = 'invoice-default';
export const INVOICE_DEFAULT_TEMPLATE_VERSION = 2;

const INVOICE_SNAPSHOT = new InjectionToken<InvoiceRenderSnapshotValue>('INVOICE_SNAPSHOT');

abstract class InvoiceTemplateBase {
  protected readonly invoice = inject(INVOICE_SNAPSHOT);

  protected money(cents: number): string {
    return formatMoney(cents, 'fr-FR', 'EUR');
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

@Component({
  selector: 'froment-invoice-document-v1',
  templateUrl: './invoice-default-template-v1.html',
  styleUrl: './quote-default-template.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class InvoiceDefaultTemplateV1 extends InvoiceTemplateBase {}

@Component({
  selector: 'froment-invoice-document',
  templateUrl: './invoice-default-template.html',
  styleUrl: './invoice-default-template.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class InvoiceDefaultTemplate extends InvoiceTemplateBase {}

export const renderInvoiceDefaultTemplate = (
  snapshot: InvoiceRenderSnapshotValue,
): Promise<string> => {
  const component =
    snapshot.templateVersion === 1 ? InvoiceDefaultTemplateV1 : InvoiceDefaultTemplate;
  const selector =
    snapshot.templateVersion === 1 ? 'froment-invoice-document-v1' : 'froment-invoice-document';
  return renderApplication(
    (context) =>
      bootstrapApplication(
        component,
        {
          providers: [provideServerRendering(), { provide: INVOICE_SNAPSHOT, useValue: snapshot }],
        },
        context,
      ),
    {
      document: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Facture</title></head><body><${selector}></${selector}></body></html>`,
      url: 'https://documents.froment.software/invoice',
      allowedHosts: ['documents.froment.software'],
    },
  );
};
