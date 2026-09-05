import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type DocumentIssueValue, type UlidValue } from '@froment/contracts';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Notice } from '@shared/notice/notice';

const fieldKeys = {
  displayName: 'document.field.name',
  addressLine1: 'backOffice.clients.addressLine1',
  city: 'backOffice.clients.city',
  country: 'backOffice.clients.country',
  email: 'backOffice.clients.email',
} as const satisfies Record<DocumentIssueValue['field'], TranslationKey>;

@Component({
  selector: 'app-document-issues',
  imports: [Notice, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div appNotice variant="warning" role="alert">
      <p>
        <strong>{{ i18n.t('document.incomplete') }}</strong>
      </p>
      @for (group of groups(); track group.party) {
        <div class="party">
          <a
            [routerLink]="
              group.party === 'issuer'
                ? ['/backoffice/configuration/entreprise']
                : ['/backoffice/clients', clientId(), 'profile']
            "
          >
            {{ i18n.t(group.party === 'issuer' ? 'document.issuer.edit' : 'document.client.edit') }}
          </a>
          <ul>
            @for (issue of group.issues; track issue.field) {
              <li>
                {{
                  i18n.tf('document.issue', {
                    field: i18n.t(fieldKeys[issue.field]),
                    reason: i18n.t(
                      issue.reason === 'required' ? 'document.required' : 'document.invalidEmail'
                    ),
                  })
                }}
              </li>
            }
          </ul>
        </div>
      }
      <p>
        {{ i18n.t(kind() === 'quote' ? 'document.quote.recovery' : 'document.invoice.recovery') }}
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-block: var(--space-4);
    }
    .party {
      margin-block: var(--space-4);
    }
    ul {
      margin: var(--space-2) 0 0;
      padding-inline-start: var(--space-5);
    }
    li + li {
      margin-top: var(--space-1);
    }
  `,
})
export class DocumentIssues {
  readonly issues = input.required<ReadonlyArray<DocumentIssueValue>>();
  readonly clientId = input.required<UlidValue>();
  readonly kind = input.required<'quote' | 'invoice'>();
  protected readonly i18n = inject(I18nService);
  protected readonly fieldKeys = fieldKeys;
  protected readonly groups = computed(() =>
    (['issuer', 'client'] as const)
      .map((party) => ({ party, issues: this.issues().filter((issue) => issue.party === party) }))
      .filter((group) => group.issues.length > 0),
  );
}
