import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Configuration } from './configuration';
import { ConfigurationIndex } from './configuration-index';
import { configurationRoutes } from './configuration.routes';
import { accountRoutes } from '../account-security/account.routes';
import { teamRoutes } from '../team/team.routes';
import { apiTokenRoutes } from '../api-tokens/api-token.routes';
import { serviceRoutes } from '../connections/service.routes';
import { auditRoute } from './audit/audit.routes';
import { administratorGuard } from '@backoffice/authentication-guards';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  imports: [PageHeader, RouterLink],
  template: `<app-page-header layout="stacked">
    <a pageBack routerLink="/configuration">Back to settings</a>
    <h1>Company</h1>
  </app-page-header>`,
})
class SettingsPage {}

describe('ConfigurationIndex', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('lets each child page own its return without adding an overview self-link', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'configuration',
            component: Configuration,
            children: [
              { path: '', component: ConfigurationIndex },
              { path: 'entreprise', component: SettingsPage },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/configuration', Configuration);
    expect(harness.routeNativeElement?.querySelector('[pageBack]')).toBeNull();
    await harness.navigateByUrl('/configuration/entreprise', Configuration);
    const links = harness.routeNativeElement?.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links?.[0]?.getAttribute('href')).toBe('/configuration');
    await harness.navigateByUrl('/configuration?q=ignored', Configuration);
    expect(harness.routeNativeElement?.querySelector('[pageBack]')).toBeNull();
  });
  it('guards every task route and keeps test creation ahead of request details', () => {
    const routes = [...configurationRoutes, ...teamRoutes, ...apiTokenRoutes, ...serviceRoutes];
    const paths = routes.map((route) => route.path);
    for (const path of [
      'conditions/new',
      'conditions/:presetId/edit',
      'backoffice/equipe/invitations/new',
      'backoffice/api/new',
      'backoffice/services/resend/tests/new',
      'backoffice/services/stripe/tests/new',
    ]) {
      expect(routes.find((route) => route.path === path)?.canDeactivate).toHaveLength(1);
    }
    expect(paths.indexOf('backoffice/services/resend/tests/new')).toBeLessThan(
      paths.indexOf('backoffice/services/resend/tests/:requestId'),
    );
    expect(paths.indexOf('backoffice/services/stripe/tests/new')).toBeLessThan(
      paths.indexOf('backoffice/services/stripe/tests/:requestId'),
    );
    expect(
      accountRoutes
        .filter((route) => route.loadComponent)
        .every((route) => route.canDeactivate?.length === 1),
    ).toBe(true);
  });
  it('separates team, API, services and audit into protected top-level routes', () => {
    expect(configurationRoutes.map(({ path }) => path)).toEqual([
      '',
      'entreprise',
      'conditions/new',
      'conditions/:presetId/edit',
      'conditions',
      'carte-de-visite',
    ]);
    expect(auditRoute.path).toBe('backoffice/audit');
    for (const route of [...teamRoutes, ...apiTokenRoutes, ...serviceRoutes, auditRoute]) {
      expect(route.canActivate).toEqual([administratorGuard]);
      expect(route.path).not.toContain('configuration/');
      expect(route.redirectTo).toBeUndefined();
    }
  });
  it('keeps only company and documents in configuration', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ConfigurationIndex);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.groups section')).toHaveLength(2);
    expect(root.querySelector('a[href$="carte-de-visite"]')).not.toBeNull();
    expect(root.querySelectorAll('a')).toHaveLength(3);
    for (const path of ['equipe', 'api', 'services', 'audit']) {
      expect(root.querySelector(`a[href$="${path}"]`)).toBeNull();
    }
    expect(root.querySelectorAll('h1')).toHaveLength(1);
  });
});
import { provideAccount } from '@backoffice/account.spec-helper';
