import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, convertToParamMap, type ParamMap } from '@angular/router';
import { Ulid } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { type BillingSort, readBillingSort } from './billing-list';
import { readBillingPeriod } from './billing-period';
import { invoiceSortColumns } from './billing-state';
import { creditSortColumns, receiptSortColumns, refundSortColumns } from './entry-list';

const BillingList = Schema.Literals(['invoices', 'receipts', 'credits', 'refunds']);
export type BillingList = typeof BillingList.Type;
const InvoiceTab = Schema.Literals(['summary', 'document', 'receipts', 'credit', 'history']);
export type InvoiceTab = typeof InvoiceTab.Type;
const InvoiceStatus = Schema.Literals(['draft', 'issued', 'void']);
const EntryStatus = Schema.Literals(['active', 'cancelled']);
const DueFilter = Schema.Literals(['overdue', 'upcoming']);
const CreditFilter = Schema.Literals(['with', 'without']);

const listLinks = {
  invoices: '/backoffice/billing',
  receipts: '/backoffice/billing/receipts',
  credits: '/backoffice/billing/credit-notes',
  refunds: '/backoffice/billing/refunds',
} as const satisfies Record<BillingList, string>;
const sortColumns = {
  invoices: invoiceSortColumns,
  receipts: receiptSortColumns,
  credits: creditSortColumns,
  refunds: refundSortColumns,
} as const;
type SortColumn = (typeof sortColumns)[BillingList][number];

export interface BillingListQuery {
  readonly q?: string;
  readonly status?: typeof InvoiceStatus.Type | typeof EntryStatus.Type;
  readonly client?: string;
  readonly due?: typeof DueFilter.Type;
  readonly credit?: typeof CreditFilter.Type;
  readonly from?: string;
  readonly to?: string;
  readonly sort?: Exclude<BillingSort<SortColumn>, 'none'>;
}

export interface BillingDetailQuery {
  readonly billingList?: BillingList;
  readonly billingQ?: BillingListQuery['q'];
  readonly billingStatus?: BillingListQuery['status'];
  readonly billingClient?: BillingListQuery['client'];
  readonly billingDue?: BillingListQuery['due'];
  readonly billingCredit?: BillingListQuery['credit'];
  readonly billingFrom?: BillingListQuery['from'];
  readonly billingTo?: BillingListQuery['to'];
  readonly billingSort?: BillingListQuery['sort'];
  readonly tab?: InvoiceTab;
}

export function billingListQuery(source: BillingList, params: ParamMap): BillingListQuery {
  const period = readBillingPeriod(params);
  const sort = readBillingSort<SortColumn>(params, sortColumns[source]);
  return {
    q: (params.get('q') ?? '').slice(0, 160) || undefined,
    client: Option.getOrUndefined(Schema.decodeUnknownOption(Ulid)(params.get('client'))),
    status:
      source === 'invoices'
        ? Option.getOrUndefined(Schema.decodeUnknownOption(InvoiceStatus)(params.get('status')))
        : source === 'credits'
          ? undefined
          : Option.getOrUndefined(Schema.decodeUnknownOption(EntryStatus)(params.get('status'))),
    due:
      source === 'invoices'
        ? Option.getOrUndefined(Schema.decodeUnknownOption(DueFilter)(params.get('due')))
        : undefined,
    credit:
      source === 'invoices'
        ? Option.getOrUndefined(Schema.decodeUnknownOption(CreditFilter)(params.get('credit')))
        : undefined,
    from: period.from || undefined,
    to: period.to || undefined,
    sort: sort === 'none' ? undefined : sort,
  };
}

export function billingDetailQuery(
  source: BillingList,
  params: ParamMap,
  tab?: InvoiceTab,
): BillingDetailQuery {
  const query = billingListQuery(source, params);
  return {
    billingList: source,
    billingQ: query.q,
    billingStatus: query.status,
    billingClient: query.client,
    billingDue: query.due,
    billingCredit: query.credit,
    billingFrom: query.from,
    billingTo: query.to,
    billingSort: query.sort,
    tab,
  };
}

export class BillingNavigation {
  private readonly params;
  private readonly source;
  readonly listLink;
  readonly listQuery;
  readonly detailQuery;

  constructor(route: ActivatedRoute) {
    this.params = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
    this.source = computed(() =>
      Option.getOrUndefined(
        Schema.decodeUnknownOption(BillingList)(this.params().get('billingList')),
      ),
    );
    this.listLink = computed(() => listLinks[this.source() ?? 'invoices']);
    this.listQuery = computed((): BillingListQuery => {
      const source = this.source();
      if (source === undefined) return {};
      const params = this.params();
      return billingListQuery(
        source,
        convertToParamMap({
          q: params.get('billingQ'),
          status: params.get('billingStatus'),
          client: params.get('billingClient'),
          due: params.get('billingDue'),
          credit: params.get('billingCredit'),
          from: params.get('billingFrom'),
          to: params.get('billingTo'),
          sort: params.get('billingSort'),
        }),
      );
    });
    this.detailQuery = computed((): BillingDetailQuery => {
      const source = this.source();
      const tab = Option.getOrUndefined(
        Schema.decodeUnknownOption(InvoiceTab)(this.params().get('tab')),
      );
      if (source === undefined) return { tab };
      return billingDetailQuery(source, convertToParamMap(this.listQuery()), tab);
    });
  }
}
