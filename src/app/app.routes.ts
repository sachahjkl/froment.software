import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { ServicesComponent } from './pages/services/services.component';
import { ShowcaseComponent } from './pages/showcase/showcase.component';
import { ToolsComponent } from './pages/tools/tools.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { titleKey: 'page.home', descriptionKey: 'page.description.home' } },
  { path: 'clients', component: ClientsComponent, data: { titleKey: 'page.clients', descriptionKey: 'page.description.clients' } },
  { path: 'services', component: ServicesComponent, data: { titleKey: 'page.services', descriptionKey: 'page.description.services' } },
  { path: 'tools', component: ToolsComponent, data: { titleKey: 'page.products', descriptionKey: 'page.description.products' } },
  { path: 'showcase', component: ShowcaseComponent, data: { titleKey: 'page.showcase', descriptionKey: 'page.description.showcase' } },
  { path: '**', redirectTo: '' },
];
