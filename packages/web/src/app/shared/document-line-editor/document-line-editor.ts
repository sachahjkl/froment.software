import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { formatMoney } from '@froment/l10n';
import { I18nService } from '@app/i18n.service';
import { parseFixedDecimal } from '@backoffice/quote-input';
import { Button } from '@shared/button/button';

export interface DocumentLineEditValue {
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly vatRate: string;
}

interface DocumentLineDialogData {
  readonly line: DocumentLineEditValue;
  readonly number: number;
}

const emptyLine = (): DocumentLineEditValue => ({
  description: '',
  quantity: '1.000',
  unitPrice: '0.00',
  vatRate: '20.00',
});

@Component({
  selector: 'app-document-line-dialog',
  imports: [Button, FormField],
  templateUrl: './document-line-dialog.html',
  styleUrl: './document-line-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentLineDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<DocumentLineDialogData>(DIALOG_DATA);
  protected readonly dialog = inject<DialogRef<DocumentLineEditValue>>(DialogRef);
  private readonly value = signal(this.data.line);
  protected readonly lineForm = form(this.value, (path) => {
    required(path.description);
    maxLength(path.description, 160);
    pattern(path.description, /\S/);
    validate(path.quantity, ({ value }) => {
      const parsed = parseFixedDecimal(value(), 3);
      return parsed === undefined || parsed === 0 ? { kind: 'quantity' } : undefined;
    });
    validate(path.unitPrice, ({ value }) =>
      parseFixedDecimal(value(), 2) === undefined ? { kind: 'unitPrice' } : undefined,
    );
    validate(path.vatRate, ({ value }) => {
      const parsed = parseFixedDecimal(value(), 2);
      return parsed === undefined || parsed > 10_000 ? { kind: 'vatRate' } : undefined;
    });
  });

  protected save(event: Event): void {
    event.preventDefault();
    void submit(this.lineForm, async () => this.dialog.close(this.value()));
  }
}

@Component({
  selector: 'app-document-line-editor',
  imports: [Button],
  templateUrl: './document-line-editor.html',
  styleUrl: './document-line-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentLineEditor {
  protected readonly i18n = inject(I18nService);
  private readonly dialogs = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly lines = input.required<ReadonlyArray<DocumentLineEditValue>>();
  readonly currency = input.required<string>();
  readonly totals = input<ReadonlyArray<number>>([]);
  readonly disabled = input(false);
  readonly maximumLines = input(20);
  readonly linesChange = output<ReadonlyArray<DocumentLineEditValue>>();
  private activeDialog: DialogRef<DocumentLineEditValue, DocumentLineDialog> | undefined;
  private readonly touched = signal<ReadonlySet<string>>(new Set());
  protected readonly addDisabled = computed(
    () => this.disabled() || this.lines().length >= this.maximumLines(),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.activeDialog?.close());
  }

  protected add(): void {
    if (this.addDisabled()) return;
    this.linesChange.emit([...this.lines(), emptyLine()]);
  }

  protected remove(index: number): void {
    if (this.disabled() || this.lines().length === 1) return;
    this.touched.set(new Set());
    this.linesChange.emit(this.lines().filter((_line, current) => current !== index));
  }

  protected update(index: number, field: keyof DocumentLineEditValue, event: Event): void {
    const target = event.target;
    if (this.disabled() || !(target instanceof HTMLInputElement)) return;
    this.touched.update((current) => new Set([...current, `${index}:${field}`]));
    const lines = this.lines().map((line, current) =>
      current === index ? { ...line, [field]: target.value } : line,
    );
    this.linesChange.emit(lines);
  }

  protected invalid(field: keyof DocumentLineEditValue, value: string): boolean {
    if (field === 'description') return value.trim().length === 0 || value.length > 160;
    const decimals = field === 'quantity' ? 3 : 2;
    const parsed = parseFixedDecimal(value, decimals);
    if (parsed === undefined) return true;
    if (field === 'quantity') return parsed === 0;
    return field === 'vatRate' && parsed > 10_000;
  }

  protected showError(index: number, field: keyof DocumentLineEditValue, value: string): boolean {
    return this.touched().has(`${index}:${field}`) && this.invalid(field, value);
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), this.currency());
  }

  protected async edit(index: number): Promise<void> {
    if (this.disabled() || this.activeDialog !== undefined) return;
    const line = this.lines()[index];
    if (line === undefined) return;
    const dialog = this.dialogs.open<
      DocumentLineEditValue,
      DocumentLineDialogData,
      DocumentLineDialog
    >(DocumentLineDialog, {
      data: { line, number: index + 1 },
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: 'document-line-dialog-title',
      autoFocus: 'input',
      restoreFocus: true,
      hasBackdrop: true,
      disableClose: false,
      disableAnimations: true,
      width: '32rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.activeDialog = dialog;
    try {
      const updated = await firstValueFrom(dialog.closed, { defaultValue: undefined });
      if (updated !== undefined && !this.destroyRef.destroyed) {
        this.linesChange.emit(
          this.lines().map((current, currentIndex) => (currentIndex === index ? updated : current)),
        );
      }
    } finally {
      this.activeDialog = undefined;
    }
  }
}
