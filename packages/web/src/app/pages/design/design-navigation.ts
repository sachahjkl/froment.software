import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { VisualSample } from '@shared/visual-sample/visual-sample';

@Component({
  selector: 'app-design-navigation',
  imports: [Button, RouterOutlet, TabLayout, TabPanel, Tabs, VisualSample],
  templateUrl: './design-navigation.html',
  styleUrl: './design.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignNavigation {
  protected readonly i18n = inject(I18nService);
  protected readonly tabs: readonly TabItem[] = [
    {
      path: 'first',
      id: 'sample-first-tab',
      label: 'Proposition détaillée',
    },
    {
      path: 'second',
      id: 'sample-second-tab',
      label: 'Document PDF téléchargeable',
    },
    {
      path: 'third',
      id: 'sample-third-tab',
      label: 'Acceptation et signature',
    },
  ];
}
