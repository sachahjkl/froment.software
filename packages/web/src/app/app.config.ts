import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';

import { routes } from './app.routes';
import { authenticationInterceptor } from './back-office/authentication-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authenticationInterceptor])),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
      withNavigationErrorHandler((error) => {
        const message = error.error instanceof Error ? error.error.message : String(error.error);
        if (!/chunk|dynamically imported module|importing a module script/i.test(message)) return;
        const lastReload = Number(sessionStorage.getItem('froment.chunk-reload'));
        if (Date.now() - lastReload < 10_000) return;
        sessionStorage.setItem('froment.chunk-reload', String(Date.now()));
        location.reload();
      }),
    ),
  ],
};
