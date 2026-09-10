import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { PageHeader } from '@shared/page-header/page-header';
import { OutcomePanel } from '@shared/outcome-panel/outcome-panel';
import { VisualSample } from '@shared/visual-sample/visual-sample';
import { ProcessTimeline } from '@shared/process-timeline/process-timeline';
import { ConcreteExamples } from '@shared/concrete-examples/concrete-examples';
import { ContactActions } from '@shared/contact-actions/contact-actions';
import { SiteHeader } from '@shared/site-header/site-header';
import { MobileNavigation } from '@shared/mobile-navigation/mobile-navigation';
import {
  MOBILE_NAVIGATION,
  provideMobileNavigation,
} from '@shared/mobile-navigation/mobile-navigation-state';
import { SiteFooter } from '@shared/site-footer/site-footer';
import { LanguageSelector } from '@shared/language-selector/language-selector';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';
import { NewLabel } from '@shared/new-label/new-label';
import { Button } from '@shared/button/button';
import { StoryPage, currentReference, type StoryDefinition } from '../story-page';
import { referenceText } from '../reference-text';

interface PresentationPreview {
  label: string;
  description: string;
  compact: boolean;
  preferences: boolean;
  context: 'examples' | 'expertise';
}

@Component({
  selector: 'app-presentation-stories',
  providers: [provideMobileNavigation()],
  imports: [
    StoryPage,
    FormField,
    Button,
    PageHeader,
    OutcomePanel,
    VisualSample,
    ProcessTimeline,
    ConcreteExamples,
    ContactActions,
    SiteHeader,
    SiteFooter,
    LanguageSelector,
    ThemeToggle,
    NewLabel,
    MobileNavigation,
  ],
  templateUrl: './presentation-stories.html',
  styleUrl: './story.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresentationStories {
  protected readonly entry = currentReference();
  protected readonly text = referenceText();
  protected get definition(): StoryDefinition {
    return this.text().stories[this.entry.id];
  }
  protected readonly mobileNavigation = inject(MOBILE_NAVIGATION);
  protected readonly model = signal<PresentationPreview>({
    label: this.text().content,
    description: this.text().local,
    compact: false,
    preferences: true,
    context: 'examples',
  });
  protected readonly controls = form(this.model);
  protected readonly event = signal('');
  protected readonly steps = computed(() => [
    { title: this.model().label, description: this.model().description },
  ]);
  protected toggleNavigation(event: MouseEvent): void {
    if (event.currentTarget instanceof HTMLElement)
      this.mobileNavigation.toggle(event.currentTarget);
  }
  protected interceptLink(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a');
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    this.event.set(link.getAttribute('href') ?? 'link');
  }
}
