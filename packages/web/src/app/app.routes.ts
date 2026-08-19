import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { policies } from './pages/policy/policy-documents';
import {
  backOfficeAdministratorGuard,
  backOfficeClientGuard,
} from './back-office/back-office-auth';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: { titleKey: 'page.home', descriptionKey: 'page.description.home' },
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
    path: 'services/developpement',
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
    path: 'blog',
    loadComponent: () => import('./pages/blog/blog').then((module) => module.Blog),
    data: { titleKey: 'page.blog', descriptionKey: 'page.description.blog' },
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./pages/blog-post/blog-post').then((module) => module.BlogPost),
  },
  {
    path: 'backoffice',
    redirectTo: 'backoffice/login',
    pathMatch: 'full',
  },
  {
    path: 'backoffice/login',
    loadComponent: () =>
      import('./pages/back-office-login/back-office-login').then(
        (module) => module.BackOfficeLogin,
      ),
    data: {
      titleKey: 'page.back_office',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/bootstrap',
    loadComponent: () =>
      import('./pages/back-office-bootstrap/back-office-bootstrap').then(
        (module) => module.BackOfficeBootstrap,
      ),
    data: {
      titleKey: 'page.back_office',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/dashboard',
    loadComponent: () =>
      import('./pages/back-office-dashboard/back-office-dashboard').then(
        (module) => module.BackOfficeDashboard,
      ),
    canActivate: [backOfficeAdministratorGuard],
    data: {
      titleKey: 'page.back_office',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/client',
    loadComponent: () =>
      import('./pages/back-office-client/back-office-client').then(
        (module) => module.BackOfficeClient,
      ),
    canActivate: [backOfficeClientGuard],
    data: {
      titleKey: 'page.back_office_client',
      descriptionKey: 'page.description.back_office_client',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/business-card',
    loadComponent: () =>
      import('./pages/business-card/business-card').then((module) => module.BusinessCard),
    canActivate: [backOfficeAdministratorGuard],
    data: {
      titleKey: 'page.business_card',
      descriptionKey: 'page.description.business_card',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/clients',
    loadComponent: () =>
      import('./pages/back-office-clients/back-office-clients').then(
        (module) => module.BackOfficeClients,
      ),
    canActivate: [backOfficeAdministratorGuard],
    data: {
      titleKey: 'page.back_office_clients',
      descriptionKey: 'page.description.back_office_clients',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/quotes',
    loadComponent: () =>
      import('./pages/back-office-quotes/back-office-quotes').then(
        (module) => module.BackOfficeQuotes,
      ),
    canActivate: [backOfficeAdministratorGuard],
    data: {
      titleKey: 'page.back_office_quotes',
      descriptionKey: 'page.description.back_office_quotes',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/quotes/new',
    loadComponent: () =>
      import('./pages/back-office-quote-editor/back-office-quote-editor').then(
        (module) => module.BackOfficeQuoteEditor,
      ),
    canActivate: [backOfficeAdministratorGuard],
    data: {
      titleKey: 'page.back_office_quote_editor',
      descriptionKey: 'page.description.back_office_quote_editor',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/quotes/:quoteId',
    loadComponent: () =>
      import('./pages/back-office-quote-editor/back-office-quote-editor').then(
        (module) => module.BackOfficeQuoteEditor,
      ),
    canActivate: [backOfficeAdministratorGuard],
    data: {
      titleKey: 'page.back_office_quote_editor',
      descriptionKey: 'page.description.back_office_quote_editor',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'design',
    loadComponent: () =>
      import('./pages/design/design.component').then((module) => module.DesignComponent),
    data: {
      titleKey: 'page.design',
      descriptionKey: 'page.description.design',
      robots: 'noindex, follow',
    },
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
    data: { titleKey: 'page.version', descriptionKey: 'page.description.version' },
  },
  {
    path: '404',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((module) => module.NotFoundComponent),
    data: {
      titleKey: 'page.not_found',
      descriptionKey: 'page.description.not_found',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((module) => module.NotFoundComponent),
    data: {
      titleKey: 'page.not_found',
      descriptionKey: 'page.description.not_found',
      robots: 'noindex, nofollow',
    },
  },
];
