import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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

type ButtonSample = {
  readonly variant: ButtonVariant;
  readonly icon: IconName;
};

@Component({
  selector: 'app-design',
  standalone: true,
  imports: [
    Badge,
    Button,
    ContactActions,
    DataTable,
    DesignDocuments,
    Icon,
    Notice,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    VisualSample,
  ],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
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
