import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';

@Component({
  imports: [Can, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-configuration-index',
  styleUrl: './configuration-index.scss',
  templateUrl: './configuration-index.html',
})
export class ConfigurationIndex {
  protected readonly i18n = inject(I18nService);
}
import { Can } from '@backoffice/can';
