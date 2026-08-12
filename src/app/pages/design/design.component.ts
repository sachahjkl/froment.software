import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../i18n.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-design',
  standalone: true,
  imports: [Icon],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly i18n = inject(I18nService);
}
