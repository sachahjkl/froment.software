import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { AnchorCopy } from '../anchor-copy';

@Component({
  selector: 'app-anchor-link',
  template: `
    <a
      class="anchor-link"
      [href]="'#' + fragment()"
      [attr.aria-label]="i18n.t('shell.copy_link')"
      (click)="copy()"
      >#</a
    >
  `,
  styles: `
    :host {
      display: inline-flex;
      margin-left: var(--space-2);
    }
    .anchor-link {
      padding-inline: var(--space-1);
      color: var(--color-muted);
      font-weight: 400;
      text-decoration: none;
      opacity: 0.45;
      transition: opacity var(--duration-base) var(--ease-out);
    }
    .anchor-link:focus-visible {
      opacity: 1;
    }
    :host-context(.anchored-title:hover) .anchor-link {
      opacity: 0.45;
    }
    .anchor-link:hover {
      opacity: 1 !important;
    }
    @media (prefers-reduced-motion: reduce) {
      .anchor-link {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnchorLink {
  protected readonly i18n = inject(I18nService);
  private readonly anchorCopy = inject(AnchorCopy);
  readonly fragment = input.required<string>();

  protected copy(): void {
    void this.anchorCopy.copy(this.fragment(), this.i18n.t('shell.link_copied'));
  }
}
