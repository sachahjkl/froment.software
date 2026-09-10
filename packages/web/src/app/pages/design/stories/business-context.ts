import { DestroyRef, Injectable, inject, signal, type Provider } from '@angular/core';
import { NavigationEnd, Router, type Event as RouterEvent } from '@angular/router';
import { Subject } from 'rxjs';
import type {
  ClientListValue, CurrentAccountValue, InvoiceListValue, OrderListValue, QuoteListValue,
} from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { referenceText } from '../reference-text';

export interface BusinessSettings {
  scenario: 'ready' | 'loading' | 'error' | 'empty';
  administrator: boolean;
  path: string;
  kind: 'quote' | 'invoice';
  party: 'both' | 'issuer' | 'client';
}

type PreviewRouter = Pick<Router,
  'url' | 'events' | 'currentNavigation' | 'createUrlTree' | 'serializeUrl' | 'navigateByUrl'
>;

@Injectable()
export class BusinessContext {
  readonly text = referenceText();
  readonly destination = signal('');
  readonly events = new Subject<RouterEvent>();
  private readonly loading = Promise.withResolvers<void>();
  private readonly destroyRef = inject(DestroyRef);
  private navigationId = 0;
  scenario: BusinessSettings['scenario'] = 'ready';
  administrator = true;
  url = '/backoffice/affaires';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.loading.resolve();
      this.events.complete();
    });
  }

  navigate(path: string): void {
    this.url = path;
    this.destination.set(path);
    this.events.next(new NavigationEnd(++this.navigationId, path, path));
  }

  complete(): void {
    this.scenario = 'ready';
    this.loading.resolve();
  }

  async currentAccount(): Promise<CurrentAccountValue | undefined> {
    if (this.scenario === 'loading') await this.loading.promise;
    if (this.scenario === 'error' || this.scenario === 'empty') return undefined;
    return {
      userId: this.text().examples.accountId,
      email: this.text().examples.email,
      mode: this.administrator ? 'admin' : 'client',
    };
  }

  private async read(): Promise<boolean> {
    if (this.scenario === 'loading') await this.loading.promise;
    if (this.scenario === 'error') throw new Error('reference.search_unavailable');
    return this.scenario !== 'empty' && !this.destroyRef.destroyed;
  }

  async clients(): Promise<ClientListValue> {
    if (!(await this.read())) return [];
    const example = this.text().examples;
    return [{
      id: example.clientId, displayName: example.firstName,
      addressLine1: example.address, addressLine2: '', postalCode: example.postalCode,
      city: example.city, country: example.country, email: example.email,
      archived: false, updatedAt: 0,
    }];
  }

  async quotes(): Promise<QuoteListValue> {
    if (!(await this.read())) return [];
    const example = this.text().examples;
    return [{
      id: example.quoteId, reference: example.quoteReference, clientId: example.clientId,
      clientDisplayName: example.firstName, status: 'draft', version: 1,
      title: this.text().content, currency: 'EUR', totalCents: 26600, updatedAt: example.datetime,
    }];
  }

  async orders(): Promise<OrderListValue> {
    if (!(await this.read())) return [];
    const example = this.text().examples;
    return [{
      id: example.orderId, reference: example.orderReference, quoteId: example.quoteId,
      quoteReference: example.quoteReference, revisionId: example.revisionId,
      clientId: example.clientId, clientDisplayName: example.firstName,
      title: this.text().content, currency: 'EUR', totalCents: 26600,
      createdAt: example.datetime, invoiceId: example.invoiceId,
    }];
  }

  async invoices(): Promise<InvoiceListValue> {
    if (!(await this.read())) return [];
    const example = this.text().examples;
    return [{
      creditedCents: 0, recordedPaidCents: 0, id: example.invoiceId,
      orderId: example.orderId, orderReference: example.orderReference,
      clientId: example.clientId, clientDisplayName: example.firstName,
      status: 'draft', version: 1, invoiceNumber: null, title: this.text().content,
      dueDate: example.date, currency: 'EUR', totalCents: 26600,
      updatedAt: example.datetime, pdf: null,
    }];
  }
}

export const businessProviders: Provider[] = [
  BusinessContext,
  {
    provide: Authentication,
    useFactory: (): Pick<Authentication, 'currentAccount'> => {
      const context = inject(BusinessContext);
      return { currentAccount: () => context.currentAccount() };
    },
  },
  {
    provide: ClientsApi,
    useFactory: (): Pick<ClientsApi, 'list'> => {
      const context = inject(BusinessContext);
      return { list: () => context.clients() };
    },
  },
  {
    provide: QuotesApi,
    useFactory: (): Pick<QuotesApi, 'list'> => {
      const context = inject(BusinessContext);
      return { list: () => context.quotes() };
    },
  },
  {
    provide: OrdersApi,
    useFactory: (): Pick<OrdersApi, 'list'> => {
      const context = inject(BusinessContext);
      return { list: () => context.orders() };
    },
  },
  {
    provide: InvoicesApi,
    useFactory: (): Pick<InvoicesApi, 'list'> => {
      const context = inject(BusinessContext);
      return { list: () => context.invoices() };
    },
  },
  {
    provide: Router,
    useFactory: (): PreviewRouter => {
      const router = inject(Router, { skipSelf: true });
      const context = inject(BusinessContext);
      return {
        get url() { return context.url; },
        events: context.events.asObservable(),
        currentNavigation: signal(null),
        createUrlTree: router.createUrlTree.bind(router),
        // Les liens ouverts dans un autre onglet restent dans la référence.
        serializeUrl: () => router.url,
        navigateByUrl: (url) => {
          context.navigate(typeof url === 'string' ? url : router.serializeUrl(url));
          return Promise.resolve(true);
        },
      };
    },
  },
];
