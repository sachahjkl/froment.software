import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Button, type ButtonVariant } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';

export interface MenuAction {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly danger?: boolean;
}

@Component({
  selector: 'app-action-menu',
  imports: [Button, CdkMenu, CdkMenuItem, CdkMenuTrigger, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      min-inline-size: 0;
    }
    .trigger {
      border-start-start-radius: var(--action-menu-start-radius, var(--radius-md));
      border-end-start-radius: var(--action-menu-start-radius, var(--radius-md));
    }
    .trigger.more-trigger {
      --icon-color: var(--color-ink);
      color: var(--color-ink);
      text-decoration: none;
      border-radius: var(--radius-sm);
    }
    .trigger.more-trigger:is(:focus-visible, [aria-expanded='true']) {
      background: var(--color-surface-sunken);
    }
    .menu {
      display: grid;
      min-inline-size: 12rem;
      max-inline-size: min(24rem, calc(100vw - 2rem));
      padding: var(--space-1);
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-sm);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-page);
    }
    .item {
      min-block-size: var(--control-height);
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-xs);
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      text-align: start;
      overflow-wrap: anywhere;
      cursor: pointer;
    }
    .item[data-danger='true'] {
      color: var(--color-danger);
    }
    .item:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
    .item[aria-disabled='true'] {
      cursor: not-allowed;
      opacity: 0.6;
    }
    @media (hover: hover) {
      .trigger.more-trigger:hover:not(:disabled) {
        background: var(--color-surface-sunken);
      }
      .item:hover:not([aria-disabled='true']) {
        background: var(--color-surface-sunken);
      }
    }
  `,
  template: `
    <button
      appButton
      #trigger
      class="trigger"
      [class.more-trigger]="appearance() === 'more'"
      type="button"
      [variant]="triggerVariant()"
      [iconOnly]="iconOnly() || appearance() === 'more'"
      [disabled]="disabled() || actions().length === 0"
      [attr.aria-label]="label()"
      [cdkMenuTriggerFor]="menu"
    >
      @if (appearance() === 'more') {
        <app-icon name="more" />
      } @else {
        @if (!iconOnly()) {
          <span>{{ label() }}</span>
        }
        <span aria-hidden="true">▾</span>
      }
    </button>
    <ng-template #menu>
      <div cdkMenu class="menu" [attr.aria-label]="label()">
        @for (action of actions(); track action.id) {
          <button
            cdkMenuItem
            type="button"
            class="item"
            [cdkMenuItemDisabled]="action.disabled === true"
            [attr.data-danger]="action.danger === true"
            (cdkMenuItemTriggered)="select(action)"
          >
            {{ action.label }}
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class ActionMenu {
  private readonly menuTrigger = viewChild.required(CdkMenuTrigger);
  private readonly trigger = viewChild.required('trigger', { read: ElementRef<HTMLButtonElement> });
  readonly label = input.required<string>();
  readonly actions = input.required<readonly MenuAction[]>();
  readonly disabled = input(false);
  readonly iconOnly = input(false);
  readonly appearance = input<'button' | 'more'>('button');
  readonly variant = input<ButtonVariant>('default');
  protected readonly triggerVariant = computed(() =>
    this.appearance() === 'more' ? 'link' : this.variant(),
  );
  readonly actionSelected = output<string>();

  protected select(action: MenuAction): void {
    if (this.disabled() || action.disabled) return;
    // Restaurez le bouton avant qu’une action ouvre une autre fenêtre.
    this.menuTrigger().close();
    this.trigger().nativeElement.focus();
    this.actionSelected.emit(action.id);
  }
}
