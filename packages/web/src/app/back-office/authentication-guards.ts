import { inject, Injector } from '@angular/core';
import { type CanActivateFn, type Data, Router } from '@angular/router';
import type { PermissionCodeValue } from '@froment/contracts';
import type { Authentication } from './authentication';

export const permissionData = (
  ...permissions: [PermissionCodeValue, ...PermissionCodeValue[]]
) => ({
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
    Schema.is(Schema.Array(PermissionCode).check(Schema.isMinLength(1)))(required) &&
    required.every((code) => authentication.can(code))
  );
};

export const permissionsGuard: CanActivateFn = async (route) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { Authentication } = await import('./authentication');
  const auth = injector.get(Authentication);
  if ((await auth.sessionMode()) !== 'administrator')
    return router.createUrlTree(['/backoffice/login']);
  const account = await auth.currentAccount();
  if (account?.mode === 'administrator' && (await permits(auth, route.data))) return true;
  return router.createUrlTree(['/backoffice/account']);
};

export const administratorGuard: CanActivateFn = async (route) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { Authentication } = await import('./authentication');
  const auth = injector.get(Authentication);
  if ((await auth.sessionMode()) === 'administrator') {
    const account = await auth.currentAccount();
    if (account?.mode === 'administrator') {
      if (route.data?.['permissions'] === undefined || (await permits(auth, route.data)))
        return true;
      return router.createUrlTree(['/backoffice/account']);
    }
  }
  return router.createUrlTree(['/backoffice/login']);
};

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
