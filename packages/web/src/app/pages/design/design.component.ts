import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { ContactActions } from '@shared/contact-actions/contact-actions';
import { Icon } from '@shared/icon/icon';

@Component({
  selector: 'app-design',
  standalone: true,
  imports: [Button, ContactActions, Icon],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly i18n = inject(I18nService);
}
