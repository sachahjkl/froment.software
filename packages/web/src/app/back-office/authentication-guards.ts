import { inject, Injector } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

export const administratorGuard: CanActivateFn = async () => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { Authentication } = await import('./authentication');
  const auth = injector.get(Authentication);
  if ((await auth.sessionMode()) === 'administrator') return true;
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
