import { makeStateKey } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';

export type AppShell = 'public' | 'landing' | 'standalone';
export const APP_SHELL_STATE = makeStateKey<AppShell | undefined>('app-shell');

export function routeShell(root: ActivatedRouteSnapshot): AppShell {
  let shell: AppShell = 'public';
  let route: ActivatedRouteSnapshot | null = root;
  while (route) {
    const current: AppShell | undefined = route.data['shell'];
    if (current) shell = current;
    route = route.firstChild;
  }
  return shell;
}
