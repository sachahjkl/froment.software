import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../i18n.service';
import { Button } from '../../shared/button/button';
import { Icon } from '../../shared/icon/icon';
import { LinkButton } from '../../shared/link-button/link-button';

@Component({
  selector: 'app-design',
  standalone: true,
  imports: [Button, Icon, LinkButton],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly i18n = inject(I18nService);
}
