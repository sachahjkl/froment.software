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
import { formatMoney } from '@froment/l10n';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { CheckoutHistory } from './checkout-history';
import { canOpenCheckout, checkoutStatusLabel } from './checkout-view';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs } from '@shared/tabs/tabs';
import { providerTabs, providerTestParams } from '../connections/provider-navigation';

@Component({
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink, LocalizedDatePipe, PageHeader, Tabs],
  providers: [CheckoutHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkout-detail',
  styleUrl: './checkout-detail.scss',
  templateUrl: './checkout-detail.html',
})
export class CheckoutDetail {
  protected readonly i18n = inject(I18nService);
  protected readonly history = inject(CheckoutHistory);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly testParams = computed(() => providerTestParams('stripe', this.queryParams()));
  protected readonly tabs = computed(() =>
    providerTabs('stripe', this.i18n, this.params().get('requestId')),
  );
  protected readonly current = computed(() =>
    this.history
      .operations()
      .find((item) => item.request.requestId === this.params().get('requestId')),
  );
  protected readonly statusLabel = checkoutStatusLabel;
  protected readonly canOpen = canOpenCheckout;
  protected readonly historyLabel = computed<TranslationKey>(() => {
    if (this.history.loaded()) return 'checkout.requestNotFound';
    if (this.history.paused()) return 'checkout.historyUnknown';
    return 'checkout.historyLoading';
  });
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.history.watch().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    });
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
