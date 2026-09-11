import { Can } from '@backoffice/can';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { disabled, form, FormField, submit, validate } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  type DocumentArtifactValue,
  type DocumentIssueValue,
  type QuoteDetailValue,
  type QuoteSendResultValue,
  type QuoteLinkStateValue,
} from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { QuotesApi } from '@backoffice/quotes-api';
import { Authentication } from '@backoffice/authentication';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { CopyField } from '@shared/copy-field/copy-field';
import { DocumentIssues } from '@shared/document-issues/document-issues';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TextCopy } from '@shared/text-copy';
import { QuoteDocument } from '../quote-detail/quote-document/quote-document';
import { quoteIdentifier } from '../quote-detail/quote-values';
import { affairContext } from '../affairs/affair-filters';

@Component({
  host: { class: 'page-container' },
  imports: [
    Can,
    Button,
    CopyField,
    DocumentIssues,
    FormField,
    Notice,
    PageHeader,
    RouterLink,
    QuoteDocument,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quote-publication',
  styleUrl: './quote-publication.scss',
  templateUrl: './quote-publication.html',
})
export class QuotePublication {
  private readonly authentication = inject(Authentication);
  private readonly documentPreview = viewChild(QuoteDocument);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuotesApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly context = signal(affairContext(this.route.snapshot.queryParamMap));
  protected readonly quoteId = signal(quoteIdentifier(this.route.snapshot.paramMap.get('quoteId')));
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly textCopy = inject(TextCopy);
  private readonly confirmation = inject(Confirmation);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly quote = signal<QuoteDetailValue | undefined>(undefined);
  protected readonly pending = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly completed = signal<QuoteSendResultValue | undefined>(undefined);
  protected readonly linkState = signal<QuoteLinkStateValue | null | undefined>(undefined);
  protected readonly artifact = signal<DocumentArtifactValue | undefined>(undefined);
  protected readonly pdfReady = computed(
    () =>
      this.artifact()?.revisionId === this.quote()?.currentRevision.id &&
      this.artifact() !== undefined,
  );
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly issues = signal<readonly DocumentIssueValue[]>([]);
  protected readonly copied = signal(false);
  protected readonly copyStatus = computed(() =>
    this.copied() ? this.i18n.t('backOffice.quote.link.copied') : '',
  );
  protected readonly publishKey = computed<TranslationKey>(() =>
    this.pending() ? 'backOffice.quote.sending' : 'commercial.createLink',
  );
  protected readonly confirming = signal(false);
  protected readonly review = form(signal({ checked: false }), (path) => {
    disabled(path, { when: () => this.pending() || this.uncertain() || !!this.completed() });
    validate(path.checked, ({ value }) => (value() ? undefined : { kind: 'required' }));
  });
  private readonly hasReview = computed(
    () => this.review.checked().touched() || this.review.checked().dirty(),
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
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  protected prepared(artifact: DocumentArtifactValue): void {
    if (artifact.revisionId === this.quote()?.currentRevision.id) this.artifact.set(artifact);
  }
  protected async reload(): Promise<void> {
    if (this.pending() || this.confirming()) return;
    await this.load();
  }
  private async load(): Promise<void> {
    const generation = ++this.generation;
    const id = quoteIdentifier(this.route.snapshot.paramMap.get('quoteId'));
    this.quoteId.set(id);
    this.state.set('loading');
    this.pending.set(false);
    this.quote.set(undefined);
    this.artifact.set(undefined);
    this.completed.set(undefined);
    this.linkState.set(undefined);
    this.error.set(undefined);
    this.issues.set([]);
    this.copied.set(false);
    if (!id) {
      this.state.set('error');
      return;
    }
    const finishLoading = this.pendingTasks.add();
    try {
      const outcome = await this.api.get(id);
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.state.set('error');
        return;
      }
      this.quote.set(outcome.result);
      if (outcome.result.status === 'sent' && this.authentication.can('quote.send')) {
        const link = await this.api.linkState(outcome.result.id);
        if (this.destroyRef.destroyed || generation !== this.generation) return;
        if (!link.success) {
          this.error.set(link.code);
          this.state.set('error');
          return;
        }
        this.linkState.set(link.result);
      }
      this.uncertain.set(false);
      this.review().reset({ checked: false });
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) this.state.set('error');
    } finally {
      finishLoading();
    }
  }
  protected publish(event: SubmitEvent): void {
    event.preventDefault();
    const quote = this.quote();
    if (
      !quote ||
      quote.status !== 'draft' ||
      !this.authentication.can('quote.send') ||
      this.pending() ||
      this.uncertain() ||
      this.confirming() ||
      this.completed()
    )
      return;
    this.error.set(undefined);
    if (!this.pdfReady()) {
      this.error.set('commercial.pdfRequired');
      this.documentPreview()?.focusPreparation();
      return;
    }
    this.review.checked().markAsTouched();
    if (this.review.checked().invalid()) {
      this.review.checked().focusBoundControl();
      return;
    }
    void submit(this.review, async () => {
      this.pending.set(true);
      this.issues.set([]);
      const generation = this.generation;
      try {
        const outcome = await this.api.send(quote.id, { expectedVersion: quote.version });
        if (this.destroyRef.destroyed || generation !== this.generation) return;
        if (!outcome.success) {
          if (outcome.failure?._tag === 'DocumentIncomplete')
            this.issues.set(outcome.failure.issues);
          else if (outcome.code === 'quote.error') {
            this.uncertain.set(true);
            this.error.set('commercial.publicationUncertain');
          } else this.error.set(outcome.code);
          return;
        }
        this.completed.set(outcome.result);
        this.quote.set({ ...quote, status: outcome.result.status });
        this.review().reset({ checked: false });
      } catch {
        if (this.destroyRef.destroyed || generation !== this.generation) return;
        this.uncertain.set(true);
        this.error.set('commercial.publicationUncertain');
      } finally {
        if (generation === this.generation) this.pending.set(false);
      }
    });
  }
  protected async copyLink(): Promise<void> {
    const result = this.completed();
    if (!result) return;
    const copied = await this.textCopy.copy(result.link.url);
    if (this.completed() === result) this.copied.set(copied);
  }
  protected async replaceLink(): Promise<void> {
    const account = this.authentication.account();
    const quote = this.quote();
    const link = this.linkState();
    if (
      !quote ||
      quote.status !== 'sent' ||
      !account ||
      !this.authentication.can('quote.send') ||
      link === undefined ||
      this.pending() ||
      this.confirming() ||
      this.uncertain() ||
      this.completed()
    )
      return;
    const generation = this.generation;
    if (!(await this.requestConfirmation('commercial.confirmReplaceLink'))) return;
    if (this.destroyRef.destroyed || generation !== this.generation) return;
    this.pending.set(true);
    this.error.set(undefined);
    try {
      const currentAccount = await this.authentication.refreshAccount();
      if (
        this.destroyRef.destroyed ||
        generation !== this.generation ||
        currentAccount?.userId !== account.userId ||
        !this.authentication.can('quote.send')
      )
        return;
      const outcome = await this.api.replaceLink(quote.id, {
        expectedVersion: quote.version,
        expectedLinkId: link?.id ?? null,
      });
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      if (outcome.success) {
        this.completed.set(outcome.result);
        this.copied.set(false);
      } else if (outcome.code === 'quote.error') {
        this.uncertain.set(true);
        this.error.set('commercial.replacementUncertain');
      } else this.error.set(outcome.code);
    } catch {
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.uncertain.set(true);
      this.error.set('commercial.replacementUncertain');
    } finally {
      if (generation === this.generation) this.pending.set(false);
    }
  }
  async canDeactivate(): Promise<boolean> {
    if (this.pending() || this.confirming()) return false;
    if (this.uncertain()) return this.requestConfirmation('commercial.leavePublicationUncertain');
    if (this.completed() && !this.copied()) return this.requestConfirmation('commercial.leaveLink');
    if (!this.completed() && this.hasReview())
      return this.requestConfirmation('commercial.leaveReview');
    return true;
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventPendingUnload(event: BeforeUnloadEvent): void {
    if (
      this.pending() ||
      this.confirming() ||
      this.uncertain() ||
      (this.completed() && !this.copied()) ||
      (!this.completed() && this.hasReview())
    )
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
