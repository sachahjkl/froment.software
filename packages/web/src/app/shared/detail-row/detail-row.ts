import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'p[appDetailRow]',
  template: '<span>{{ label() }}</span><ng-content />',
  styles: `
    :host {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      padding-block: var(--space-2);
      border-bottom: 1px solid var(--color-line-strong);
    }

    span {
      color: var(--color-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailRow {
  readonly label = input.required<string>();
}
