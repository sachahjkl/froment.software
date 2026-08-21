import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatusBlockVariant = 'primary' | 'success' | 'danger';

@Component({
  selector: '[appStatusBlock]',
  template: '<ng-content />',
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5);
      border: 1px solid var(--status-color);
      border-left-width: 4px;
      background: color-mix(in oklab, var(--status-color) 8%, var(--color-surface-raised));
    }
  `,
  host: {
    '[style.--status-color]': 'color()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBlock {
  readonly variant = input<StatusBlockVariant>('primary');

  protected color(): string {
    switch (this.variant()) {
      case 'success':
        return 'var(--color-success)';
      case 'danger':
        return 'var(--color-danger)';
      default:
        return 'var(--color-button-primary-highlight)';
    }
  }
}
