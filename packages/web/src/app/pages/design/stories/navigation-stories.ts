import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, min, max } from '@angular/forms/signals';
import { RouterOutlet } from '@angular/router';
import { Button } from '@shared/button/button';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Tabs } from '@shared/tabs/tabs';
import { TabLayout, TabPanel, TabPanelOutlet } from '@shared/tabs/tab-panel';
import { Drawer } from '@shared/drawer/drawer';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ResultNavigation } from '@shared/result-navigation/result-navigation';
import { StoryPage, currentReference, type StoryDefinition } from '../story-page';
import { referenceText } from '../reference-text';

interface NavigationPreview {
  label: string;
  current: string;
  message: string;
  danger: boolean;
  disabled: boolean;
  preserveQuery: boolean;
  page: number;
}

@Component({
  selector: 'app-navigation-stories',
  imports: [
    StoryPage,
    FormField,
    RouterOutlet,
    Button,
    Breadcrumbs,
    Tabs,
    TabLayout,
    TabPanel,
    TabPanelOutlet,
    Drawer,
    ResultNavigation,
  ],
  templateUrl: './navigation-stories.html',
  styleUrl: './story.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationStories {
  protected readonly entry = currentReference();
  protected readonly text = referenceText();
  protected get definition(): StoryDefinition {
    return this.text().stories[this.entry.id];
  }
  protected readonly model = signal<NavigationPreview>({
    label: this.text().content,
    current: this.text().current,
    message: this.text().confirmation,
    danger: false,
    disabled: false,
    preserveQuery: false,
    page: 1,
  });
  protected readonly controls = form(this.model, (path) => {
    min(path.page, 1);
    max(path.page, 3);
  });
  protected readonly event = signal('');
  protected readonly drawerMode = signal<'preview' | 'simple' | 'heading' | undefined>(undefined);
  protected readonly parents = computed(() => [
    { label: this.text().navigation, path: '/design/button' },
  ]);
  protected readonly tabs = computed(() => [
    { id: 'reference-first-tab', path: 'first', label: this.text().preview },
    { id: 'reference-second-tab', path: 'second', label: this.text().details },
  ]);
  protected readonly galleryTabs = computed(() =>
    this.tabs().map((tab) => ({ ...tab, id: `gallery-${tab.id}` })),
  );
  protected readonly disabledTabs = computed(() =>
    this.tabs().map((tab) => ({ ...tab, id: `disabled-${tab.id}` })),
  );
  private readonly confirmation = inject(Confirmation);
  protected async confirm(danger = false): Promise<void> {
    const accepted = await this.confirmation.request(this.model().message, {
      acceptLabel: this.model().label,
      variant: danger ? 'danger' : 'primary',
    });
    this.event.set(accepted ? this.text().accepted : this.text().cancelled);
  }
  protected move(offset: number): void {
    this.model.update((value) => ({
      ...value,
      page: Math.max(1, Math.min(3, value.page + offset)),
    }));
  }
}
