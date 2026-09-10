import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PendingTasks,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { type OrderSummaryValue, type QuoteRevisionValue } from '@froment/contracts';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { QuoteLines } from '../quote-detail/quote-lines/quote-lines';
import { quoteIdentifier } from '../quote-detail/quote-values';
import { affairContext } from '../affairs/affair-filters';
import { commercialAffairBack, commercialDocumentTitle } from '../commercial-header';
import { ClientDescription } from '../client-description/client-description';

@Component({
  host: { class: 'page-container' },
  imports: [Badge, Button, ClientDescription, Notice, PageHeader, RouterLink, QuoteLines],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-order-detail',
  styleUrl: './order-detail.scss',
  templateUrl: './order-detail.html',
})
export class OrderDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(OrdersApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly context = signal(affairContext(this.route.snapshot.queryParamMap));
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly order = signal<OrderSummaryValue | undefined>(undefined);
  protected readonly revision = signal<QuoteRevisionValue | undefined>(undefined);
  protected readonly pdfReady = signal(false);
  protected readonly pending = signal(false);
  protected readonly pdfError = signal(false);
  protected readonly headerTitle = computed(() => {
    const order = this.order();
    return order
      ? commercialDocumentTitle(order.reference, order.title)
      : this.i18n.t('commercial.order');
  });
  protected readonly back = computed(() =>
    commercialAffairBack(this.order()?.quoteId, this.context().view),
  );
  protected readonly generateLabel = computed(() =>
    this.i18n.t(
      this.pending() ? 'backOffice.quote.pdf.generating' : 'backOffice.quote.pdf.generate',
    ),
  );
  private generation = 0;
  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => this.context.set(affairContext(params)));
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load());
    });
  }
  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  protected revisionQuery(version: number) {
    return { ...this.context(), version };
  }
  protected async load(): Promise<void> {
    const generation = ++this.generation;
    const id = quoteIdentifier(this.route.snapshot.paramMap.get('orderId'));
    this.state.set('loading');
    this.order.set(undefined);
    this.revision.set(undefined);
    this.pdfReady.set(false);
    this.pdfError.set(false);
    if (!id) {
      this.state.set('error');
      return;
    }
    const finishLoading = this.pendingTasks.add();
    try {
      const orders = await this.api.list();
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      const order = orders.find((item) => item.id === id);
      if (!order) {
        this.state.set('error');
        return;
      }
      const outcome = await this.quotesApi.get(order.quoteId);
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      if (!outcome.success) {
        this.state.set('error');
        return;
      }
      const revision = outcome.result.revisions.find((item) => item.id === order.revisionId);
      if (!revision) {
        this.state.set('error');
        return;
      }
      this.order.set(order);
      this.revision.set(revision);
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) this.state.set('error');
    } finally {
      finishLoading();
    }
  }
  protected async generate(): Promise<void> {
    const order = this.order();
    if (!order || this.pending()) return;
    const generation = this.generation;
    this.pending.set(true);
    this.pdfError.set(false);
    try {
      await this.api.renderPdf(order.id);
      if (!this.destroyRef.destroyed && generation === this.generation) this.pdfReady.set(true);
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) this.pdfError.set(true);
    } finally {
      this.pending.set(false);
    }
  }
}
