import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  PendingTasks,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { type IntegrationOperationValue } from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { emailQuery, messageStatus } from '../emails/email-workspace';

@Component({
  host: { class: 'page-container' },
  selector: 'app-email-detail',
  imports: [Badge, Button, LocalizedDatePipe, Notice, PageHeader, RouterLink],
  templateUrl: './email-detail.html',
  styleUrl: './email-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IntegrationsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  protected readonly operation = signal<IntegrationOperationValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly simulation = signal(false);
  protected readonly status = messageStatus;
  protected backQuery() {
    return emailQuery(this.route.snapshot.queryParamMap);
  }
  private generation = 0;
  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.pendingTasks.run(() => this.load())),
    );
  }
  protected async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(undefined);
    this.operation.set(undefined);
    try {
      const [operations, providers] = await Promise.all([
        this.api.list('email'),
        this.api.status(),
      ]);
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.simulation.set(
        providers.find((provider) => provider.kind === 'email')?.mode === 'simulation',
      );
      const operation = operations.find(
        (item) =>
          item.id === this.route.snapshot.paramMap.get('operationId') &&
          item.request.kind === 'email',
      );
      if (operation) this.operation.set(operation);
      else this.error.set('emailsWorkspace.messageUnavailable');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation)
        this.error.set('emailsWorkspace.loadError');
    } finally {
      if (!this.destroyRef.destroyed && generation === this.generation) this.loading.set(false);
    }
  }
  protected async retry(): Promise<void> {
    const operation = this.operation();
    if (
      !operation ||
      operation.receipt !== null ||
      operation.request.kind !== 'email' ||
      operation.request.expectedMode !== 'simulation' ||
      !this.simulation() ||
      this.busy()
    )
      return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const result = await this.api.submit(operation.request);
      if (result.success) this.operation.set(result.result);
      else this.error.set(result.code);
    } catch {
      this.error.set('emails.error');
    } finally {
      this.busy.set(false);
    }
  }
  canDeactivate(): boolean {
    return !this.busy();
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (this.busy()) event.preventDefault();
  }
}
