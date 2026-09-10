import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { EmailTest } from './email-test';

@Component({
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-email-test-detail',
  styleUrl: './email-test-detail.scss',
  templateUrl: './email-test-detail.html',
})
export class EmailTestDetail extends EmailTest {
  protected override readonly task = false;
}
