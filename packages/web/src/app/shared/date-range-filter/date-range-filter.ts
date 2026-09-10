import { _IdGenerator } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { CalendarDate } from '@froment/contracts';
import { Schema } from 'effect';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

export interface DateRange {
  readonly from?: string;
  readonly to?: string;
}

@Component({
  imports: [Button, FormField],
  selector: 'app-date-range-filter',
  styleUrl: './date-range-filter.scss',
  templateUrl: './date-range-filter.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateRangeFilter implements OnInit {
  readonly from = input<string>();
  readonly to = input<string>();
  readonly rangeApplied = output<DateRange>();
  protected readonly i18n = inject(I18nService);
  protected readonly id = inject(_IdGenerator).getId('date-range-filter-');
  private readonly draft = signal({ from: '', to: '' });
  protected readonly rangeForm = form(this.draft, (path) => {
    validate(path.from, ({ value }) =>
      value() === '' || Schema.is(CalendarDate)(value()) ? undefined : { kind: 'calendarDate' },
    );
    validate(path.to, ({ value, valueOf }) => {
      const to = value();
      if (to === '') return undefined;
      if (!Schema.is(CalendarDate)(to)) return { kind: 'calendarDate' };
      const from = valueOf(path.from);
      return Schema.is(CalendarDate)(from) && to < from ? { kind: 'dateOrder' } : undefined;
    });
  });

  ngOnInit(): void {
    // Conservez le brouillon si le parent refuse la mise à jour.
    this.rangeForm().reset({ from: this.from() ?? '', to: this.to() ?? '' });
  }

  protected error(field: 'from' | 'to'): string | undefined {
    const state = this.rangeForm[field]();
    if (!state.touched() || !state.invalid()) return undefined;
    return this.i18n.t(
      state.errors().some((error) => error.kind === 'dateOrder')
        ? 'dateRangeFilter.invalidOrder'
        : 'dateRangeFilter.invalidDate',
    );
  }

  protected apply(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.rangeForm, {
      action: async () => {
        const { from, to } = this.draft();
        this.rangeApplied.emit({ from: from || undefined, to: to || undefined });
      },
      onInvalid: () => {
        const field = this.rangeForm.from().invalid() ? this.rangeForm.from : this.rangeForm.to;
        field().focusBoundControl();
      },
    });
  }

  protected clear(): void {
    this.rangeForm.from().focusBoundControl();
    this.rangeForm().reset({ from: '', to: '' });
    this.rangeApplied.emit({ from: undefined, to: undefined });
  }
}
