import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { disabled, form, FormField, type FormValueControl } from '@angular/forms/signals';
import { Icon } from '@shared/icon/icon';

@Component({
  imports: [FormField, Icon],
  selector: 'app-list-search',
  styleUrl: './list-search.scss',
  templateUrl: './list-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListSearch implements FormValueControl<string> {
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly value = model('');
  readonly disabled = input(false);
  readonly touch = output<void>();
  protected readonly search = form(this.value, (path) => {
    disabled(path, () => this.disabled());
  });
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }
}
