import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Checkout } from './checkout';

@Component({
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkout-detail',
  styleUrl: './checkout-detail.scss',
  templateUrl: './checkout-detail.html',
})
export class CheckoutDetail extends Checkout {
  protected override readonly task = false;
}
