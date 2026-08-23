import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { I18nService } from '@app/i18n.service';

@Component({
  selector: 'app-configuration',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './configuration.html',
  styleUrl: './configuration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuration {
  protected readonly i18n = inject(I18nService);
}
