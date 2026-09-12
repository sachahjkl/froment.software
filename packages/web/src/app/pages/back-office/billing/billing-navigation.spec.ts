import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { billingDetailQuery, billingListQuery, BillingNavigation } from './billing-navigation';

const client = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const cases = [
  { source: 'invoices', path: '/backoffice/billing', sort: 'total-desc', status: 'issued' },
  {
    source: 'receipts',
    path: '/backoffice/billing/receipts',
    sort: 'method-asc',
    status: 'active',
  },
  {
    source: 'credits',
    path: '/backoffice/billing/credit-notes',
    sort: 'amount-desc',
    status: undefined,
  },
  {
    source: 'refunds',
    path: '/backoffice/billing/refunds',
    sort: 'date-asc',
    status: 'cancelled',
  },
] as const;

function navigation(query: Record<string, string | undefined>) {
  const params = new BehaviorSubject(convertToParamMap(query));
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: params.value },
          queryParamMap: params,
        },
      },
    ],
  });
  const value = TestBed.runInInjectionContext(
    () => new BillingNavigation(TestBed.inject(ActivatedRoute)),
  );
  return { value, params };
}

describe('Billing navigation', () => {
  it.each(cases)(
    'restores the allowed $source list context after detail and task navigation',
    ({ source, path, sort, status }) => {
      const filters = { q: 'Équipe', client, from: '2026-08-01', to: '2026-08-31', sort, status };
      const detail = billingDetailQuery(
        source,
        convertToParamMap({ ...filters, returnUrl: '//outside.example', view: 'all' }),
        'receipts',
      );
      const { value, params } = navigation({ ...detail });
      expect(value.listLink()).toBe(path);
      expect(value.listQuery()).toEqual(filters);
      expect(value.detailQuery()).toEqual(detail);
      params.next(convertToParamMap({ ...detail, tab: 'history', unknown: 'ignored' }));
      expect(value.detailQuery()).toEqual({ ...detail, tab: 'history' });
      expect(value.listQuery()).toEqual(filters);
      expect(value.detailQuery()).not.toHaveProperty('returnUrl');
      expect(value.detailQuery()).not.toHaveProperty('view');
      expect(value.listQuery()).not.toHaveProperty('tab');
    },
  );

  it('bounds the search and rejects invalid or unrelated filter values', () => {
    expect(
      billingListQuery(
        'invoices',
        convertToParamMap({
          q: 'x'.repeat(300),
          client: '../clients',
          status: 'paid',
          due: 'tomorrow',
          credit: 'all',
          from: '2026-02-30',
          to: '2026-13-01',
          sort: 'amount-desc',
          returnUrl: 'https://outside.example',
        }),
      ),
    ).toEqual({ q: 'x'.repeat(160) });
    expect(
      billingListQuery(
        'credits',
        convertToParamMap({ status: 'active', due: 'overdue', credit: 'with', sort: 'method-asc' }),
      ),
    ).toEqual({});
    expect(
      billingListQuery(
        'invoices',
        convertToParamMap({ status: 'issued', due: 'overdue', credit: 'without' }),
      ),
    ).toEqual({ status: 'issued', due: 'overdue', credit: 'without' });
  });

  it('does not treat client or affair parameters as billing filters', () => {
    const { value } = navigation({
      billingList: 'receipts',
      billingQ: 'Receipt',
      billingClient: client,
      billingSort: 'date-desc',
      q: 'Affair',
      client: 'another-client',
      view: 'all',
      sort: 'amount-asc',
      tab: 'credit',
    });
    expect(value.listQuery()).toEqual({ q: 'Receipt', client, sort: 'date-desc' });
    expect(value.detailQuery()).toEqual({
      billingList: 'receipts',
      billingQ: 'Receipt',
      billingClient: client,
      billingSort: 'date-desc',
      tab: 'credit',
    });
  });

  it('uses the fixed invoice list when the source is absent or invalid', () => {
    const { value, params } = navigation({
      billingList: '//outside.example',
      billingQ: 'ignored',
      tab: 'outside',
    });
    expect(value.listLink()).toBe('/backoffice/billing');
    expect(value.listQuery()).toEqual({});
    expect(value.detailQuery()).toEqual({});
    params.next(convertToParamMap({ tab: 'document' }));
    expect(value.detailQuery()).toEqual({ tab: 'document' });
  });
});
