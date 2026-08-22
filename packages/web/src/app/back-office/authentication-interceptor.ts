import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { BrowserSessionStore } from './browser-session-store';

const excluded = (url: string) =>
  url === '/api/auth/login' ||
  url === '/api/auth/refresh' ||
  url === '/api/auth/logout' ||
  url === '/api/bootstrap' ||
  url.startsWith('/api/public/') ||
  url === '/api/health' ||
  url === '/api/version';

export const authenticationInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(BrowserSessionStore);
  if (
    !request.url.startsWith('/api/') ||
    excluded(request.url) ||
    request.headers.has('Authorization')
  ) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }
      return from(store.refresh()).pipe(
        switchMap(() => {
          if (store.mode() === undefined) return throwError(() => error);
          return next(request);
        }),
      );
    }),
  );
};
