import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly showBackLink = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => (this.route.firstChild?.snapshot.url.length ?? 0) > 0),
    ),
    { initialValue: false },
  );
}
