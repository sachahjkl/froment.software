import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService, type TranslationKey } from '@app/i18n.service';

export type SortDirection = 'none' | 'ascending' | 'descending';

@Component({
  selector: 'button[appTableSort]',
  host: {
    type: 'button',
    '[attr.aria-label]': 'actionLabel()',
    '[attr.title]': 'actionLabel()',
  },
  template: `<span>{{ label() }}</span
    ><span class="sort-indicator" aria-hidden="true">{{ indicator() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: inherit;
      gap: var(--space-2);
      min-block-size: 2rem;
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
    @media (pointer: coarse) {
      :host {
        min-block-size: 2.75rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableSort {
  protected readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  readonly direction = input<SortDirection>('none');
  protected readonly indicator = computed(() => {
    const indicators = {
      none: '↕',
      ascending: '↑',
      descending: '↓',
    } satisfies Record<SortDirection, string>;
    return indicators[this.direction()];
  });
  protected readonly actionLabel = computed(() => {
    const actions = {
      none: 'listControls.sortAscending',
      ascending: 'listControls.sortDescending',
      descending: 'listControls.resetSort',
    } satisfies Record<SortDirection, TranslationKey>;
    return this.i18n.tf(actions[this.direction()], { column: this.label() });
  });
}
