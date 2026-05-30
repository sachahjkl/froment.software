import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-legal',
  standalone: true,
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.scss',
})
export class LegalComponent {
  protected readonly i18n = inject(I18nService);
}
