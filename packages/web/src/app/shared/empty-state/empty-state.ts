import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from '@shared/icon/icon';

@Component({
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-empty-state',
  styleUrl: './empty-state.scss',
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly icon = input<IconName>('folder');
  readonly title = input.required<string>();
}
