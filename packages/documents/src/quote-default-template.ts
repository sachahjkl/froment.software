import '@angular/compiler';

import { ChangeDetectionStrategy, Component, InjectionToken, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { type QuoteRenderSnapshotValue } from '@froment/contracts';

import { formatMoney } from './format-money.js';

export const QUOTE_DEFAULT_TEMPLATE_ID = 'quote-default';
export const QUOTE_DEFAULT_TEMPLATE_VERSION = 2;

const QUOTE_SNAPSHOT = new InjectionToken<QuoteRenderSnapshotValue>('QUOTE_SNAPSHOT');

@Component({
  selector: 'froment-quote-document',
  templateUrl: './quote-default-template.html',
  styleUrl: './quote-default-template.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDefaultTemplate {
  protected readonly quote = inject(QUOTE_SNAPSHOT);

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

export const renderQuoteDefaultTemplate = (snapshot: QuoteRenderSnapshotValue): Promise<string> =>
  renderApplication(
    (context) =>
      bootstrapApplication(
        QuoteDefaultTemplate,
        {
          providers: [provideServerRendering(), { provide: QUOTE_SNAPSHOT, useValue: snapshot }],
        },
        context,
      ),
    {
      document:
        '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Devis</title></head><body><froment-quote-document></froment-quote-document></body></html>',
      url: 'https://documents.froment.software/quote',
      allowedHosts: ['documents.froment.software'],
    },
  );
