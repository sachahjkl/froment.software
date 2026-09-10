import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataTable } from '@shared/data-table/data-table';
import { referenceCatalog, type ReferenceEntry } from './reference-catalog';
import { formatReferenceCount, referenceText } from './reference-text';

export interface StoryDefinition {
  readonly properties: readonly (readonly [name: string, type: string, defaultValue: string])[];
  readonly usage: string;
}
export function currentReference(): ReferenceEntry {
  const path = inject(ActivatedRoute).snapshot.routeConfig?.path;
  const entry = referenceCatalog.find((item) => item.id === path);
  if (!entry) throw new Error('reference.unknown_route');
  return entry;
}

@Component({
  selector: 'app-story-page',
  imports: [DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <article [attr.data-component]="entry().id">
    <header>
      <h1 tabindex="-1" data-reference-heading>{{ entry().name }}</h1>
      <p>
        {{ text().selectors }} : <code>{{ entry().selectors }}</code>
      </p>
      <p class="muted">{{ text().local }}</p>
    </header>
    <div class="playground" [class.wide]="entry().group === 'presentation'">
      <section class="controls ds-panel" aria-labelledby="story-controls">
        <h2 id="story-controls">{{ text().controls }}</h2>
        <ng-content select="[storyControls]" />
      </section>
      <section class="preview" aria-labelledby="story-preview">
        <h2 id="story-preview">{{ text().preview }}</h2>
        <ng-content select="[storyPreview]" />
      </section>
    </div>
    <section aria-labelledby="story-variants">
      <h2 id="story-variants">{{ variantCount() }}</h2>
      <ng-content select="[storyVariants]" />
    </section>
    <section aria-labelledby="story-properties">
      <h2 id="story-properties">{{ text().properties }}</h2>
      <div appDataTable tableLayout="fluid">
        <table>
          <thead>
            <tr>
              <th>{{ text().property }}</th>
              <th>{{ text().type }}</th>
              <th>{{ text().default }}</th>
            </tr>
          </thead>
          <tbody>
            @for (property of definition().properties; track property[0]) {
              <tr>
                <th scope="row">
                  <code>{{ property[0] }}</code>
                </th>
                <td>
                  <code>{{ property[1] }}</code>
                </td>
                <td>{{ property[2] === 'required' ? text().required : property[2] }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <section>
      <h2>{{ text().usage }}</h2>
      <pre tabindex="0" [attr.aria-label]="text().usage"><code>{{ definition().usage }}</code></pre>
    </section>
    <p class="muted">
      {{ text().source }} : <code>packages/web/src/app/shared/{{ entry().source }}</code>
    </p>
  </article>`,
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
    article {
      display: grid;
      gap: var(--space-7);
      min-inline-size: 0;
    }
    header,
    section {
      display: grid;
      gap: var(--space-4);
      min-inline-size: 0;
      align-content: start;
    }
    header p {
      max-inline-size: 75ch;
    }
    .playground {
      display: grid;
      grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
      gap: var(--space-6);
      align-items: start;
    }
    .controls {
      padding: var(--space-4);
    }
    .playground.wide {
      grid-template-columns: minmax(0, 1fr);
    }
    .preview {
      min-block-size: 12rem;
    }
    pre {
      margin: 0;
      padding: var(--space-4);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: var(--color-surface-raised);
    }
    code {
      overflow-wrap: anywhere;
    }
    @media (max-width: 68rem) {
      .playground {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class StoryPage {
  readonly entry = input.required<ReferenceEntry>();
  readonly definition = input.required<StoryDefinition>();
  protected readonly text = referenceText();
  protected readonly variantCount = computed(() =>
    formatReferenceCount(this.entry().variants, this.text().language, this.text().variantCount),
  );
}
