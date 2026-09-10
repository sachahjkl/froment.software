import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Ulid } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { Option, Schema } from 'effect';
import { ClientPortalApi } from '@backoffice/client-portal-api';
import { I18nService } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';
import {
  portalDocuments,
  PortalDocumentKind,
  type PortalDocument,
} from '../client-portal/portal-documents';
import { portalFilters, portalFilterQuery } from '../client-portal/portal-filters';

@Component({
  selector: 'app-customer-document-detail',
  host: { class: 'page-container' },
  imports: [Badge, Button, Notice, PageHeader, RouterLink],
  templateUrl: './customer-document-detail.html',
  styleUrl: './customer-document-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDocumentDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientPortalApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly returnQuery = computed(() =>
    portalFilterQuery(portalFilters(this.queryParams())),
  );
  protected readonly state = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  protected readonly document = signal<PortalDocument | undefined>(undefined);
  protected readonly pdfUrl = computed(() => {
    const item = this.document();
    if (!item?.pdfAvailable) return undefined;
    if (item.quote) return this.api.quotePdfUrl(item.quote.id);
    if (item.order) return this.api.orderPdfUrl(item.order.id);
    if (item.invoice) return this.api.invoicePdfUrl(item.invoice.id);
    return undefined;
  });
  protected readonly status = computed(() => {
    const item = this.document();
    if (item?.quote) return this.i18n.t(`backOffice.quote.status.${item.quote.status}`);
    if (item?.invoice) return this.i18n.t(`backOffice.invoice.status.${item.invoice.status}`);
    return this.i18n.t('backOffice.client.confirmed');
  });
  private loadGeneration = 0;

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  protected money(cents: number, currency: string): string {
    return formatMoney(cents, this.i18n.language(), currency);
  }
  protected date(value: string): string {
    return formatLocalizedDate(value, this.i18n.language(), { dateStyle: 'medium' });
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    this.document.set(undefined);
    const kind = Schema.decodeUnknownOption(PortalDocumentKind)(
      this.route.snapshot.paramMap.get('kind'),
    );
    const id = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('documentId'));
    if (Option.isNone(kind) || Option.isNone(id)) {
      this.state.set('missing');
      return;
    }
    try {
      const items =
        kind.value === 'quote'
          ? portalDocuments(await this.api.listQuotes(), [], [])
          : kind.value === 'order'
            ? portalDocuments([], await this.api.listOrders(), [])
            : portalDocuments([], [], await this.api.listInvoices());
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      const item = items.find((item) => item.id === id.value);
      this.document.set(item);
      this.state.set(item ? 'ready' : 'missing');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.loadGeneration) this.state.set('error');
    }
  }
}
