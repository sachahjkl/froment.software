import { Component, inject } from '@angular/core';
import { I18nService, TranslationKey } from '../../i18n.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly sectorKeys: TranslationKey[] = [
    'clients.sector.industry',
    'clients.sector.insurance',
    'clients.sector.services',
  ];
}
