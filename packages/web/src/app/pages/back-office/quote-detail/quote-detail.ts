import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  Injector,
  PendingTasks,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  form,
  FormField,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  QuoteCancellationReason,
  type QuoteCancellationReasonValue,
  type OrderSummaryValue,
  type QuoteDetailValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ActionMenu, type MenuAction } from '@shared/action-menu/action-menu';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TextCopy } from '@shared/text-copy';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { quoteIdentifier } from './quote-values';
import { QuoteLines } from './quote-lines/quote-lines';
import { QuoteDocument } from './quote-document/quote-document';
import { affairContext } from '../affairs/affair-filters';
import {
  commercialBreadcrumbs,
  commercialDocumentTitle,
  quoteStatusBadge,
} from '../commercial-header';
import { ClientDescription } from '../client-description/client-description';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { canCancelQuote, quoteEditAction } from './quote-actions';

@Component({
  host: { class: 'page-container' },
  imports: [
    Can,
    Badge,
    ActionMenu,
    Button,
    ClientDescription,
    Breadcrumbs,
    FormField,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    Tabs,
    TabLayout,
    TabPanel,
    QuoteLines,
    QuoteDocument,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quote-detail',
  styleUrl: './quote-detail.scss',
  templateUrl: './quote-detail.html',
})
export class QuoteDetail {
  private readonly authentication = inject(Authentication);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly context = signal(affairContext(this.route.snapshot.queryParamMap));
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly confirmation = inject(Confirmation);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly copy = inject(TextCopy);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly quote = signal<QuoteDetailValue | undefined>(undefined);
  protected readonly order = signal<OrderSummaryValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly cancelling = signal(false);
  protected readonly confirming = signal(false);
  protected readonly cancellationOpen = signal(false);
  protected readonly copied = signal(false);
  protected readonly headerTitle = computed(() => {
    const quote = this.quote();
    return quote
      ? commercialDocumentTitle(quote.reference, quote.currentRevision.title)
      : this.i18n.t('commercial.quote');
  });
  protected readonly statusBadge = computed(() => {
    const quote = this.quote();
    return quote ? quoteStatusBadge(quote.status) : undefined;
  });
  protected readonly editAction = computed(() => {
    const quote = this.quote();
    return quote ? quoteEditAction(quote.status) : undefined;
  });
  protected readonly canCancel = computed(() => {
    const quote = this.quote();
    return (
      this.authentication.can('quote.delete') && quote !== undefined && canCancelQuote(quote.status)
    );
  });
  protected readonly actionsDisabled = computed(() => this.cancelling() || this.confirming());
  protected readonly cancellationVisible = computed(
    () => this.canCancel() && (this.cancellationOpen() || this.hasCancellationInput()),
  );
  protected readonly cancellationLabel = computed(() =>
    this.i18n.t(this.cancelling() ? 'backOffice.quote.cancelling' : 'backOffice.quote.cancel'),
  );
  protected readonly loadError = computed(() => this.error() ?? 'quote.error');
  protected readonly breadcrumbs = computed(() =>
    commercialBreadcrumbs(undefined, this.context(), this.i18n.language()),
  );
  protected readonly secondaryActions = computed<readonly MenuAction[]>(() => {
    const quote = this.quote();
    if (!quote) return [];
    const actions: MenuAction[] = [];
    if (quote.status !== 'draft')
      actions.push({
        id: 'copy-portal',
        label: this.i18n.t(
          this.copied() ? 'backOffice.affair.portalLinkCopied' : 'backOffice.affair.copyPortalLink',
        ),
      });
    if (this.canCancel())
      actions.push({
        id: 'cancel',
        label: this.i18n.t('backOffice.quote.cancel'),
        danger: true,
      });
    return actions;
  });
  protected selectSecondaryAction(action: string): void {
    if (
      this.confirming() ||
      this.cancelling() ||
      !this.secondaryActions().some(({ id }) => id === action)
    )
      return;
    if (action === 'copy-portal') void this.copyPortal();
    else if (action === 'cancel') {
      this.cancellationOpen.set(true);
      afterNextRender(() => this.cancellation.reason().focusBoundControl(), {
        injector: this.injector,
      });
    }
  }
  protected readonly version = signal('');
  protected readonly revision = computed(() => {
    const quote = this.quote();
    if (!quote) return undefined;
    return this.version() === ''
      ? quote.currentRevision
      : quote.revisions.find((item) => String(item.version) === this.version());
  });
  protected readonly revisions = computed(
    () => this.quote()?.revisions.toSorted((left, right) => left.version - right.version) ?? [],
  );
  protected selectVersion(version: string): void {
    this.version.set(version);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { version: version || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  private readonly cancellationModel = signal({ reason: '', note: '' });
  protected readonly hasCancellationInput = computed(
    () => this.cancellationModel().reason !== '' || this.cancellationModel().note !== '',
  );
  protected readonly cancellation = form(this.cancellationModel, (path) => {
    disabled(path, { when: () => this.cancelling() });
    required(path.reason);
    validate(path.reason, ({ value }) =>
      Option.isNone(Schema.decodeUnknownOption(QuoteCancellationReason)(value()))
        ? { kind: 'reason' }
        : undefined,
    );
    maxLength(path.note, 500);
  });
  protected readonly reasonInvalid = computed(
    () => this.cancellation.reason().touched() && this.cancellation.reason().invalid(),
  );
  protected readonly noteInvalid = computed(
    () => this.cancellation.note().touched() && this.cancellation.note().invalid(),
  );
  protected readonly reasons = QuoteCancellationReason.literals;
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    ['summary', 'document'].map((tab) => ({
      path: tab,
      id: `quote-${tab}-tab`,
      label: this.i18n.t(tab === 'summary' ? 'commercial.summary' : 'commercial.document'),
    })),
  );
  private generation = 0;

  constructor() {
    afterNextRender(() => {
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load());
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        this.version.set(params.get('version') ?? '');
        this.context.set(affairContext(params));
      });
    });
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected reasonLabel(reason: QuoteCancellationReasonValue): string {
    return this.i18n.t(`backOffice.quote.cancelReason.${reason}`);
  }
  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  protected async reload(): Promise<void> {
    if (this.cancelling() || this.confirming()) return;
    if (
      this.hasCancellationInput() &&
      !(await this.requestConfirmation('commercial.discardCancellation'))
    )
      return;
    if (!this.destroyRef.destroyed) await this.load();
  }
  private async load(): Promise<void> {
    const generation = ++this.generation;
    const id = quoteIdentifier(this.route.snapshot.paramMap.get('quoteId'));
    this.state.set('loading');
    this.cancelling.set(false);
    this.quote.set(undefined);
    this.order.set(undefined);
    this.error.set(undefined);
    this.copied.set(false);
    this.cancellation().reset({ reason: '', note: '' });
    this.cancellationOpen.set(false);
    if (!id) {
      this.state.set('error');
      return;
    }
    const finishLoading = this.pendingTasks.add();
    try {
      const [outcome, orders] = await Promise.all([
        this.api.get(id),
        this.authentication.can('order.read') ? this.ordersApi.list() : [],
      ]);
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.state.set('error');
        return;
      }
      this.quote.set(outcome.result);
      this.order.set(orders.find((item) => item.quoteId === id));
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) this.state.set('error');
    } finally {
      finishLoading();
    }
  }
  protected cancel(event: SubmitEvent): void {
    event.preventDefault();
    if (this.cancelling() || this.confirming()) return;
    this.cancellation.reason().markAsTouched();
    this.cancellation.note().markAsTouched();
    if (this.cancellation.reason().invalid()) {
      this.cancellation.reason().focusBoundControl();
      return;
    }
    if (this.cancellation.note().invalid()) {
      this.cancellation.note().focusBoundControl();
      return;
    }
    void submit(this.cancellation, async () => {
      const quote = this.quote();
      const reason = Schema.decodeUnknownOption(QuoteCancellationReason)(
        this.cancellation.reason().value(),
      );
      if (!quote || !canCancelQuote(quote.status) || Option.isNone(reason)) return;
      const generation = this.generation;
      const note = this.cancellation.note().value().trim();
      if (!(await this.requestConfirmation('backOffice.quote.cancelConfirm'))) return;
      if (this.destroyRef.destroyed || generation !== this.generation || this.cancelling()) return;
      this.cancelling.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.api.cancel(quote.id, {
          expectedVersion: quote.version,
          reason: reason.value,
          note,
        });
        if (this.destroyRef.destroyed || generation !== this.generation) return;
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.quote.set(outcome.result);
        this.cancellation().reset({ reason: '', note: '' });
      } catch {
        if (!this.destroyRef.destroyed && generation === this.generation)
          this.error.set('quote.error');
      } finally {
        if (generation === this.generation) this.cancelling.set(false);
      }
    });
  }
  protected async copyPortal(): Promise<void> {
    const quote = this.quote();
    const origin = this.document.location?.origin;
    if (!quote || !origin) return;
    const url = new URL('/backoffice/client', origin);
    url.searchParams.set('quote', quote.id);
    const copied = await this.copy.copy(url.toString());
    if (this.quote()?.id === quote.id) this.copied.set(copied);
  }
  async canDeactivate(): Promise<boolean> {
    if (this.cancelling() || this.confirming()) return false;
    return (
      !this.hasCancellationInput() || this.requestConfirmation('commercial.discardCancellation')
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventPendingUnload(event: BeforeUnloadEvent): void {
    if (this.cancelling() || this.confirming() || this.hasCancellationInput())
      event.preventDefault();
  }
  private async requestConfirmation(key: TranslationKey): Promise<boolean> {
    if (this.confirming() || this.destroyRef.destroyed) return false;
    this.confirming.set(true);
    try {
      return await this.confirmation.request(this.i18n.t(key));
    } finally {
      this.confirming.set(false);
    }
  }
}
