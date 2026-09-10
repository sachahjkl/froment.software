import { Dialog, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

export interface PickerOption {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
}

@Component({
  selector: 'app-object-picker',
  imports: [Button, Icon, FormField, SearchHighlight],
  providers: [SearchHighlightRegistry],
  templateUrl: './object-picker.html',
  styleUrl: './object-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectPicker {
  readonly label = input.required<string>();
  readonly options = input.required<readonly PickerOption[]>();
  readonly disabled = input(false);
  readonly selected = output<string>();
  protected readonly i18n = inject(I18nService);
  private readonly dialogs = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly content = viewChild.required<TemplateRef<unknown>>('content');
  private readonly trigger = viewChild.required('trigger', { read: ElementRef<HTMLButtonElement> });
  private readonly query = signal('');
  protected readonly search = form(this.query);
  private readonly results = createFuzzySearch(this.options, this.query, {
    keys: ['label', 'detail'],
    ignoreLocation: true,
    ignoreDiacritics: true,
    includeMatches: true,
    threshold: 0.35,
  });
  protected readonly matches = computed(() =>
    this.results().map((result) => ({
      item: result.item,
      indices: result.matches?.find((match) => match.key === 'label')?.indices ?? [],
    })),
  );
  private dialog: DialogRef | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.dialog?.close());
  }

  protected open(): void {
    if (this.disabled() || this.dialog) return;
    this.query.set('');
    const dialog = this.dialogs.open(this.content(), {
      ariaLabel: this.label(),
      autoFocus: 'input',
      restoreFocus: true,
      disableAnimations: true,
      width: '36rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.dialog = dialog;
    dialog.closed.subscribe(() => {
      this.dialog = undefined;
    });
  }

  protected choose(id: string): void {
    if (this.disabled() || !this.options().some((option) => option.id === id)) return;
    this.dialog?.close();
    this.selected.emit(id);
  }

  protected close(): void {
    this.dialog?.close();
  }
  focus(): void {
    this.trigger().nativeElement.focus();
  }
}
