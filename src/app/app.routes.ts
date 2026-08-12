import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { ServicesComponent } from './pages/services/services.component';
import { DesignComponent } from './pages/design/design.component';
import { ToolsComponent } from './pages/tools/tools.component';
import { AboutComponent } from './pages/about/about.component';
import { LegalComponent } from './pages/legal/legal.component';
import { PrivacyComponent } from './pages/privacy/privacy.component';
import { CookiesComponent } from './pages/cookies/cookies.component';
import { Blog } from './pages/blog/blog';
import { BlogPost } from './pages/blog-post/blog-post';
import { BackOfficeLogin } from './pages/back-office-login/back-office-login';
import { BackOfficeDashboard } from './pages/back-office-dashboard/back-office-dashboard';
import { BusinessCard } from './pages/business-card/business-card';
import { backOfficeGuard } from './back-office/back-office-auth';

import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { titleKey: 'page.home', descriptionKey: 'page.description.home' } },
  { path: 'about', component: AboutComponent, data: { titleKey: 'page.about', descriptionKey: 'page.description.about' } },
  { path: 'clients', component: ClientsComponent, data: { titleKey: 'page.clients', descriptionKey: 'page.description.clients' } },
  { path: 'services', component: ServicesComponent, data: { titleKey: 'page.services', descriptionKey: 'page.description.services' } },
  { path: 'tools', component: ToolsComponent, data: { titleKey: 'page.products', descriptionKey: 'page.description.products' } },
  { path: 'blog', component: Blog, data: { titleKey: 'page.blog', descriptionKey: 'page.description.blog' } },
  { path: 'blog/:slug', component: BlogPost },
  { path: 'back-office', component: BackOfficeLogin, data: { titleKey: 'page.back_office', descriptionKey: 'page.description.back_office', robots: 'noindex, nofollow' } },
  { path: 'back-office/dashboard', component: BackOfficeDashboard, canActivate: [backOfficeGuard], data: { titleKey: 'page.back_office', descriptionKey: 'page.description.back_office', robots: 'noindex, nofollow' } },
  { path: 'back-office/business-card', component: BusinessCard, canActivate: [backOfficeGuard], data: { titleKey: 'page.business_card', descriptionKey: 'page.description.business_card', robots: 'noindex, nofollow' } },
  { path: 'design', component: DesignComponent, data: { titleKey: 'page.design', descriptionKey: 'page.description.design', robots: 'noindex, follow' } },
  { path: 'legal', component: LegalComponent, data: { titleKey: 'page.legal', descriptionKey: 'page.description.legal' } },
  { path: 'privacy', component: PrivacyComponent, data: { titleKey: 'page.privacy', descriptionKey: 'page.description.privacy' } },
  { path: 'cookies', component: CookiesComponent, data: { titleKey: 'page.cookies', descriptionKey: 'page.description.cookies' } },
  { path: '404', component: NotFoundComponent, data: { titleKey: 'page.not_found', descriptionKey: 'page.description.not_found', robots: 'noindex, nofollow' } },
  { path: '**', component: NotFoundComponent, data: { titleKey: 'page.not_found', descriptionKey: 'page.description.not_found', robots: 'noindex, nofollow' } },
];
