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
import { type OrderRenderSnapshotValue } from '@froment/contracts';

import { formatMoney } from './format-money.js';

export const ORDER_DEFAULT_TEMPLATE_ID = 'order-default';
export const ORDER_DEFAULT_TEMPLATE_VERSION = 1;

const ORDER_SNAPSHOT = new InjectionToken<OrderRenderSnapshotValue>('ORDER_SNAPSHOT');

@Component({
  selector: 'froment-order-document',
  templateUrl: './order-default-template.html',
  styleUrl: './order-default-template.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OrderDefaultTemplate {
  protected readonly order = inject(ORDER_SNAPSHOT);

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

export const renderOrderDefaultTemplate = (snapshot: OrderRenderSnapshotValue): Promise<string> =>
  renderApplication(
    (context) =>
      bootstrapApplication(
        OrderDefaultTemplate,
        { providers: [provideServerRendering(), { provide: ORDER_SNAPSHOT, useValue: snapshot }] },
        context,
      ),
    {
      document:
        '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirmation de commande</title></head><body><froment-order-document></froment-order-document></body></html>',
      url: 'https://documents.froment.software/order',
      allowedHosts: ['documents.froment.software'],
    },
  );
