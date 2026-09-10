import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MermaidDiagrams } from '@shared/mermaid-diagrams';
import { StoryPage, currentReference, type StoryDefinition } from '../story-page';
import { referenceText } from '../reference-text';

@Component({
  imports: [StoryPage, FormField, MermaidDiagrams],
  selector: 'app-mermaid-stories',
  styleUrl: './mermaid-stories.scss',
  templateUrl: './mermaid-stories.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MermaidStories {
  protected readonly entry = currentReference();
  protected readonly text = referenceText();
  protected get definition(): StoryDefinition {
    return this.text().stories[this.entry.id];
  }
  protected readonly diagram = signal<'flowchart' | 'sequence'>('flowchart');
  protected readonly controls = form(this.diagram);
  protected readonly variants: readonly ('flowchart' | 'sequence')[] = ['flowchart', 'sequence'];
}
