import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '@shared/button/button';

@Component({
  imports: [Button],
  selector: 'app-result-navigation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    nav {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding-block: var(--space-3);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    p {
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <nav [attr.aria-label]="label()">
      <p>{{ rangeLabel() }}</p>
      <div class="actions">
        <button appButton type="button" [disabled]="previousDisabled()" (click)="previous.emit()">
          {{ previousLabel() }}
        </button>
        <button appButton type="button" [disabled]="nextDisabled()" (click)="next.emit()">
          {{ nextLabel() }}
        </button>
      </div>
    </nav>
  `,
})
export class ResultNavigation {
  readonly label = input.required<string>();
  readonly rangeLabel = input.required<string>();
  readonly previousLabel = input.required<string>();
  readonly nextLabel = input.required<string>();
  readonly previousDisabled = input(true);
  readonly nextDisabled = input(true);
  readonly previous = output<void>();
  readonly next = output<void>();
}
