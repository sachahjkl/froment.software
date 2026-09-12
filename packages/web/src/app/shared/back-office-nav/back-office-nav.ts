import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Icon, type IconName } from '@shared/icon/icon';
import { Authentication } from '@backoffice/authentication';
import type { PermissionCodeValue } from '@froment/contracts';

interface NavigationItem {
  path: string;
  label: TranslationKey;
  icon: IconName;
  prefixes: readonly string[];
  permissions: readonly PermissionCodeValue[];
}

const activityItems: readonly NavigationItem[] = [
  {
    path: 'dashboard',
    permissions: ['client.read', 'quote.read', 'order.read', 'invoice.read'],
    label: 'backOffice.navigation.dashboard',
    icon: 'dashboard',
    prefixes: ['dashboard'],
  },
  {
    path: 'clients',
    permissions: ['client.read'],
    label: 'backOffice.navigation.clients',
    icon: 'clients',
    prefixes: ['clients'],
  },
  {
    path: 'suppliers',
    permissions: ['supplier.read'],
    label: 'backOffice.navigation.suppliers',
    icon: 'catalog',
    prefixes: ['suppliers'],
  },
  {
    path: 'purchases',
    permissions: ['supplier-invoice.read'],
    label: 'backOffice.navigation.purchases',
    icon: 'invoice',
    prefixes: ['purchases'],
  },
  {
    path: 'affairs',
    permissions: ['quote.read', 'order.read', 'invoice.read'],
    label: 'backOffice.navigation.affairs',
    icon: 'folder',
    prefixes: ['affairs', 'quotes', 'orders'],
  },
  {
    path: 'billing',
    permissions: ['invoice.read'],
    label: 'backOffice.navigation.billing',
    icon: 'invoice',
    prefixes: ['billing', 'invoices'],
  },
  {
    path: 'banking',
    permissions: ['bank.read'],
    label: 'bank.title',
    icon: 'bank',
    prefixes: ['banking'],
  },
  {
    path: 'emails',
    permissions: ['email.draft.manage'],
    label: 'emails.title',
    icon: 'mail',
    prefixes: ['emails'],
  },
  {
    path: 'catalog',
    permissions: ['catalog.read'],
    label: 'catalog.title',
    icon: 'catalog',
    prefixes: ['catalog'],
  },
];

const administrationItems: readonly NavigationItem[] = [
  {
    path: 'team',
    permissions: ['user.read'],
    label: 'team.title',
    icon: 'clients',
    prefixes: ['team'],
  },
  {
    path: 'api',
    permissions: ['api-token.manage'],
    label: 'backOfficeShell.apiAccess',
    icon: 'development',
    prefixes: ['api'],
  },
  {
    path: 'services',
    permissions: ['integration.configure'],
    label: 'backOfficeShell.externalServices',
    icon: 'infrastructure',
    prefixes: ['services'],
  },
  {
    path: 'audit',
    permissions: ['audit.read'],
    label: 'backOfficeShell.audit',
    icon: 'book',
    prefixes: ['audit'],
  },
  {
    path: 'configuration',
    permissions: ['issuer.read'],
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
  private readonly authentication = inject(Authentication);
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
    return groups
      .map((group) => ({
        label: group.label,
        items: group.items
          .filter((item) =>
            item.permissions.every((permission) => this.authentication.can(permission)),
          )
          .map((item) => ({ ...item, active: item.prefixes.some(matches) })),
      }))
      .filter((group) => group.items.length > 0);
  });
}
