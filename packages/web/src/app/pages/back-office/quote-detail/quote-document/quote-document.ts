import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  type DocumentArtifactValue,
  type DocumentIssueValue,
  type QuoteRevisionValue,
  type UlidValue,
} from '@froment/contracts';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DocumentIssues } from '@shared/document-issues/document-issues';

@Component({
  imports: [Button, Notice, DocumentIssues],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quote-document',
  styleUrl: './quote-document.scss',
  templateUrl: './quote-document.html',
})
export class QuoteDocument {
  private readonly prepareButton = viewChild('prepare', { read: ElementRef<HTMLButtonElement> });
  private readonly unavailableNotice = viewChild('unavailable', { read: ElementRef<HTMLElement> });
  focusPreparation(): void {
    (this.prepareButton()?.nativeElement ?? this.unavailableNotice()?.nativeElement)?.focus();
  }
  readonly quoteId = input.required<UlidValue>();
  readonly clientId = input.required<UlidValue>();
  readonly revision = input.required<QuoteRevisionValue>();
  readonly prepared = output<DocumentArtifactValue>();
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuotesApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly pending = signal(false);
  protected readonly prepareLabel = computed(() =>
    this.i18n.t(this.pending() ? 'backOffice.quote.pdf.generating' : 'commercial.preparePdf'),
  );
  protected readonly error = linkedSignal<TranslationKey | undefined>(() => {
    this.revision();
    return undefined;
  });
  protected readonly issues = linkedSignal<readonly DocumentIssueValue[]>(() => {
    this.revision();
    return [];
  });
  protected readonly artifact = linkedSignal<DocumentArtifactValue | undefined>(() => {
    this.revision();
    return undefined;
  });
  protected readonly preview = computed(
    () => `/api/quotes/${this.quoteId()}/revisions/${this.revision().version}/preview`,
  );
  protected readonly frame = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.preview()),
  );
  protected readonly pdf = computed(
    () => `/api/quotes/${this.quoteId()}/revisions/${this.revision().version}/pdf`,
  );

  protected async generate(): Promise<void> {
    if (this.pending() || !this.revision().previewAvailable) return;
    const id = this.quoteId();
    const revision = this.revision();
    this.pending.set(true);
    this.error.set(undefined);
    this.issues.set([]);
    try {
      const outcome = await this.api.renderPdf(id, revision.version);
      if (this.destroyRef.destroyed || this.quoteId() !== id || this.revision().id !== revision.id)
        return;
      if (!outcome.success) {
        if (outcome.failure?._tag === 'DocumentIncomplete') this.issues.set(outcome.failure.issues);
        else this.error.set(outcome.code);
        return;
      }
      this.artifact.set(outcome.result);
      this.prepared.emit(outcome.result);
    } catch {
      if (!this.destroyRef.destroyed && this.revision().id === revision.id)
        this.error.set('quote.error');
    } finally {
      this.pending.set(false);
    }
  }
}
