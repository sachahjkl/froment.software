import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { StoryPage, currentReference, type StoryDefinition } from '../story-page';
import { referenceText } from '../reference-text';
import { BusinessPreview } from './business-preview';
import type { BusinessSettings } from './business-context';

@Component({
  imports: [StoryPage, FormField, BusinessPreview],
  selector: 'app-business-stories',
  styleUrl: './story.scss',
  templateUrl: './business-stories.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessStories {
  protected readonly entry = currentReference();
  protected readonly text = referenceText();
  protected get definition(): StoryDefinition { return this.text().stories[this.entry.id]; }
  protected readonly model = signal<BusinessSettings>({
    scenario: 'ready', administrator: true, path: '/backoffice/affaires', kind: 'quote', party: 'both',
  });
  protected readonly controls = form(this.model);
  protected readonly documentVariants: readonly BusinessSettings[] = [
    { scenario: 'ready', administrator: true, path: '/backoffice/affaires', kind: 'quote', party: 'issuer' },
    { scenario: 'ready', administrator: true, path: '/backoffice/facturation', kind: 'invoice', party: 'client' },
  ];
}
