import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// SVG paths from the Lucide set on Iconify, licensed under ISC.
export type IconName =
  | 'ai'
  | 'build'
  | 'calendar'
  | 'ci'
  | 'development'
  | 'environment'
  | 'external'
  | 'infrastructure'
  | 'mail'
  | 'metrics'
  | 'secrets'
  | 'tests'
  | 'upgrade';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (name()) {
        @case ('mail') {
          <g>
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </g>
        }
        @case ('calendar') {
          <g>
            <path d="M8 2v4m8-4v4M3 10h18" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
          </g>
        }
        @case ('external') {
          <g>
            <path d="M15 3h6v6m0-6-9 9" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </g>
        }
        @case ('development') {
          <g><path d="m8 9-4 3 4 3m8-6 4 3-4 3m-2-9-4 12" /></g>
        }
        @case ('upgrade') {
          <g>
            <path
              d="M12 22v-9m3.17-10.79a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.66 1.66 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"
            />
            <path
              d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"
            />
            <path
              d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.64 1.64 0 0 0 1.63 0z"
            />
          </g>
        }
        @case ('build') {
          <g>
            <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9m6 6 4-4" />
            <path
              d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"
            />
          </g>
        }
        @case ('ci') {
          <g>
            <rect width="8" height="8" x="3" y="3" rx="2" />
            <path d="M7 11v4a2 2 0 0 0 2 2h4" />
            <rect width="8" height="8" x="13" y="13" rx="2" />
          </g>
        }
        @case ('tests') {
          <path
            d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2M6.453 15h11.094M8.5 2h7"
          />
        }
        @case ('environment') {
          <path
            d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2zm2.054 10.987H3.946"
          />
        }
        @case ('secrets') {
          <g>
            <path
              d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"
            />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
          </g>
        }
        @case ('ai') {
          <g>
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2m16 0h2m-7-1v2m-6-2v2" />
          </g>
        }
        @case ('metrics') {
          <path
            d="M12 16v5m4-6.361V21m4-10.344V21m2-18-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15m2 3.463V21m4-6.344V21"
          />
        }
        @case ('infrastructure') {
          <g>
            <path
              d="m10.852 14.772-.383.923m2.679-.923a3 3 0 1 0-2.296-5.544l-.383-.923m2.679.923.383-.923"
            />
            <path
              d="m13.53 15.696-.382-.924a3 3 0 1 1-2.296-5.544m3.92 1.624.923-.383m-.923 2.679.923.383"
            />
            <path
              d="M4.5 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.5m-15 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-.5M6 18h.01M6 6h.01m3.228 4.852-.923-.383m.923 2.679-.923.383"
            />
          </g>
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      color: var(--icon-color, var(--color-muted));
    }
    svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.75;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
}
