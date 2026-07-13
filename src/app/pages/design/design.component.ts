import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-design',
  standalone: true,
  templateUrl: './design.component.html',
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly i18n = inject(I18nService);
}
