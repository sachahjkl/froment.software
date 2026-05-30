import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  protected readonly i18n = inject(I18nService);
}
