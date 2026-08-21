import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'dark'
  | 'link';

@Component({
  selector: 'button[appButton], a[appLinkButton]',
  imports: [],
  template: '<ng-content />',
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-button-variant]': 'variant()',
    '[attr.data-button-icon-only]': "iconOnly() ? '' : null",
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('default');
  readonly iconOnly = input(false);
}
