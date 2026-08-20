import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  type QuoteConditionPresetListValue,
  type QuoteConditionPresetValue,
  type UlidValue,
} from '@froment/contracts';

import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { DataTable } from '@shared/data-table/data-table';
import { Button } from '@shared/button/button';

interface PresetModel {
  readonly name: string;
  readonly conditions: string;
}

const emptyModel = (): PresetModel => ({ name: '', conditions: '' });

@Component({
  selector: 'app-quote-condition-presets',
  imports: [DataTable, Button, FormField, RouterLink],
  templateUrl: './quote-condition-presets.html',
  styleUrl: './quote-condition-presets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteConditionPresets {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuoteConditionPresetsApi);
  private readonly model = signal<PresetModel>(emptyModel());
  protected readonly presetForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
    pattern(path.name, /\S/);
    required(path.conditions);
    maxLength(path.conditions, 2_000);
    pattern(path.conditions, /\S/);
  });
  protected readonly presets = signal<QuoteConditionPresetListValue>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly selectedId = signal<UlidValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly editing = computed(() => this.selectedId() !== undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  canDeactivate(): boolean {
    return (
      !this.presetForm().dirty() ||
      globalThis.confirm(this.i18n.t('backOffice.quote.unsavedChanges'))
    );
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
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
      if (await this.load()) this.cancel();
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
    if (!globalThis.confirm(this.i18n.t('backOffice.conditionPresets.deleteConfirmation'))) return;
    const outcome = await this.api.remove(preset.id);
    if (!outcome.success) {
      this.error.set(outcome.code);
      return;
    }
    if (this.selectedId() === preset.id) this.cancel();
    await this.load();
  }

  private async load(): Promise<boolean> {
    try {
      this.presets.set(await this.api.list());
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
}
