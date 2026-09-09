import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Icon, type IconName } from '@shared/icon/icon';

const items: readonly {
  path: string;
  label: TranslationKey;
  icon: IconName;
  prefixes: readonly string[];
}[] = [
  {
    path: 'dashboard',
    label: 'backOffice.navigation.dashboard',
    icon: 'dashboard',
    prefixes: ['dashboard'],
  },
  {
    path: 'clients',
    label: 'backOffice.navigation.clients',
    icon: 'clients',
    prefixes: ['clients'],
  },
  {
    path: 'affaires',
    label: 'backOffice.navigation.affairs',
    icon: 'folder',
    prefixes: ['affaires', 'quotes'],
  },
  {
    path: 'facturation',
    label: 'backOffice.navigation.billing',
    icon: 'invoice',
    prefixes: ['facturation', 'invoices'],
  },
  { path: 'banque', label: 'bank.title', icon: 'bank', prefixes: ['banque'] },
  { path: 'courriels', label: 'emails.title', icon: 'mail', prefixes: ['courriels'] },
  {
    path: 'configuration/catalogue',
    label: 'catalog.title',
    icon: 'catalog',
    prefixes: ['configuration/catalogue'],
  },
  {
    path: 'configuration',
    label: 'backOffice.navigation.configuration',
    icon: 'settings',
    prefixes: ['configuration'],
  },
];

@Component({
  selector: 'app-back-office-nav',
  imports: [RouterLink, Icon],
  template: `
    <nav [attr.aria-label]="i18n.t('backOffice.navigation.label')">
      @for (item of navigation(); track item.path) {
        <a
          [routerLink]="'/backoffice/' + item.path"
          [class.active]="item.active"
          [attr.aria-current]="item.active ? 'page' : null"
        >
          <app-icon [name]="item.icon" />{{ i18n.t(item.label) }}
        </a>
      }
    </nav>
  `,
  styleUrl: './back-office-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeNav {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly navigation = computed(() => {
    const path = this.url().split(/[?#]/, 1)[0];
    const matches = (prefix: string) =>
      path === `/backoffice/${prefix}` || path.startsWith(`/backoffice/${prefix}/`);
    return items.map((item) => ({
      ...item,
      active:
        item.prefixes.some(matches) &&
        !(item.path === 'configuration' && matches('configuration/catalogue')),
    }));
  });
}
