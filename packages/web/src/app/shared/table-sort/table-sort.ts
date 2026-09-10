import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@app/i18n.service';

export type SortDirection = 'none' | 'ascending' | 'descending';

@Component({
  selector: 'button[appTableSort]',
  host: {
    type: 'button',
    '[attr.aria-label]':
      "i18n.tf(direction() === 'ascending' ? 'listControls.sortDescending' : 'listControls.sortAscending', { column: label() })",
  },
  template: `<span>{{ label() }}</span
    ><span class="sort-indicator" aria-hidden="true">{{
      direction() === 'ascending' ? '↑' : direction() === 'descending' ? '↓' : '↕'
    }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: inherit;
      gap: var(--space-2);
      min-block-size: var(--control-height);
      max-inline-size: 100%;
      padding: 0;
      border: 0;
      border-radius: var(--radius-xs);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: inherit;
      text-transform: inherit;
      cursor: pointer;
    }
    .sort-indicator {
      flex: none;
      font-size: var(--text-base);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableSort {
  protected readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  readonly direction = input<SortDirection>('none');
}
