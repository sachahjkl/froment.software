import type { ActivatedRouteSnapshot } from '@angular/router';

export const publicQuoteContextChanged = (
  current: ActivatedRouteSnapshot,
  next: ActivatedRouteSnapshot,
): boolean => current.fragment !== next.fragment;
