import { Component, computed, inject, signal } from '@angular/core';
import { I18nService, type TranslationKey } from '../../i18n.service';

type ShowcaseStatus = 'all' | 'ok' | 'warn' | 'err';
type FeedbackKey = Extract<TranslationKey, 'showcase.feedback.executed' | 'showcase.feedback.cancelled'>;

type ShowcaseRow = {
  service: string;
  statusClass: Exclude<ShowcaseStatus, 'all'>;
  statusLabel: string;
  updatedOn: string;
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

  protected readonly query = signal('');
  protected readonly statusFilter = signal<ShowcaseStatus>('all');
  protected readonly dense = signal(false);
  protected readonly expandedService = signal<string | null>(null);
  protected readonly feedbackKey = signal<FeedbackKey | null>(null);
  protected readonly feedbackChannel = signal(false);

  protected readonly rows = computed<ShowcaseRow[]>(() => [
    {
      service: 'api-gateway',
      statusClass: 'ok',
      statusLabel: this.i18n.t('showcase.status.ok'),
      updatedOn: '2026-05-28',
      updatedAt: this.formatCalendarDate(2026, 5, 28),
    },
    {
      service: 'web-app',
      statusClass: 'warn',
      statusLabel: this.i18n.t('showcase.status.review'),
      updatedOn: '2026-05-28',
      updatedAt: this.formatCalendarDate(2026, 5, 28),
    },
    {
      service: 'worker',
      statusClass: 'err',
      statusLabel: this.i18n.t('showcase.status.error'),
      updatedOn: '2026-05-27',
      updatedAt: this.formatCalendarDate(2026, 5, 27),
    },
  ]);

  protected readonly filteredRows = computed(() => {
    const query = this.query().trim().toLocaleLowerCase(this.i18n.language());
    const status = this.statusFilter();

    return this.rows().filter(
      (row) =>
        (status === 'all' || row.statusClass === status) &&
        (query === '' || row.service.toLocaleLowerCase(this.i18n.language()).includes(query)),
    );
  });

  protected updateQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.query.set(event.target.value);
    }
  }

  protected updateStatus(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.statusFilter.set(event.target.value as ShowcaseStatus);
    }
  }

  protected toggleDensity(): void {
    this.dense.update((dense) => !dense);
  }

  protected toggleDetails(service: string): void {
    this.expandedService.update((expanded) => (expanded === service ? null : service));
  }

  protected setFeedback(key: FeedbackKey): void {
    this.feedbackKey.set(key);
    this.feedbackChannel.update((channel) => !channel);
  }

  private formatCalendarDate(year: number, month: number, day: number): string {
    return this.i18n.formatDate(new Date(Date.UTC(year, month - 1, day)), {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
  }
}
