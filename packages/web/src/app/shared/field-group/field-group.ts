import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fieldset[appFieldGroup]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    legend {
      padding: 0;
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: 600;
    }
    p {
      margin-block: var(--space-2) var(--space-4);
      color: var(--color-muted);
    }
    .fields {
      display: grid;
      gap: var(--space-4);
      margin-block-start: var(--space-3);
    }
  `,
  template: `
    <legend>{{ legend() }}</legend>
    @if (description()) {
      <p>{{ description() }}</p>
    }
    <div class="fields"><ng-content /></div>
  `,
})
export class FieldGroup {
  readonly legend = input.required<string>();
  readonly description = input('');
}
