import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonVariant } from '../button/button';

@Component({
  selector: 'a[appLinkButton]',
  imports: [],
  template: '<ng-content />',
  styleUrl: '../button/button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-button-variant]': 'variant()',
  },
})
export class LinkButton {
  readonly variant = input<ButtonVariant>('default');
}
