import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { I18nService } from '@app/i18n.service';

@Component({
  host: { class: 'page-container' },
  selector: 'app-configuration',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './configuration.html',
  styleUrl: './configuration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuration {
  protected readonly i18n = inject(I18nService);
}
