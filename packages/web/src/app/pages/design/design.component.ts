import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Confirmation } from '@shared/confirmation/confirmation';
import { RouterOutlet } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button, type ButtonVariant } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { ContactActions } from '@shared/contact-actions/contact-actions';
import { DataTable } from '@shared/data-table/data-table';
import { Icon, type IconName } from '@shared/icon/icon';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { VisualSample } from '@shared/visual-sample/visual-sample';
import { DesignDocuments } from './design-documents';
import { EmptyState } from '@shared/empty-state/empty-state';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { createFuzzySearch } from '@shared/fuzzy-search';

type ButtonSample = {
  readonly variant: ButtonVariant;
  readonly icon: IconName;
};

@Component({
  host: { class: 'page-container' },
  selector: 'app-design',
  standalone: true,
  imports: [
    Badge,
    Button,
    ContactActions,
    DataTable,
    DesignDocuments,
    EmptyState,
    ListToolbar,
    Icon,
    Notice,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    VisualSample,
  ],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly tableQuery = signal('');
  protected readonly tableRows = createFuzzySearch(
    signal([
      { service: 'Web', subject: 'Angular' },
      { service: 'Desktop', subject: 'WPF' },
    ]),
    this.tableQuery,
    { keys: ['service', 'subject'], threshold: 0.35 },
  );
  private readonly confirmation = inject(Confirmation);
  protected readonly confirmationResult = signal<'accepted' | 'cancelled' | undefined>(undefined);
  protected async demonstrateConfirmation(destructive: boolean): Promise<void> {
    this.confirmationResult.set(undefined);
    let message = this.i18n.t('design.confirmation.message');
    let variant: 'primary' | 'danger' = 'primary';
    let acceptLabel = this.i18n.t('confirmation.accept');
    if (destructive) {
      message = this.i18n.t('design.confirmation.discardMessage');
      variant = 'danger';
      acceptLabel = this.i18n.t('design.confirmation.discardLabel');
    }
    const accepted = await this.confirmation.request(message, { variant, acceptLabel });
    if (accepted) this.confirmationResult.set('accepted');
    else this.confirmationResult.set('cancelled');
  }
  protected readonly i18n = inject(I18nService);
  protected readonly buttonSamples: readonly ButtonSample[] = [
    { variant: 'default', icon: 'mail' },
    { variant: 'primary', icon: 'calendar' },
    { variant: 'info', icon: 'ai' },
    { variant: 'success', icon: 'tests' },
    { variant: 'warning', icon: 'upgrade' },
    { variant: 'danger', icon: 'secrets' },
    { variant: 'dark', icon: 'infrastructure' },
    { variant: 'link', icon: 'build' },
  ];
  protected readonly iconNames: readonly IconName[] = [
    'ai',
    'build',
    'calendar',
    'ci',
    'development',
    'environment',
    'infrastructure',
    'mail',
    'metrics',
    'secrets',
    'tests',
    'upgrade',
  ];
  protected readonly componentTabs = computed<readonly TabItem[]>(() => [
    {
      path: 'demo',
      id: 'design-demo-tab',
      label: this.i18n.t('design.components.demo'),
    },
    {
      path: 'actions',
      id: 'design-actions-tab',
      label: this.i18n.t('design.components.actions'),
    },
    {
      path: 'inputs',
      id: 'design-inputs-tab',
      label: this.i18n.t('design.components.inputs'),
    },
    {
      path: 'feedback',
      id: 'design-feedback-tab',
      label: this.i18n.t('design.components.feedback'),
    },
    {
      path: 'data',
      id: 'design-data-tab',
      label: this.i18n.t('design.components.dataGroup'),
    },
    {
      path: 'documents',
      id: 'design-documents-tab',
      label: this.i18n.t('design.components.documents'),
    },
    {
      path: 'navigation',
      id: 'design-navigation-tab',
      label: this.i18n.t('design.components.navigation'),
      exact: false,
    },
  ]);
}
