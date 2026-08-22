import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { Search } from './search';

describe('Search', () => {
  it('shows and virtualizes all items when the query is empty', async () => {
    const clients = Array.from({ length: 75 }, (_, index) => ({
      id: `client-${index}`,
      displayName: `Client ${index}`,
      email: `client-${index}@example.test`,
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientsApi, useValue: { list: () => Promise.resolve(clients) } },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(Search);

    fixture.detectChanges();
    await fixture.componentInstance['load']();
    fixture.detectChanges();

    expect(fixture.componentInstance['results']()).toHaveLength(75);
    expect(fixture.nativeElement.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();
  });

  it('finds a typo and returns the matching text ranges', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ClientsApi,
          useValue: {
            list: () =>
              Promise.resolve([
                { id: 'client-1', displayName: 'Froment Software', email: 'hello@example.test' },
              ]),
          },
        },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(Search);
    await fixture.componentInstance['load']();

    fixture.componentInstance['query'].set('Fromant');

    expect(fixture.componentInstance['results']()).toMatchObject([
      {
        id: 'client-1',
        referenceMatches: [
          [0, 3],
          [5, 6],
        ],
      },
    ]);
  });
});
