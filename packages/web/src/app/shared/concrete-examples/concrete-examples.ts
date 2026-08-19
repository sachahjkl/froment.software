import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../i18n.service';
import { AnchorLink } from '../anchor-link/anchor-link';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-concrete-examples',
  imports: [AnchorLink, Icon],
  templateUrl: './concrete-examples.html',
  styleUrl: './concrete-examples.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConcreteExamples {
  protected readonly i18n = inject(I18nService);
  readonly anchor = input('cas-concrets');
  readonly context = input<'expertise' | 'examples'>('examples');
}
