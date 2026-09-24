import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { NavigationProgress } from '../navigation-progress/navigation-progress';

@Component({
  selector: 'app-site-header',
  imports: [NavigationProgress, RouterLink],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  protected readonly i18n = inject(I18nService);
}
