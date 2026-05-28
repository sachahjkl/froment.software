import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly references = ['Alstom', 'AG2R La Mondiale', 'OGF'];
}
