import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { policies } from './pages/policy/policy-documents';
import { administratorGuard, clientGuard } from './back-office/authentication';
import { unsavedChangesGuard } from './back-office/unsaved-changes-guard';
import { pendingApiTokenGuard } from './back-office/pending-api-token-guard';
import { TabPanelOutlet } from './shared/tabs/tab-panel';

const tabRoutes = (defaultPath: string, panel: string, paths: readonly string[]): Routes => [
  { path: '', redirectTo: defaultPath, pathMatch: 'full' },
  ...paths.map((path) => ({ path, component: TabPanelOutlet, data: { panel, tab: path } })),
];

export const routes: Routes = [
  {
    path: 'backoffice/banque/ecritures',
    loadComponent: () =>
      import('./pages/back-office/bank-ledger/bank-ledger').then((module) => module.BankLedger),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'ledger.title', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/:invoiceId/credits',
    loadComponent: () =>
      import('./pages/back-office/credit-notes/credit-notes').then((module) => module.CreditNotes),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'credit.title', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/join',
    loadComponent: () =>
      import('./pages/back-office/team/team-join').then((module) => module.TeamJoin),
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'team.join', robots: 'noindex, nofollow' },
  },
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
    path: 'quote',
    loadComponent: () =>
      import('./pages/public-quote/public-quote').then((module) => module.PublicQuote),
    data: {
      titleKey: 'page.public_quote',
      descriptionKey: 'page.description.public_quote',
      robots: 'noindex, nofollow',
    },
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      { path: 'summary', component: TabPanelOutlet, data: { panel: 'summary' } },
      { path: 'document', component: TabPanelOutlet, data: { panel: 'document' } },
      { path: 'signature', component: TabPanelOutlet, data: { panel: 'signature' } },
    ],
  },
  {
    path: 'backoffice',
    redirectTo: 'backoffice/login',
    pathMatch: 'full',
  },
  {
    path: 'backoffice/login',
    loadComponent: () => import('./pages/back-office/login/login').then((module) => module.Login),
    data: {
      titleKey: 'page.back_office',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/sign-out',
    loadComponent: () =>
      import('./pages/back-office/sign-out/sign-out').then((module) => module.SignOut),
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'backOffice.signOut', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/bootstrap',
    loadComponent: () =>
      import('./pages/back-office/bootstrap/bootstrap').then((module) => module.Bootstrap),
    data: {
      titleKey: 'page.back_office',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/dashboard',
    loadComponent: () =>
      import('./pages/back-office/dashboard/dashboard').then((module) => module.Dashboard),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'page.back_office',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/account',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/back-office/account-security/account-security').then(
        (module) => module.AccountSecurity,
      ),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'account.security_title',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/client/account',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/back-office/account-security/account-security').then(
        (module) => module.AccountSecurity,
      ),
    canActivate: [clientGuard],
    data: {
      titleKey: 'account.security_title',
      descriptionKey: 'page.description.back_office',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/client',
    loadComponent: () =>
      import('./pages/back-office/client-portal/client-portal').then(
        (module) => module.ClientPortal,
      ),
    canActivate: [clientGuard],
    data: {
      titleKey: 'page.back_office_client',
      descriptionKey: 'page.description.back_office_client',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/clients',
    loadComponent: () =>
      import('./pages/back-office/clients/clients').then((module) => module.Clients),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'page.back_office_clients',
      descriptionKey: 'page.description.back_office_clients',
      robots: 'noindex, nofollow',
    },
    children: tabRoutes('active', 'clients', ['active', 'archived', 'all']),
  },
  {
    path: 'backoffice/clients/new',
    loadComponent: () =>
      import('./pages/back-office/client-editor/client-editor').then(
        (module) => module.ClientEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'backOffice.clients.create', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/clients/:clientId/edit',
    loadComponent: () =>
      import('./pages/back-office/client-editor/client-editor').then(
        (module) => module.ClientEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'clientsWorkspace.edit', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/clients/:clientId',
    loadComponent: () =>
      import('./pages/back-office/client-detail/client-detail').then(
        (module) => module.ClientDetail,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      titleKey: 'page.back_office_client_detail',
      descriptionKey: 'page.description.back_office_client_detail',
      robots: 'noindex, nofollow',
    },
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      { path: 'profile', component: TabPanelOutlet, data: { panel: 'profile' } },
      { path: 'documents', component: TabPanelOutlet, data: { panel: 'documents' } },
      { path: 'access', component: TabPanelOutlet, data: { panel: 'access' } },
    ],
  },
  {
    path: 'backoffice/affaires',
    loadComponent: () =>
      import('./pages/back-office/affairs/affairs').then((module) => module.Affairs),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'page.back_office_quotes',
      descriptionKey: 'page.description.back_office_quotes',
      robots: 'noindex, nofollow',
    },
    children: tabRoutes('attention', 'affairs', ['attention', 'active', 'completed', 'all']),
  },
  {
    path: 'backoffice/affaires/:quoteId',
    loadComponent: () =>
      import('./pages/back-office/affair-detail/affair-detail').then(
        (module) => module.AffairDetail,
      ),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'page.back_office_affair_detail',
      descriptionKey: 'page.description.back_office_affair_detail',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/quotes/new',
    loadComponent: () =>
      import('./pages/back-office/quote-editor/quote-editor').then((module) => module.QuoteEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      titleKey: 'page.back_office_quote_editor',
      descriptionKey: 'page.description.back_office_quote_editor',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/quotes/:quoteId',
    loadComponent: () =>
      import('./pages/back-office/quote-editor/quote-editor').then((module) => module.QuoteEditor),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      titleKey: 'page.back_office_quote_editor',
      descriptionKey: 'page.description.back_office_quote_editor',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/facturation',
    loadComponent: () =>
      import('./pages/back-office/billing/billing').then((module) => module.Billing),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'page.back_office_invoices',
      descriptionKey: 'page.description.back_office_invoices',
      robots: 'noindex, nofollow',
    },
    children: tabRoutes('issued', 'billing', ['draft', 'issued', 'paid', 'void', 'all']),
  },
  {
    path: 'backoffice/catalogue/new',
    loadComponent: () =>
      import('./pages/back-office/catalog-editor/catalog-editor').then(
        (module) => module.CatalogEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'catalog.create', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/catalogue/:itemId/edit',
    loadComponent: () =>
      import('./pages/back-office/catalog-editor/catalog-editor').then(
        (module) => module.CatalogEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'catalogWorkspace.editTitle', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/catalogue',
    loadComponent: () =>
      import('./pages/back-office/catalog/catalog').then((module) => module.Catalog),
    canActivate: [administratorGuard],
    data: { titleKey: 'catalog.title', robots: 'noindex, nofollow' },
    children: tabRoutes('active', 'catalog', ['active', 'archived', 'all']),
  },
  {
    path: 'backoffice/configuration',
    loadComponent: () =>
      import('./pages/back-office/configuration/configuration').then(
        (module) => module.Configuration,
      ),
    canActivate: [administratorGuard],
    data: {
      titleKey: 'page.back_office_issuer_settings',
      descriptionKey: 'page.description.back_office_issuer_settings',
      robots: 'noindex, nofollow',
    },
    children: [
      { path: '', redirectTo: 'entreprise', pathMatch: 'full' },
      {
        path: 'equipe',
        loadComponent: () => import('./pages/back-office/team/team').then((module) => module.Team),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'services',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/back-office/connections/connections').then(
            (module) => module.Connections,
          ),
      },
      {
        path: 'services/resend',
        loadComponent: () =>
          import('./pages/back-office/email-test/email-test').then((module) => module.EmailTest),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'services/stripe',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/back-office/checkout/checkout').then((module) => module.Checkout),
      },
      {
        path: 'services/simulations',
        loadComponent: () =>
          import('./pages/back-office/integrations/integrations').then(
            (module) => module.Integrations,
          ),
      },
      {
        path: 'entreprise',
        loadComponent: () =>
          import('./pages/back-office/issuer-settings/issuer-settings').then(
            (module) => module.IssuerSettings,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'conditions',
        loadComponent: () =>
          import('./pages/back-office/quote-condition-presets/quote-condition-presets').then(
            (module) => module.QuoteConditionPresets,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'identite',
        loadComponent: () =>
          import('./pages/business-card/business-card').then((module) => module.BusinessCard),
      },
      {
        path: 'api',
        loadComponent: () =>
          import('./pages/back-office/api-tokens/api-tokens').then((module) => module.ApiTokens),
        canDeactivate: [pendingApiTokenGuard],
        data: {
          titleKey: 'page.back_office_issuer_settings',
          descriptionKey: 'page.description.back_office_issuer_settings',
          robots: 'noindex, nofollow',
        },
      },
    ],
  },
  {
    path: 'backoffice/courriels/new',
    loadComponent: () =>
      import('./pages/back-office/email-composer/email-composer').then(
        (module) => module.EmailComposer,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emailsWorkspace.newMessage', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/courriels/drafts/:draftId/edit',
    loadComponent: () =>
      import('./pages/back-office/email-composer/email-composer').then(
        (module) => module.EmailComposer,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emailsWorkspace.editDraft', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/courriels/messages/:operationId',
    loadComponent: () =>
      import('./pages/back-office/email-detail/email-detail').then((module) => module.EmailDetail),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emailsWorkspace.message', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/courriels/templates/new',
    loadComponent: () =>
      import('./pages/back-office/email-template-editor/email-template-editor').then(
        (module) => module.EmailTemplateEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emailsWorkspace.newTemplate', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/courriels/templates/:templateId/edit',
    loadComponent: () =>
      import('./pages/back-office/email-template-editor/email-template-editor').then(
        (module) => module.EmailTemplateEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emailsWorkspace.editTemplate', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/courriels/reminders/new',
    loadComponent: () =>
      import('./pages/back-office/reminder-editor/reminder-editor').then(
        (module) => module.ReminderEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emailsWorkspace.newReminder', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/courriels',
    loadComponent: () =>
      import('./pages/back-office/emails/emails').then((module) => module.Emails),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'emails.title', descriptionKey: 'emails.intro', robots: 'noindex, nofollow' },
    children: tabRoutes('messages', 'emails', ['messages', 'drafts', 'reminders', 'templates']),
  },
  {
    path: 'backoffice/banque',
    loadComponent: () =>
      import('./pages/back-office/banking/banking').then((module) => module.Banking),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { titleKey: 'bank.title', descriptionKey: 'bank.intro', robots: 'noindex, nofollow' },
  },
  {
    path: 'backoffice/invoices/new',
    loadComponent: () =>
      import('./pages/back-office/invoice-editor/invoice-editor').then(
        (module) => module.InvoiceEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      titleKey: 'page.back_office_invoice_editor',
      descriptionKey: 'page.description.back_office_invoice_editor',
      robots: 'noindex, nofollow',
    },
  },
  {
    path: 'backoffice/invoices/:invoiceId',
    loadComponent: () =>
      import('./pages/back-office/invoice-editor/invoice-editor').then(
        (module) => module.InvoiceEditor,
      ),
    canActivate: [administratorGuard],
    canDeactivate: [unsavedChangesGuard],
    data: {
      titleKey: 'page.back_office_invoice_editor',
      descriptionKey: 'page.description.back_office_invoice_editor',
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
    children: [
      { path: '', redirectTo: 'demo', pathMatch: 'full' },
      ...['demo', 'actions', 'inputs', 'feedback', 'data', 'documents'].map((path) => ({
        path,
        component: TabPanelOutlet,
        data: { panel: path },
      })),
      {
        path: 'navigation',
        loadComponent: () =>
          import('./pages/design/design-navigation').then((module) => module.DesignNavigation),
        children: [
          { path: '', redirectTo: 'first', pathMatch: 'full' },
          {
            path: 'first',
            component: TabPanelOutlet,
            data: {
              panel: 'nested',
              labelKey: 'design.demo.tabProposal',
              id: 'sample-first-panel',
              tabId: 'sample-first-tab',
            },
          },
          {
            path: 'second',
            component: TabPanelOutlet,
            data: {
              panel: 'nested',
              labelKey: 'design.demo.tabDocument',
              id: 'sample-second-panel',
              tabId: 'sample-second-tab',
            },
          },
          {
            path: 'third',
            component: TabPanelOutlet,
            data: {
              panel: 'nested',
              labelKey: 'design.demo.tabAcceptance',
              id: 'sample-third-panel',
              tabId: 'sample-third-tab',
            },
          },
        ],
      },
    ],
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
