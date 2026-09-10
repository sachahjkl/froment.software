import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from '@shared/icon/icon';

export type EntityIconVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';

@Component({
  imports: [Icon],
  selector: 'app-entity-icon',
  styleUrl: './entity-icon.scss',
  templateUrl: './entity-icon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-entity-variant]': 'variant()',
  },
})
export class EntityIcon {
  readonly icon = input.required<IconName>();
  readonly variant = input<EntityIconVariant>('default');
}
