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
  | 'upgrade'
  | 'dashboard'
  | 'clients'
  | 'folder'
  | 'invoice'
  | 'bank'
  | 'settings'
  | 'catalog'
  | 'book'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'user'
  | 'logout'
  | 'plus'
  | 'search'
  | 'check'
  | 'arrow-left'
  | 'chevron-right'
  | 'download'
  | 'filter';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (name()) {
        @case ('dashboard') {
          <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
        }
        @case ('clients') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21v-2a6 6 0 0 1 12 0v2m1-17a3 3 0 0 1 0 6m3 11v-2a6 6 0 0 0-3-5.2" />
        }
        @case ('folder') {
          <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        }
        @case ('invoice') {
          <path d="M6 3h9l4 4v14H5V3zm8 0v5h5M8 12h8m-8 4h6" />
        }
        @case ('bank') {
          <path d="m3 9 9-6 9 6zm2 3v7m5-7v7m4-7v7m5-7v7M3 22h18" />
        }
        @case ('settings') {
          <path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6" />
        }
        @case ('catalog') {
          <path d="M4 3h4v18H4zm8 0h4v18h-4zm7 1 3 16" />
        }
        @case ('book') {
          <path d="M12 5v16m0-16C8 2 4 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-2-10 1" />
        }
        @case ('menu') {
          <path d="M4 6h16M4 12h16M4 18h16" />
        }
        @case ('close') {
          <path d="m6 6 12 12M6 18 18 6" />
        }
        @case ('check') {
          <path d="m20 6-11 11-5-5" />
        }
        @case ('arrow-left') {
          <path d="m12 19-7-7 7-7m-7 7h14" />
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6" />
        }
        @case ('chevron') {
          <path d="m8 9 4-4 4 4m-8 6 4 4 4-4" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="3" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        }
        @case ('logout') {
          <path d="M10 5H5v14h5m4-11 4 4-4 4m4-4H9" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('search') {
          <circle cx="10" cy="10" r="7" />
          <path d="m15 15 6 6" />
        }
        @case ('download') {
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        }
        @case ('filter') {
          <path d="M4 7h16M7 12h10M10 17h4" />
        }
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
