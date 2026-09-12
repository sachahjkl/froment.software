import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CustomRole } from '@froment/contracts';

import { Can } from '@backoffice/can';
import { RolesApi } from '@backoffice/roles-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  host: { class: 'page-container' },
  selector: 'app-roles',
  imports: [Breadcrumbs, Button, Can, DataTable, Notice, PageHeader, RouterLink],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(RolesApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly roles = signal<ReadonlyArray<CustomRole>>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly breadcrumbs = computed(() => [
    { label: this.i18n.t('team.title'), path: '/backoffice/team' },
  ]);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.list();
      if (outcome.success) this.roles.set(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      this.error.set('role.error');
    } finally {
      this.loading.set(false);
    }
  }

  protected async remove(role: CustomRole): Promise<void> {
    if (this.busy()) return;
    if (!(await this.confirmation.request(this.i18n.tf('role.deleteConfirm', { name: role.name }))))
      return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.remove(role.id);
      if (outcome.success) this.roles.update((roles) => roles.filter(({ id }) => id !== role.id));
      else this.error.set(outcome.code);
    } catch {
      this.error.set('role.error');
    } finally {
      this.busy.set(false);
    }
  }
}
