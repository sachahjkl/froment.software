import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { Button } from '@shared/button/button';
import { Hint } from '@shared/hint/hint';
import { Icon } from '@shared/icon/icon';
import { serializeCsv, type CsvCell } from './csv';

@Component({
  imports: [Button, Hint, Icon],
  selector: 'app-table-export',
  styleUrl: './table-export.scss',
  templateUrl: './table-export.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableExport {
  readonly columns = input.required<readonly string[]>();
  readonly rows = input.required<readonly (readonly CsvCell[])[]>();
  readonly filename = input.required<string>();
  readonly label = input.required<string>();
  readonly emptyHint = input.required<string>();
  readonly pendingHint = input.required<string>();
  readonly pending = input(false);
  protected readonly unavailable = computed(() => this.pending() || this.rows().length === 0);
  protected readonly hintText = computed(() => {
    if (this.pending()) return this.pendingHint();
    return this.rows().length === 0 ? this.emptyHint() : this.label();
  });
  private readonly document = inject(DOCUMENT);
  private readonly downloads = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const [url, timer] of this.downloads) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      this.downloads.clear();
    });
  }

  protected download(): void {
    if (this.unavailable()) return;
    const blob = new Blob([serializeCsv(this.columns(), this.rows())], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    // Laissez le navigateur démarrer le téléchargement avant de libérer son URL.
    this.downloads.set(
      url,
      setTimeout(() => {
        URL.revokeObjectURL(url);
        this.downloads.delete(url);
      }, 1000),
    );
    const link = this.document.createElement('a');
    link.href = url;
    link.download = this.filename();
    link.hidden = true;
    this.document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  }
}
