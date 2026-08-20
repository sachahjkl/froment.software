import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '@app/i18n.service';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly i18n = inject(I18nService);
  protected readonly currentYear = new Date().getFullYear();
}
