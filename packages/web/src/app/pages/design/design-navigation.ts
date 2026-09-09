import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { VisualSample } from '@shared/visual-sample/visual-sample';
import { Drawer } from '@shared/drawer/drawer';
import { PageHeader } from '@shared/page-header/page-header';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';

@Component({
  selector: 'app-design-navigation',
  imports: [
    Button,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    VisualSample,
    Drawer,
    PageHeader,
    BackOfficeNav,
  ],
  templateUrl: './design-navigation.html',
  styleUrl: './design.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignNavigation {
  protected readonly drawerOpen = signal(false);
  protected readonly i18n = inject(I18nService);
  protected readonly tabs = computed<readonly TabItem[]>(() => [
    {
      path: 'first',
      id: 'sample-first-tab',
      label: this.i18n.t('design.demo.tabProposal'),
    },
    {
      path: 'second',
      id: 'sample-second-tab',
      label: this.i18n.t('design.demo.tabDocument'),
    },
    {
      path: 'third',
      id: 'sample-third-tab',
      label: this.i18n.t('design.demo.tabAcceptance'),
    },
  ]);
}
