import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { disabled, form, type FormValueControl } from '@angular/forms/signals';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { Icon } from '@shared/icon/icon';

export interface FilterChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
}

@Component({
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, Icon],
  selector: 'app-filter-choice',
  styleUrl: './filter-choice.scss',
  templateUrl: './filter-choice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChoice implements FormValueControl<string> {
  readonly label = input.required<string>();
  readonly emptyLabel = input.required<string>();
  readonly options = input.required<readonly FilterChoiceOption[]>();
  readonly value = model('');
  readonly disabled = input(false);
  readonly committed = output<string>();
  readonly touch = output<void>();
  protected readonly search = form(signal(''), (path) => disabled(path, () => this.disabled()));
  private readonly results = createFuzzySearch(this.options, this.search().value, {
    keys: ['label'],
    ignoreLocation: true,
    ignoreDiacritics: true,
    threshold: 0.3,
  });
  protected readonly matches = computed(() => this.results().map((result) => result.item));
  // La sélection du widget reste distincte de la valeur validée pendant une recherche.
  protected readonly selection = linkedSignal(() =>
    this.matches().some((option) => option.value === this.value()) ? [this.value()] : [],
  );
  private readonly combobox = viewChild(Combobox);
  private readonly listbox = viewChild<Listbox<string>>(Listbox);
  private readonly optionDirectives = viewChildren<Option<string>>(Option);

  constructor() {
    afterRenderEffect(() => this.listbox()?.scrollActiveItemIntoView());
  }

  focus(options?: FocusOptions): void {
    this.combobox()?.element.focus(options);
  }

  protected commitClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!this.optionDirectives().some((option) => option.element.contains(target))) return;
    this.commit();
  }

  protected commit(): void {
    if (this.disabled()) return;
    const activeId = this.listbox()?.activeDescendant();
    const option = this.optionDirectives().find((item) => item.id() === activeId);
    if (!option) return;
    const value = option.value();
    this.selection.set([value]);
    this.value.set(value);
    this.focus();
    this.touch.emit();
    this.committed.emit(value);
  }
}
