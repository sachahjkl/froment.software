import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Button } from '@shared/button/button';

@Component({
  selector: 'app-copy-field',
  imports: [Button],
  template: `
    @if (label(); as currentLabel) {
      @if (headingId(); as currentHeadingId) {
        <h2 [id]="currentHeadingId">{{ currentLabel }}</h2>
      } @else {
        <strong>{{ currentLabel }}</strong>
      }
    }
    @if (href(); as currentHref) {
      <a
        [href]="currentHref"
        [attr.target]="external() ? '_blank' : null"
        [attr.rel]="external() ? 'noopener noreferrer' : null"
        >{{ value() }}</a
      >
    } @else {
      <code>{{ value() }}</code>
    }
    @if (description(); as currentDescription) {
      <small>{{ currentDescription }}</small>
    }
    <p>
      <button appButton type="button" (click)="copy.emit()">{{ actionLabel() }}</button>
      @if (status(); as currentStatus) {
        <span role="status">{{ currentStatus }}</span>
      }
    </p>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: start;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--color-line-strong);
      background: var(--color-surface-sunken);
    }

    a,
    code {
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    p {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    span {
      color: var(--color-success);
    }

    small {
      color: var(--color-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyField {
  readonly label = input('');
  readonly headingId = input('');
  readonly value = input.required<string>();
  readonly href = input<string>();
  readonly external = input(false);
  readonly description = input('');
  readonly actionLabel = input.required<string>();
  readonly status = input('');
  readonly copy = output<void>();
}
