import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';
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
  protected readonly policy = inject(ActivatedRoute).snapshot.data['policy'] as PolicyDocument;

  protected label(link: PolicyLink): string {
    return link.labelKey ? this.i18n.t(link.labelKey) : (link.label ?? '');
  }
}
