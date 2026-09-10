import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { disabled, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  type QuoteConditionPresetListValue,
  type QuoteConditionPresetValue,
  type UlidValue,
} from '@froment/contracts';

import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { DataTable } from '@shared/data-table/data-table';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { conditionTableOptions } from '../configuration/workspace-tables';

interface PresetModel {
  readonly name: string;
  readonly conditions: string;
}

const emptyModel = (): PresetModel => ({ name: '', conditions: '' });

@Component({
  selector: 'app-quote-condition-presets',
  imports: [
    Button,
    DataTable,
    RouterLink,
    Notice,
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
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuoteConditionPresetsApi);
  protected readonly model = signal<PresetModel>(emptyModel());
  protected readonly editor: boolean = false;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly presetForm = form(this.model, (path) => {
    disabled(path, () => this.loading() || this.saving());
    required(path.name);
    maxLength(path.name, 120);
    pattern(path.name, /\S/);
    required(path.conditions);
    maxLength(path.conditions, 2_000);
    pattern(path.conditions, /\S/);
  });
  protected readonly presets = signal<QuoteConditionPresetListValue>([]);
  protected readonly table = createWorkspaceTable(this.presets, conditionTableOptions);
  protected readonly conditionExport = computed(() =>
    this.table.rows().map((item) => [item.name, item.conditions]),
  );
  protected readonly loading = signal(true);
  protected readonly ready = signal(false);
  protected readonly saving = signal(false);
  protected readonly selectedId = signal<UlidValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly editing = computed(() => this.selectedId() !== undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
    return (
      !this.presetForm().dirty() ||
      (await this.confirmation.request(this.i18n.t('backOffice.quote.unsavedChanges')))
    );
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.loading() || this.saving() || !this.ready()) return;
    if (this.presetForm().invalid()) {
      this.presetForm().markAsTouched();
      this.presetForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.presetForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      const request = { name: this.model().name.trim(), conditions: this.model().conditions };
      const selectedId = this.selectedId();
      const outcome =
        selectedId === undefined
          ? await this.api.create(request)
          : await this.api.update(selectedId, request);
      this.saving.set(false);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.presetForm().reset();
      await this.router.navigate(['/backoffice/configuration/conditions'], {
        queryParams: this.table.params(),
      });
    });
  }

  protected edit(preset: QuoteConditionPresetValue): void {
    this.selectedId.set(preset.id);
    this.model.set({ name: preset.name, conditions: preset.conditions });
    this.presetForm().reset();
  }

  protected cancel(): void {
    this.selectedId.set(undefined);
    this.model.set(emptyModel());
    this.presetForm().reset();
    this.error.set(undefined);
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
    if (this.selectedId() === preset.id) this.cancel();
    await this.load();
  }

  protected async load(): Promise<boolean> {
    this.loading.set(true);
    this.ready.set(false);
    this.error.set(undefined);
    try {
      this.presets.set(await this.api.list());
      const id = this.route.snapshot.paramMap.get('presetId');
      if (this.editor && id !== null) {
        const preset = this.presets().find((item) => item.id === id);
        if (preset === undefined) {
          this.error.set('configurationWorkspace.notFound');
          return false;
        }
        this.edit(preset);
      }
      this.ready.set(true);
      return true;
    } catch {
      this.error.set('quote.error');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  protected invalid(field: keyof PresetModel): boolean {
    return this.presetForm[field]().touched() && this.presetForm[field]().invalid();
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.presetForm().dirty()) event.preventDefault();
  }
}
