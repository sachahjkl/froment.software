import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { PolicyDocument, PolicyLink } from './policy-documents';

@Component({
  selector: 'app-policy-page',
  imports: [RouterLink],
  templateUrl: './policy-page.html',
  styleUrl: './policy-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyPage {
  protected readonly i18n = inject(I18nService);
  readonly policy = input.required<PolicyDocument>();

  protected label(link: PolicyLink): string {
    return link.labelKey ? this.i18n.t(link.labelKey) : (link.label ?? '');
  }
}
