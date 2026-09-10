import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { EmailTestHistory } from './email-test-history';
import { emailTestOutcomeHint, emailTestStatusLabel } from './email-test-view';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs } from '@shared/tabs/tabs';
import { providerTabs, providerTestParams } from '../connections/provider-navigation';

@Component({
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink, LocalizedDatePipe, PageHeader, Tabs],
  providers: [EmailTestHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-email-test-detail',
  styleUrl: './email-test-detail.scss',
  templateUrl: './email-test-detail.html',
})
export class EmailTestDetail {
  protected readonly i18n = inject(I18nService);
  protected readonly history = inject(EmailTestHistory);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly testParams = computed(() => providerTestParams('resend', this.queryParams()));
  protected readonly tabs = computed(() =>
    providerTabs('resend', this.i18n, this.params().get('requestId')),
  );
  protected readonly current = computed(() =>
    this.history
      .operations()
      .find((item) => item.request.requestId === this.params().get('requestId')),
  );
  protected readonly statusLabel = emailTestStatusLabel;
  protected readonly outcomeHint = emailTestOutcomeHint;
  protected readonly historyLabel = computed<TranslationKey>(() => {
    if (this.history.loaded()) return 'configurationWorkspace.notFound';
    if (this.history.paused()) return 'emailTest.historyUnavailable';
    return 'connections.loading';
  });
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.history.watch().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    });
  }
}
