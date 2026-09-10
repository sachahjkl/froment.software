import { DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type QuoteConditionPresetValue } from '@froment/contracts';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Breadcrumbs, type BreadcrumbItem } from '@shared/breadcrumbs/breadcrumbs';
import { workspaceTableParams, workspaceTableQuery } from '../configuration/workspace-table';
import { conditionTableOptions } from '../configuration/workspace-tables';

@Component({
  imports: [Button, Notice, FormField, RouterLink, PageHeader, Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-condition-editor',
  styleUrl: './condition-editor.scss',
  templateUrl: './condition-editor.html',
  host: {
    '[class.page-container]': '!dialog',
    '[class.editor-dialog]': '!!dialog',
    '(window:beforeunload)': 'beforeUnload($event)',
  },
})
export class ConditionEditor {
  protected readonly dialog = inject<DialogRef<QuoteConditionPresetValue>>(DialogRef, {
    optional: true,
  });
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuoteConditionPresetsApi);
  private readonly confirmation = inject(Confirmation);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly model = signal({ name: '', conditions: '' });
  protected readonly loading = signal(true);
  protected readonly ready = signal(false);
  protected readonly saving = signal(false);
  protected readonly completed = signal(false);
  protected readonly uncertain = signal(false);
  private readonly confirming = signal(false);
  private readonly preset = signal<QuoteConditionPresetValue | undefined>(undefined);
  protected readonly editing = computed(() => this.preset() !== undefined);
  protected readonly title = computed<TranslationKey>(() =>
    this.editing() ? 'configurationWorkspace.editCondition' : 'configurationWorkspace.newCondition',
  );
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: this.i18n.t('backOffice.configuration.title'), path: '/backoffice/configuration' },
    {
      label: this.i18n.t('backOffice.configuration.conditions'),
      path: '/backoffice/configuration/conditions',
      queryParams: this.backQuery(),
    },
  ]);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly presetForm = form(this.model, (path) => {
    disabled(
      path,
      () =>
        !this.ready() || this.loading() || this.saving() || this.completed() || this.uncertain(),
    );
    required(path.name);
    maxLength(path.name, 120);
    pattern(path.name, /\S/);
    required(path.conditions);
    maxLength(path.conditions, 2_000);
    pattern(path.conditions, /\S/);
  });
  private loadGeneration = 0;

  constructor() {
    if (this.dialog) {
      this.loading.set(false);
      this.ready.set(true);
      this.dialog.backdropClick
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.close());
      this.dialog.keydownEvents.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          void this.close();
        }
      });
      return;
    }
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  protected backQuery() {
    return workspaceTableParams(
      workspaceTableQuery(this.route.snapshot.queryParamMap, conditionTableOptions),
      conditionTableOptions,
    );
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving() || this.confirming()) return false;
    if (!this.uncertain() && !this.presetForm().dirty()) return true;
    this.confirming.set(true);
    try {
      return await this.confirmation.request(
        this.i18n.t(
          this.uncertain() ? 'referenceEditor.leaveUncertain' : 'referenceEditor.unsavedConditions',
        ),
      );
    } finally {
      this.confirming.set(false);
    }
  }

  protected async close(): Promise<void> {
    if (this.dialog && (await this.canDeactivate()) && !this.destroyRef.destroyed)
      this.dialog.close();
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.confirming() || this.uncertain() || this.presetForm().dirty())
      event.preventDefault();
  }

  protected invalid(field: 'name' | 'conditions'): boolean {
    return this.presetForm[field]().touched() && this.presetForm[field]().invalid();
  }

  protected async load(): Promise<void> {
    if (this.saving() || this.confirming() || this.uncertain()) return;
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.ready.set(false);
    this.completed.set(false);
    this.error.set(undefined);
    this.preset.set(undefined);
    this.model.set({ name: '', conditions: '' });
    this.presetForm().reset();
    const id = this.route.snapshot.paramMap.get('presetId');
    if (id === null) {
      this.ready.set(true);
      this.loading.set(false);
      return;
    }
    try {
      const presets = await this.api.list();
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      const preset = presets.find((item) => item.id === id);
      if (preset === undefined) {
        this.error.set('configurationWorkspace.notFound');
        return;
      }
      this.preset.set(preset);
      this.model.set({ name: preset.name, conditions: preset.conditions });
      this.presetForm().reset();
      this.ready.set(true);
    } catch {
      if (!this.destroyRef.destroyed && generation === this.loadGeneration)
        this.error.set('quote.error');
    } finally {
      if (generation === this.loadGeneration) this.loading.set(false);
    }
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (
      this.loading() ||
      this.saving() ||
      this.confirming() ||
      this.completed() ||
      this.uncertain() ||
      !this.ready()
    )
      return;
    if (this.presetForm().invalid()) {
      this.presetForm().markAsTouched();
      this.presetForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.presetForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      const generation = this.loadGeneration;
      const preset = this.preset();
      const request = { name: this.model().name.trim(), conditions: this.model().conditions };
      try {
        const outcome =
          preset === undefined
            ? await this.api.create(request)
            : await this.api.update(preset.id, request);
        if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
        if (!outcome.success) {
          if (!preset && outcome.code === 'quote.error') {
            this.uncertain.set(true);
            this.error.set('referenceEditor.conditionsUncertain');
          } else this.error.set(outcome.code);
          return;
        }
        this.preset.set(outcome.result);
        this.presetForm().reset();
        this.completed.set(true);
      } catch {
        if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
        this.uncertain.set(!preset);
        this.error.set(preset ? 'quote.error' : 'referenceEditor.conditionsUncertain');
      } finally {
        if (generation === this.loadGeneration) this.saving.set(false);
      }
      if (this.completed()) {
        if (this.dialog) this.dialog.close(this.preset());
        else
          await this.router.navigate(['/backoffice/configuration/conditions'], {
            queryParams: this.backQuery(),
          });
      }
    });
  }
}
