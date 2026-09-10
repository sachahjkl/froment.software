import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface HistoryEvent {
  readonly id: string;
  readonly datetime: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly detail: string;
}

@Component({
  selector: 'app-event-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: grid;
      gap: var(--space-1);
      padding-block: var(--space-3);
      border-block-end: 1px solid var(--color-line);
    }
    time {
      color: var(--color-muted);
      font-size: var(--text-sm);
    }
    p {
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <ol [attr.aria-label]="label()">
      @for (event of events(); track event.id) {
        <li>
          <time [attr.datetime]="event.datetime">{{ event.dateLabel }}</time>
          <strong>{{ event.title }}</strong>
          <p>{{ event.detail }}</p>
        </li>
      }
    </ol>
  `,
})
export class EventHistory {
  readonly label = input.required<string>();
  readonly events = input.required<readonly HistoryEvent[]>();
}
