import { makeStateKey } from '@angular/core';
import type { ActivatedRouteSnapshot, Routes } from '@angular/router';

export type AppShell = 'public' | 'administrator' | 'client' | 'standalone';
export const APP_SHELL_STATE = makeStateKey<AppShell | undefined>('app-shell');

export const withShell = (shell: AppShell, routes: Routes): Routes =>
  routes.map((route) => ({ ...route, data: { ...route.data, shell } }));

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
