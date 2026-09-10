import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigurationIndex } from './configuration-index';
import { configurationRoutes } from './configuration.routes';
import { accountRoutes } from '../account-security/account.routes';
import { teamRoutes } from '../team/team.routes';
import { apiTokenRoutes } from '../api-tokens/api-token.routes';
import { serviceRoutes } from '../connections/service.routes';
import { auditRoute } from './audit/audit.routes';
import { administratorGuard } from '@backoffice/authentication-guards';

describe('ConfigurationIndex', () => {
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
