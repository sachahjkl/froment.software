import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  documentTextContent,
  type QuoteConditionPresetListValue,
  type QuoteConditionPresetValue,
} from '@froment/contracts';

import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { DataTable } from '@shared/data-table/data-table';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { conditionTableOptions } from '../configuration/workspace-tables';

@Component({
  selector: 'app-quote-condition-presets',
  imports: [
    Can,
    Button,
    DataTable,
    RouterLink,
    Notice,
    PageHeader,
    TableSort,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './quote-condition-presets.html',
  styleUrl: './quote-condition-presets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class QuoteConditionPresets {
  protected readonly authentication = inject(Authentication);
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuoteConditionPresetsApi);
  protected readonly presets = signal<QuoteConditionPresetListValue>([]);
  private readonly tablePresets = computed(() =>
    this.presets().map((preset) => ({
      id: preset.id,
      name: preset.name,
      conditions: documentTextContent(preset.conditions, preset.conditionsPresentation),
    })),
  );
  protected readonly table = createWorkspaceTable(this.tablePresets, conditionTableOptions);
  protected readonly conditionExport = computed(() =>
    this.table.rows().map((item) => [item.name, item.conditions]),
  );
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  canDeactivate(): boolean {
    return !this.saving();
  }

  protected async remove(preset: QuoteConditionPresetValue): Promise<void> {
    if (this.saving()) return;
    if (
      !(await this.confirmation.request(
        this.i18n.t('backOffice.conditionPresets.deleteConfirmation'),
      ))
    )
      return;
    this.saving.set(true);
    const outcome = await this.api.remove(preset.id);
    this.saving.set(false);
    if (!outcome.success) {
      this.error.set(outcome.code);
      return;
    }
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      this.presets.set(await this.api.list());
    } catch {
      this.error.set('quote.error');
    } finally {
      this.loading.set(false);
    }
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving()) event.preventDefault();
  }
}
import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
