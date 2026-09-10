import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '@shared/button/button';

@Component({
  imports: [Button],
  selector: 'app-bulk-selection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': 'count() === 0' },
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      padding-block: var(--space-3);
      border-block: 1px solid var(--color-line-strong);
    }
    :host([hidden]) {
      display: none;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-inline-start: auto;
    }
  `,
  template: `
    <p>{{ selectionLabel() }}</p>
    <div class="actions">
      <ng-content />
      <button appButton type="button" (click)="clearSelection.emit()">{{ clearLabel() }}</button>
    </div>
  `,
})
export class BulkSelection {
  readonly count = input.required<number>();
  readonly selectionLabel = input.required<string>();
  readonly clearLabel = input.required<string>();
  readonly clearSelection = output<void>();
}
