import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { DomSanitizer } from '@angular/platform-browser';
import {
  QuoteLinkToken,
  type PublicQuoteConsultationValue,
  type QuoteAcceptanceResultValue,
  type QuoteLinkTokenValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { I18nService, type TranslationKey } from '@app/i18n.service';
import { PublicQuoteApi } from '../../public-quote/public-quote-api';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

type QuoteTab = 'summary' | 'document' | 'signature';

@Component({
  selector: 'app-public-quote',
  imports: [Button, FormField, Notice, Tabs],
  templateUrl: './public-quote.html',
  styleUrl: './public-quote.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicQuote {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(PublicQuoteApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly signatureModel = signal({ signerName: '', signature: '', consent: false });
  private token: QuoteLinkTokenValue | undefined;
  private pdfObjectUrl: string | undefined;

  protected readonly signatureForm = form(this.signatureModel, (path) => {
    required(path.signerName);
    pattern(path.signerName, /\S/);
    maxLength(path.signerName, 160);
    required(path.signature);
    pattern(path.signature, /\S/);
    maxLength(path.signature, 160);
    validate(path.consent, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Explicit consent is required.' },
    );
  });
  protected readonly loading = signal(true);
  protected readonly signing = signal(false);
  protected readonly quote = signal<PublicQuoteConsultationValue | undefined>(undefined);
  protected readonly acceptance = signal<QuoteAcceptanceResultValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly quoteTab = signal<QuoteTab>('summary');
  protected readonly quoteTabs = computed<readonly TabItem[]>(() => [
    {
      value: 'summary',
      id: 'quote-summary-tab',
      label: this.i18n.t('publicQuote.tab.summary'),
      panelId: 'quote-summary-panel',
    },
    {
      value: 'document',
      id: 'quote-document-tab',
      label: this.i18n.t('publicQuote.tab.document'),
      panelId: 'quote-document-panel',
    },
    {
      value: 'signature',
      id: 'quote-signature-tab',
      label: this.i18n.t('publicQuote.tab.signature'),
      panelId: 'quote-signature-panel',
    },
  ]);
  protected readonly pdfUrl = signal<string | undefined>(undefined);
  protected readonly pdfFrameUrl = computed(() => {
    const url = this.pdfUrl();
    return url === undefined ? undefined : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  protected readonly signDisabled = computed(
    () => this.signing() || this.signatureForm().invalid(),
  );

  protected invalid(field: 'signerName' | 'signature' | 'consent'): boolean {
    return this.signatureForm[field]().touched() && this.signatureForm[field]().invalid();
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.releasePdf());
    afterNextRender(() => void this.load());
  }

  protected sign(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.signatureForm, async () => {
      const token = this.token;
      if (token === undefined) return;
      this.signing.set(true);
      this.error.set(undefined);
      const model = this.signatureModel();
      const outcome = await this.api.sign({
        token,
        signerName: model.signerName,
        consent: true,
        signature: { kind: 'typed', value: model.signature },
      });
      this.signing.set(false);
      if (!outcome.success) {
        this.error.set(this.errorKey(outcome.code));
        return;
      }
      this.acceptance.set(outcome.result);
      this.signatureForm().reset();
    });
  }

  protected formatMoney(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected formatQuantity(milli: number): string {
    return new Intl.NumberFormat(this.i18n.language(), { maximumFractionDigits: 3 }).format(
      milli / 1_000,
    );
  }

  private async load(): Promise<void> {
    const browser = this.document.defaultView;
    const rawToken = browser?.location.hash.slice(1) ?? '';
    browser?.history.replaceState(
      null,
      '',
      `${browser.location.pathname}${browser.location.search}`,
    );
    const token = Option.getOrUndefined(Schema.decodeUnknownOption(QuoteLinkToken)(rawToken));
    if (token === undefined) {
      this.error.set('quote_link.not_found');
      this.loading.set(false);
      return;
    }
    this.token = token;
    const outcome = await this.api.get(token);
    if (!outcome.success) {
      this.error.set(this.errorKey(outcome.code));
      this.loading.set(false);
      return;
    }
    this.quote.set(outcome.result);
    try {
      const pdf = await this.api.getPdf(token);
      this.pdfObjectUrl = URL.createObjectURL(pdf);
      this.pdfUrl.set(this.pdfObjectUrl);
    } catch {
      this.error.set('publicQuote.pdfError');
    } finally {
      this.loading.set(false);
    }
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
