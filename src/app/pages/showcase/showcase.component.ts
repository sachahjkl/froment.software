import { Component, computed, inject } from '@angular/core';
import { I18nService } from '../../i18n.service';

type ShowcaseRow = {
  service: string;
  statusClass: 'ok' | 'warn' | 'err';
  statusLabel: string;
  updatedAt: string;
};

@Component({
  selector: 'app-showcase',
  standalone: true,
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss',
})
export class ShowcaseComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly rows = computed<ShowcaseRow[]>(() => [
    {
      service: 'api-gateway',
      statusClass: 'ok',
      statusLabel: this.i18n.t('showcase.status.ok'),
      updatedAt: this.i18n.formatDate('2026-05-28'),
    },
    {
      service: 'web-app',
      statusClass: 'warn',
      statusLabel: this.i18n.t('showcase.status.review'),
      updatedAt: this.i18n.formatDate('2026-05-28'),
    },
    {
      service: 'worker',
      statusClass: 'err',
      statusLabel: this.i18n.t('showcase.status.error'),
      updatedAt: this.i18n.formatDate('2026-05-27'),
    },
  ]);
}
