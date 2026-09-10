import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  readonly label: string;
  readonly path: string;
}

@Component({
  imports: [RouterLink],
  selector: 'app-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    ol {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--text-sm);
    }
    li {
      display: inline-flex;
      gap: var(--space-2);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .separator {
      color: var(--color-muted);
    }
  `,
  template: `
    <nav [attr.aria-label]="label()">
      <ol>
        @for (item of items(); track item.path) {
          <li>
            <a [routerLink]="item.path">{{ item.label }}</a
            ><span class="separator" aria-hidden="true">/</span>
          </li>
        }
        <li aria-current="page">{{ current() }}</li>
      </ol>
    </nav>
  `,
})
export class Breadcrumbs {
  readonly label = input.required<string>();
  readonly items = input.required<readonly BreadcrumbItem[]>();
  readonly current = input.required<string>();
}
