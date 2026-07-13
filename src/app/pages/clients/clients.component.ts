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
  protected readonly references: { name: string; sectorKey: TranslationKey }[] = [
    { name: 'Alstom', sectorKey: 'clients.context.alstom' },
    { name: 'AG2R La Mondiale', sectorKey: 'clients.context.ag2r' },
    { name: 'OGF', sectorKey: 'clients.context.ogf' },
  ];
}
