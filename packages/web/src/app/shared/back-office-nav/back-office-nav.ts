import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Icon, type IconName } from '@shared/icon/icon';

interface NavigationItem {
  path: string;
  label: TranslationKey;
  icon: IconName;
  prefixes: readonly string[];
}

const activityItems: readonly NavigationItem[] = [
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
    prefixes: ['affaires', 'quotes', 'orders'],
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
    path: 'catalogue',
    label: 'catalog.title',
    icon: 'catalog',
    prefixes: ['catalogue'],
  },
];

const administrationItems: readonly NavigationItem[] = [
  { path: 'equipe', label: 'team.title', icon: 'clients', prefixes: ['equipe'] },
  { path: 'api', label: 'backOfficeShell.apiAccess', icon: 'development', prefixes: ['api'] },
  {
    path: 'services',
    label: 'backOfficeShell.externalServices',
    icon: 'infrastructure',
    prefixes: ['services'],
  },
  { path: 'audit', label: 'backOfficeShell.audit', icon: 'book', prefixes: ['audit'] },
  {
    path: 'configuration',
    label: 'backOffice.navigation.configuration',
    icon: 'settings',
    prefixes: ['configuration'],
  },
];

const groups = [
  { label: 'backOfficeShell.activity', items: activityItems },
  { label: 'backOfficeShell.administration', items: administrationItems },
] as const;

@Component({
  selector: 'app-back-office-nav',
  imports: [RouterLink, Icon],
  template: `
    <nav [attr.aria-label]="i18n.t('backOffice.navigation.label')">
      @for (group of navigation(); track group.label) {
        <section [attr.aria-label]="i18n.t(group.label)">
          <p class="group-label" aria-hidden="true">{{ i18n.t(group.label) }}</p>
          <ul>
            @for (item of group.items; track item.path) {
              <li>
                <a
                  [routerLink]="'/backoffice/' + item.path"
                  [class.active]="item.active"
                  [attr.aria-current]="item.active ? 'page' : null"
                >
                  <app-icon [name]="item.icon" />{{ i18n.t(item.label) }}
                </a>
              </li>
            }
          </ul>
        </section>
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
    return groups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({ ...item, active: item.prefixes.some(matches) })),
    }));
  });
}
