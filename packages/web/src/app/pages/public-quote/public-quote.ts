import { formatMoney } from '@froment/l10n';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  QuoteLinkToken,
  type PublicQuoteConsultationValue,
  type QuoteAcceptanceResultValue,
  type QuoteLinkTokenValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { distinctUntilChanged } from 'rxjs';

import { I18nService, type TranslationKey } from '@app/i18n.service';
import { PublicQuoteApi } from '../../public-quote/public-quote-api';
import { Button } from '@shared/button/button';
import { DocumentTextView } from '@shared/document-text-view/document-text-view';
import { Notice } from '@shared/notice/notice';
import { StatusBlock } from '@shared/status-block/status-block';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { Confirmation } from '@shared/confirmation/confirmation';
import { formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';

@Component({
  host: { class: 'page-container' },
  selector: 'app-public-quote',
  imports: [
    Button,
    DocumentTextView,
    FormField,
    Notice,
    RouterLink,
    RouterOutlet,
    StatusBlock,
    TabLayout,
    TabPanel,
    Tabs,
  ],
  templateUrl: './public-quote.html',
  styleUrl: './public-quote.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicQuote {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(PublicQuoteApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly confirmation = inject(Confirmation);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly signatureModel = signal({ signerName: '', signature: '', consent: false });
  private token: QuoteLinkTokenValue | undefined;
  private pdfObjectUrl: string | undefined;
  private loadGeneration = 0;

  protected readonly loading = signal(true);
  protected readonly signing = signal(false);
  protected readonly quote = signal<PublicQuoteConsultationValue | undefined>(undefined);
  protected readonly acceptance = signal<QuoteAcceptanceResultValue | undefined>(undefined);

  protected readonly signatureForm = form(this.signatureModel, (path) => {
    disabled(
      path,
      () =>
        this.loading() ||
        this.signing() ||
        this.acceptance() !== undefined ||
        this.quote()?.canSign !== true,
    );
    required(path.signerName);
    pattern(path.signerName, /\S/);
    maxLength(path.signerName, 160);
    required(path.signature);
    pattern(path.signature, /\S/);
    maxLength(path.signature, 160);
    validate(path.consent, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'explicit_consent_required' },
    );
  });
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly quoteTabs = computed<readonly TabItem[]>(() => [
    {
      path: 'summary',
      id: 'quote-summary-tab',
      label: this.i18n.t('publicQuote.tab.summary'),
    },
    {
      path: 'document',
      id: 'quote-document-tab',
      label: this.i18n.t('publicQuote.tab.document'),
    },
    {
      path: 'signature',
      id: 'quote-signature-tab',
      label: this.i18n.t('publicQuote.tab.signature'),
    },
    {
      path: 'confirmation',
      id: 'quote-confirmation-tab',
      label: this.i18n.t('publicQuoteWorkspace.confirmation'),
    },
  ]);
  protected readonly pdfUrl = signal<string | undefined>(undefined);
  protected readonly pdfFrameUrl = computed(() => {
    const url = this.pdfUrl();
    return url === undefined ? undefined : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  protected readonly signDisabled = computed(
    () =>
      this.loading() ||
      this.signing() ||
      this.acceptance() !== undefined ||
      this.quote()?.canSign !== true,
  );
  protected readonly unavailableSignatureVariant = computed(() => {
    if (this.quote()?.status === 'accepted') return 'success' as const;
    return 'danger' as const;
  });
  protected readonly unavailableSignatureLabel = computed<TranslationKey>(() => {
    if (this.quote()?.status === 'accepted') return 'publicQuote.alreadyAccepted';
    return 'publicQuoteWorkspace.notSignable';
  });

  protected invalid(field: 'signerName' | 'signature' | 'consent'): boolean {
    return this.signatureForm[field]().touched() && this.signatureForm[field]().invalid();
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.releasePdf());
    afterNextRender(() => {
      this.route.fragment
        .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
        .subscribe((fragment) => void this.load(fragment));
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (this.signing()) return false;
    if (this.acceptance() !== undefined || !this.signatureForm().dirty()) return true;
    const confirmed = await this.confirmation.request(
      this.i18n.t('backOffice.clientDetail.unsavedChanges'),
    );
    return confirmed && !this.signing();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.signing() || (!this.acceptance() && this.signatureForm().dirty()))
      event.preventDefault();
  }

  protected date(value: string): string {
    return formatLocalizedDate(value, this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  protected sign(event: SubmitEvent): void {
    event.preventDefault();
    if (this.signDisabled()) return;
    this.signatureForm().markAsTouched();
    if (this.signatureForm().invalid()) {
      this.signatureForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.signatureForm, async () => {
      const token = this.token;
      const generation = this.loadGeneration;
      if (token === undefined || token !== this.route.snapshot.fragment) return;
      this.signing.set(true);
      this.error.set(undefined);
      const model = this.signatureModel();
      try {
        const outcome = await this.api.sign({
          token,
          signerName: model.signerName,
          consent: true,
          signature: { kind: 'typed', value: model.signature },
        });
        if (!this.isCurrent(generation)) return;
        if (!outcome.success) {
          this.error.set(this.errorKey(outcome.code));
          return;
        }
        this.acceptance.set(outcome.result);
        this.signatureForm().reset();
      } catch {
        if (this.isCurrent(generation)) this.error.set('publicQuote.error');
      } finally {
        if (this.isCurrent(generation)) this.signing.set(false);
      }
      if (this.isCurrent(generation) && this.acceptance())
        await this.router.navigate(['confirmation'], {
          relativeTo: this.route,
          preserveFragment: true,
        });
    });
  }

  protected formatMoney(cents: number): string {
    return formatMoney(cents, this.i18n.language(), this.quote()?.snapshot.currency ?? 'EUR');
  }

  protected formatQuantity(milli: number): string {
    return new Intl.NumberFormat(this.i18n.language(), { maximumFractionDigits: 3 }).format(
      milli / 1_000,
    );
  }

  private async load(fragment: string | null): Promise<void> {
    const generation = ++this.loadGeneration;
    this.token = undefined;
    this.loading.set(true);
    this.signing.set(false);
    this.quote.set(undefined);
    this.acceptance.set(undefined);
    this.error.set(undefined);
    this.signatureForm().reset({ signerName: '', signature: '', consent: false });
    this.releasePdf();
    this.pdfUrl.set(undefined);
    const token = Option.getOrUndefined(Schema.decodeUnknownOption(QuoteLinkToken)(fragment));
    if (token === undefined) {
      this.error.set('quote_link.not_found');
      this.loading.set(false);
      return;
    }
    this.token = token;
    const outcome = await this.api.get(token);
    if (!this.isCurrent(generation)) return;
    if (!outcome.success) {
      this.error.set(this.errorKey(outcome.code));
      this.loading.set(false);
      return;
    }
    this.quote.set(outcome.result);
    try {
      const pdf = await this.api.getPdf(token);
      if (!this.isCurrent(generation)) return;
      this.pdfObjectUrl = URL.createObjectURL(pdf);
      this.pdfUrl.set(this.pdfObjectUrl);
    } catch {
      if (this.isCurrent(generation)) this.error.set('publicQuote.pdfError');
    } finally {
      if (this.isCurrent(generation)) this.loading.set(false);
    }
  }

  private isCurrent(generation: number): boolean {
    return !this.destroyRef.destroyed && generation === this.loadGeneration;
  }

  private errorKey(code: string): TranslationKey {
    if (
      code === 'quote_link.not_found' ||
      code === 'quote_link.not_signable' ||
      code === 'request.rate_limited'
    ) {
      return code;
    }
    return 'publicQuote.error';
  }

  private releasePdf(): void {
    if (this.pdfObjectUrl !== undefined) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = undefined;
  }
}
