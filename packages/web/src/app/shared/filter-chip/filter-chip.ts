import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Icon } from '@shared/icon/icon';

@Component({
  selector: 'button[appFilterChip]',
  imports: [Icon],
  host: {
    type: 'button',
    '[attr.aria-label]': "i18n.tf('listControls.removeFilter', { filter: label() })",
  },
  template: `<span>{{ label() }}</span
    ><app-icon name="close" />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-block-size: var(--control-height);
      max-inline-size: 100%;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-sm);
      background: var(--color-surface-raised);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--text-sm);
      text-align: start;
      cursor: pointer;
    }
    span {
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    app-icon {
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChip {
  protected readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
}
