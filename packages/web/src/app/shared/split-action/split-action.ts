import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActionMenu, type MenuAction } from '@shared/action-menu/action-menu';
import { Button, type ButtonVariant } from '@shared/button/button';

@Component({
  imports: [ActionMenu, Button],
  selector: 'app-split-action',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      align-items: stretch;
      max-inline-size: 100%;
    }
    .primary {
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }
    app-action-menu {
      --action-menu-start-radius: 0;
      margin-inline-start: -1px;
    }
    .primary:focus-visible {
      position: relative;
      z-index: 1;
    }
  `,
  template: `
    <button
      appButton
      class="primary"
      type="button"
      [variant]="variant()"
      [disabled]="primaryDisabled()"
      (click)="primaryAction.emit()"
    >
      {{ primaryLabel() }}
    </button>
    <app-action-menu
      [label]="menuLabel()"
      [actions]="actions()"
      [iconOnly]="true"
      [variant]="variant()"
      [disabled]="menuDisabled()"
      (actionSelected)="actionSelected.emit($event)"
    />
  `,
})
export class SplitAction {
  readonly primaryLabel = input.required<string>();
  readonly menuLabel = input.required<string>();
  readonly actions = input.required<readonly MenuAction[]>();
  readonly primaryDisabled = input(false);
  readonly menuDisabled = input(false);
  readonly variant = input<ButtonVariant>('primary');
  readonly primaryAction = output<void>();
  readonly actionSelected = output<string>();
}
