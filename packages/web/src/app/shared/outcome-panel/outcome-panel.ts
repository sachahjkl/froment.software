import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'aside[appOutcomePanel]',
  template: '<ng-content />',
  styles: `
    :host {
      display: block;
      padding: var(--space-5);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-panel);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutcomePanel {}
