import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService, TranslationKey } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [AnchorLink],
  templateUrl: './clients.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
