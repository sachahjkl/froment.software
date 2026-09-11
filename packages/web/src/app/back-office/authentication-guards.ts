import { inject, Injector } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateChildFn,
  type CanActivateFn,
  type Data,
  Router,
} from '@angular/router';
import type { PermissionCodeValue } from '@froment/contracts';
import type { Authentication } from './authentication';

export interface PermissionRouteData {
  readonly access: 'permissions';
  readonly permissions: readonly [PermissionCodeValue, ...PermissionCodeValue[]];
}

export interface SessionRouteData {
  readonly access: 'session';
}

export const sessionData = (): SessionRouteData => ({ access: 'session' });

export const permissionData = (
  ...permissions: [PermissionCodeValue, ...PermissionCodeValue[]]
): PermissionRouteData => ({
  access: 'permissions',
  permissions,
});

const permits = async (authentication: Authentication, data: Data) => {
  const required: unknown = data['permissions'];
  const [{ PermissionCode }, { Schema }] = await Promise.all([
    import('@froment/contracts'),
    import('effect'),
  ]);
  return (
    authentication.account()?.mode === 'administrator' &&
    data['access'] === 'permissions' &&
    Schema.is(Schema.Array(PermissionCode).check(Schema.isMinLength(1)))(required) &&
    required.every((code) => authentication.can(code))
  );
};

const declaredAccess = (route: ActivatedRouteSnapshot): readonly Data[] =>
  route.pathFromRoot
    .map((parent) => parent.routeConfig?.data ?? parent.data)
    .filter((data) => data['access'] !== undefined || data['permissions'] !== undefined);

const accessGuard: CanActivateFn = async (route) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { Authentication } = await import('./authentication');
  const auth = injector.get(Authentication);
  if ((await auth.sessionMode()) !== 'administrator')
    return router.createUrlTree(['/backoffice/login']);
  const account = await auth.currentAccount();
  if (account?.mode !== 'administrator') return router.createUrlTree(['/backoffice/login']);
  const declarations = declaredAccess(route);
  if (
    declarations.length > 0 &&
    (
      await Promise.all(
        declarations.map(
          (data) =>
            (data['access'] === 'session' && data['permissions'] === undefined) ||
            permits(auth, data),
        ),
      )
    ).every(Boolean)
  )
    return true;
  return router.createUrlTree(['/backoffice/account']);
};

export const administratorGuard: CanActivateFn = accessGuard;
export const permissionsGuard: CanActivateFn = accessGuard;
export const administratorChildGuard: CanActivateChildFn = accessGuard;

export const clientGuard: CanActivateFn = async (_route, state) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { Authentication } = await import('./authentication');
  const auth = injector.get(Authentication);
  if ((await auth.sessionMode()) === 'client') return true;
  return router.createUrlTree(['/backoffice/login'], {
    queryParams: { returnUrl: state.url },
  });
};
