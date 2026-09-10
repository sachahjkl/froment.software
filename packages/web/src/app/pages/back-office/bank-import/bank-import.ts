import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import {
  type BankImportPreview,
  type BankImportRequestValue,
  type BankImportResult,
} from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { BankingApi } from '@backoffice/banking-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TableSort } from '@shared/table-sort/table-sort';
import { bankQuery, bankQueryParams, previewColumns } from '../banking/bank-workspace';
import {
  bankTableSort,
  bankSortDirection,
  compareBankRows,
  nextBankSort,
} from '../banking/bank-table-sort';

@Component({
  selector: 'app-bank-import',
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [
    Button,
    DataTable,
    FormField,
    LocalizedDatePipe,
    Notice,
    PageHeader,
    RouterLink,
    TableSort,
  ],
  templateUrl: './bank-import.html',
  styleUrl: './bank-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankImport {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(Confirmation);
  protected readonly busy = signal(false);
  protected readonly reading = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly filename = signal('');
  protected readonly preview = signal<typeof BankImportPreview.Type | undefined>(undefined);
  protected readonly result = signal<typeof BankImportResult.Type | undefined>(undefined);
  protected readonly stageLabel = computed<TranslationKey>(() => {
    if (this.result()) return 'bankWorkspace.doneStep';
    return this.preview() ? 'bankWorkspace.reviewStep' : 'bankWorkspace.fileStep';
  });
  protected readonly columns = previewColumns;
  protected readonly previewSort = computed(() =>
    bankTableSort(this.params().get('previewSort'), previewColumns),
  );
  protected readonly previewRows = computed(() =>
    (this.preview()?.rows ?? []).toSorted(
      compareBankRows(
        this.previewSort(),
        previewColumns,
        this.i18n.language(),
        (row) => row.reference,
      ),
    ),
  );
  private readonly model = signal({
    account: this.route.snapshot.queryParamMap.get('account') ?? '',
    csv: '',
  });
  protected readonly importForm = form(this.model, (path) => {
    required(path.account);
    pattern(path.account, /\S/);
    maxLength(path.account, 100);
    required(path.csv);
    maxLength(path.csv, 500000);
    disabled(path, () => this.busy() || this.reading() || this.preview() !== undefined);
  });
  protected readonly backQuery = bankQueryParams(bankQuery(this.route.snapshot.queryParamMap));
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('statementFile');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private prepared: BankImportRequestValue | undefined;
  private fileGeneration = 0;

  constructor() {
    afterRenderEffect(() => {
      if (this.preview() || this.result()) this.stage()?.nativeElement.focus();
    });
  }

  protected async readFile(input: HTMLInputElement): Promise<void> {
    if (this.busy()) return;
    const generation = ++this.fileGeneration;
    this.preview.set(undefined);
    this.prepared = undefined;
    this.result.set(undefined);
    this.model.update((model) => ({ ...model, csv: '' }));
    this.filename.set('');
    this.error.set(undefined);
    const file = input.files?.[0];
    if (!file || file.size === 0 || file.size > 500000) {
      this.reading.set(false);
      this.error.set('bankWorkspace.fileInvalid');
      return;
    }
    this.reading.set(true);
    try {
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (generation !== this.fileGeneration || this.destroyRef.destroyed) return;
      this.model.update((model) => ({ ...model, csv }));
      this.filename.set(file.name);
    } catch {
      if (generation === this.fileGeneration && !this.destroyRef.destroyed)
        this.error.set('bankWorkspace.fileInvalid');
    } finally {
      if (generation === this.fileGeneration && !this.destroyRef.destroyed) this.reading.set(false);
    }
  }
  protected validate(event: SubmitEvent): void {
    event.preventDefault();
    if (this.busy() || this.reading() || this.preview()) return;
    this.importForm().markAsTouched();
    if (this.importForm.account().invalid()) {
      this.importForm.account().focusBoundControl();
      return;
    }
    if (this.importForm.csv().invalid()) {
      this.error.set('bankWorkspace.fileInvalid');
      this.fileInput()?.nativeElement.focus();
      return;
    }
    void submit(this.importForm, async () => {
      const request = { account: this.model().account.trim(), csv: this.model().csv };
      this.busy.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.api.previewStatement(request);
        if (this.destroyRef.destroyed) return;
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.prepared = request;
        this.preview.set(outcome.result);
      } catch {
        if (!this.destroyRef.destroyed) this.error.set('bank.error');
      } finally {
        if (!this.destroyRef.destroyed) this.busy.set(false);
      }
    });
  }
  protected async confirm(): Promise<void> {
    const request = this.prepared;
    if (!request || !this.preview() || this.busy()) return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.importStatement(request);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.result.set(outcome.result);
      this.preview.set(undefined);
      this.prepared = undefined;
      this.importForm().reset({ account: request.account, csv: '' });
      this.filename.set('');
    } catch {
      if (!this.destroyRef.destroyed) this.error.set('bank.error');
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  protected edit(): void {
    if (!this.busy()) {
      this.preview.set(undefined);
      this.prepared = undefined;
    }
  }
  protected again(): void {
    if (!this.busy()) this.result.set(undefined);
  }
  protected sortDirection(column: string) {
    return bankSortDirection(this.previewSort(), column);
  }
  protected sortBy(column: string): void {
    const sort = nextBankSort(this.previewSort(), column);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { previewSort: sort === 'none' ? null : sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  private unsaved(): boolean {
    return (
      !this.result() &&
      (this.importForm().dirty() || this.model().csv !== '' || this.preview() !== undefined)
    );
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.busy() &&
      !this.reading() &&
      (!this.unsaved() || (await this.confirmation.request(this.i18n.t('bankWorkspace.unsaved'))))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.reading() || this.unsaved()) event.preventDefault();
  }
}
