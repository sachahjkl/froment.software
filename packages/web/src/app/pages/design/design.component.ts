import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Button, type ButtonVariant } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { ContactActions } from '@shared/contact-actions/contact-actions';
import { DataTable } from '@shared/data-table/data-table';
import { Icon, type IconName } from '@shared/icon/icon';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { VisualSample } from '@shared/visual-sample/visual-sample';
import { DesignDocuments } from './design-documents';

type ComponentTab =
  | 'demo'
  | 'actions'
  | 'inputs'
  | 'feedback'
  | 'data'
  | 'documents'
  | 'navigation';

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
    Tabs,
    VisualSample,
  ],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly componentTab = signal<ComponentTab>('demo');
  protected readonly nestedTab = signal('first');
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
      value: 'demo',
      id: 'design-demo-tab',
      label: this.i18n.t('design.components.demo'),
      panelId: 'design-demo-panel',
    },
    {
      value: 'actions',
      id: 'design-actions-tab',
      label: this.i18n.t('design.components.actions'),
      panelId: 'design-actions-panel',
    },
    {
      value: 'inputs',
      id: 'design-inputs-tab',
      label: this.i18n.t('design.components.inputs'),
      panelId: 'design-inputs-panel',
    },
    {
      value: 'feedback',
      id: 'design-feedback-tab',
      label: this.i18n.t('design.components.feedback'),
      panelId: 'design-feedback-panel',
    },
    {
      value: 'data',
      id: 'design-data-tab',
      label: this.i18n.t('design.components.dataGroup'),
      panelId: 'design-data-panel',
    },
    {
      value: 'documents',
      id: 'design-documents-tab',
      label: this.i18n.t('design.components.documents'),
      panelId: 'design-documents-panel',
    },
    {
      value: 'navigation',
      id: 'design-navigation-tab',
      label: this.i18n.t('design.components.navigation'),
      panelId: 'design-navigation-panel',
    },
  ]);
  protected readonly nestedTabs: readonly TabItem[] = [
    {
      value: 'first',
      id: 'sample-first-tab',
      label: 'Proposition détaillée',
      panelId: 'sample-first-panel',
    },
    {
      value: 'second',
      id: 'sample-second-tab',
      label: 'Document PDF téléchargeable',
      panelId: 'sample-second-panel',
    },
    {
      value: 'third',
      id: 'sample-third-tab',
      label: 'Acceptation et signature',
      panelId: 'sample-third-panel',
    },
  ];
}
