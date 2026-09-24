import { inject } from '@angular/core';
import { isSupportedLanguage, type Language } from '@froment/l10n';
import { CanMatchFn, RedirectCommand, ResolveFn, Router, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { policies } from './pages/policy/policy-documents';
import { I18nService } from './i18n.service';

export const languageCanMatch: CanMatchFn = (_route, segments) =>
  isSupportedLanguage(segments[0]?.path);

export const languageResolver: ResolveFn<Language> = (route) => {
  const language = route.paramMap.get('language');
  if (!isSupportedLanguage(language)) {
    return new RedirectCommand(inject(Router).parseUrl('/fr'));
  }

  inject(I18nService).setLanguage(language);
  return language;
};

const notFoundData = {
  titleKey: 'page.not_found' as const,
  descriptionKey: 'page.description.not_found' as const,
  robots: 'noindex, nofollow',
};

const localizedChildren: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeComponent,
    data: {
      shell: 'landing',
      titleKey: 'page.home',
      descriptionKey: 'page.description.home',
    },
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then((module) => module.AboutComponent),
    data: { titleKey: 'page.about', descriptionKey: 'page.description.about' },
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('./pages/clients/clients.component').then((module) => module.ClientsComponent),
    data: { titleKey: 'page.clients', descriptionKey: 'page.description.clients' },
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services/services.component').then((module) => module.ServicesComponent),
    data: { titleKey: 'page.services', descriptionKey: 'page.description.services' },
  },
  {
    path: 'services/audit-renovation',
    loadComponent: () =>
      import('./pages/service-detail/service-detail').then((module) => module.ServiceDetail),
    data: {
      offer: 'renovation',
      titleKey: 'page.service.renovation',
      descriptionKey: 'page.description.service.renovation',
    },
  },
  {
    path: 'services/development',
    loadComponent: () =>
      import('./pages/service-detail/service-detail').then((module) => module.ServiceDetail),
    data: {
      offer: 'development',
      titleKey: 'page.service.development',
      descriptionKey: 'page.description.service.development',
    },
  },
  {
    path: 'tools',
    loadComponent: () =>
      import('./pages/tools/tools.component').then((module) => module.ToolsComponent),
    data: { titleKey: 'page.products', descriptionKey: 'page.description.products' },
  },
  {
    path: 'notes',
    loadComponent: () => import('./pages/notes/notes').then((module) => module.Notes),
    data: { titleKey: 'page.notes', descriptionKey: 'page.description.notes' },
  },
  {
    path: 'notes/:slug',
    loadComponent: () => import('./pages/note/note').then((module) => module.Note),
  },
  {
    path: 'legal',
    loadComponent: () => import('./pages/policy/policy-page').then((module) => module.PolicyPage),
    data: {
      policy: policies.legal,
      titleKey: 'page.legal',
      descriptionKey: 'page.description.legal',
    },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/policy/policy-page').then((module) => module.PolicyPage),
    data: {
      policy: policies.privacy,
      titleKey: 'page.privacy',
      descriptionKey: 'page.description.privacy',
    },
  },
  {
    path: 'cookies',
    loadComponent: () => import('./pages/policy/policy-page').then((module) => module.PolicyPage),
    data: {
      policy: policies.cookies,
      titleKey: 'page.cookies',
      descriptionKey: 'page.description.cookies',
    },
  },
  {
    path: 'version',
    loadComponent: () => import('./pages/version/version').then((module) => module.Version),
    data: {
      shell: 'standalone',
      titleKey: 'page.version',
      descriptionKey: 'page.description.version',
    },
  },
  {
    path: '404',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((module) => module.NotFoundComponent),
    data: notFoundData,
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((module) => module.NotFoundComponent),
    data: notFoundData,
  },
];

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'fr',
    pathMatch: 'full',
  },
  {
    path: ':language',
    canMatch: [languageCanMatch],
    resolve: { language: languageResolver },
    children: localizedChildren,
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((module) => module.NotFoundComponent),
    data: notFoundData,
  },
];
