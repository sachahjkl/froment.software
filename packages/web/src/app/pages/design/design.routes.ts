import { type Routes } from '@angular/router';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';

const action = () => import('./stories/action-stories').then((module) => module.ActionStories);
const feedback = () =>
  import('./stories/feedback-stories').then((module) => module.FeedbackStories);
const fields = () => import('./stories/field-stories').then((module) => module.FieldStories);
const data = () => import('./stories/data-stories').then((module) => module.DataStories);
const navigation = () =>
  import('./stories/navigation-stories').then((module) => module.NavigationStories);
const presentation = () =>
  import('./stories/presentation-stories').then((module) => module.PresentationStories);

export const designRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'button' },
  ...['button', 'link-button', 'action-menu', 'split-action', 'copy-field', 'anchor-link'].map(
    (path) => ({ path, loadComponent: action }),
  ),
  ...['badge', 'notice', 'empty-state', 'hint', 'status-block', 'icon'].map((path) => ({
    path,
    loadComponent: feedback,
  })),
  ...[
    'input',
    'list-search',
    'filter-menu',
    'filter-panel',
    'filter-choice',
    'date-range',
    'object-picker',
    'field-group',
  ].map((path) => ({ path, loadComponent: fields })),
  ...[
    'data-table',
    'table-sort',
    'table-export',
    'filter-chip',
    'bulk-selection',
    'list-toolbar',
    'list-workspace',
    'search-highlight',
    'event-history',
    'localized-date',
    'detail-row',
  ].map((path) => ({ path, loadComponent: data })),
  ...['breadcrumbs', 'drawer', 'confirmation', 'result-navigation'].map((path) => ({
    path,
    loadComponent: navigation,
  })),
  ...['tabs', 'tab-layout'].map((path) => ({
    path,
    loadComponent: navigation,
    data: { panel: 'reference-gallery', tab: 'first' },
    children: [
      { path: '', pathMatch: 'full' as const, redirectTo: 'first' },
      ...['first', 'second'].map((panel) => ({
        path: panel,
        component: TabPanelOutlet,
        data: { panel: 'reference-tabs', tab: panel },
      })),
    ],
  })),
  ...[
    'page-header',
    'outcome-panel',
    'visual-sample',
    'process-timeline',
    'concrete-examples',
    'contact-actions',
    'site-header',
    'site-footer',
    'language-selector',
    'theme-toggle',
    'new-label',
    'mobile-navigation',
  ].map((path) => ({ path, loadComponent: presentation })),
  {
    path: 'workflows',
    loadComponent: () =>
      import('./design-workspace/design-workspace').then((module) => module.DesignWorkspace),
    canDeactivate: [unsavedChangesGuard],
  },
];
