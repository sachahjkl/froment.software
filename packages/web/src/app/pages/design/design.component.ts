import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { ContactActions } from '@shared/contact-actions/contact-actions';
import { Icon } from '@shared/icon/icon';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

type ComponentTab = 'actions' | 'inputs' | 'feedback' | 'data';

@Component({
  selector: 'app-design',
  standalone: true,
  imports: [Button, ContactActions, Icon, Tabs],
  templateUrl: './design.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './design.component.scss',
})
export class DesignComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly componentTab = signal<ComponentTab>('actions');
  protected readonly componentTabs = computed<readonly TabItem[]>(() => [
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
  ]);
}
