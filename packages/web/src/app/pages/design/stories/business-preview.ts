import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  type OnChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import type { DocumentIssueValue } from '@froment/contracts';
import { BackOfficeHeader } from '@shared/back-office-header/back-office-header';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { GlobalSearch } from '@shared/global-search/global-search';
import { DocumentIssues } from '@shared/document-issues/document-issues';
import { Button } from '@shared/button/button';
import { BusinessContext, businessProviders, type BusinessSettings } from './business-context';

@Component({
  imports: [BackOfficeHeader, BackOfficeNav, GlobalSearch, DocumentIssues, Button],
  providers: businessProviders,
  selector: 'app-business-preview',
  styleUrl: './business-preview.scss',
  templateUrl: './business-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessPreview implements OnChanges {
  readonly component = input.required<string>();
  readonly settings = input.required<BusinessSettings>();
  protected readonly context = inject(BusinessContext);
  protected readonly text = this.context.text;
  protected readonly issues = computed<readonly DocumentIssueValue[]>(() => {
    const issues: readonly DocumentIssueValue[] = [
      { party: 'issuer', field: 'addressLine1', reason: 'required' },
      { party: 'client', field: 'email', reason: 'invalid_email' },
    ];
    return issues.filter(
      (issue) => this.settings().party === 'both' || issue.party === this.settings().party,
    );
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const pageRouter = inject(Router, { skipSelf: true });
    // Le lien HTML natif ne doit pas ouvrir la documentation API, même dans un autre onglet.
    afterEveryRender(() => {
      for (const link of host.querySelectorAll<HTMLAnchorElement>('a[href="/api/docs"]')) {
        link.dataset['referenceDestination'] = '/api/docs';
        link.href = pageRouter.url;
      }
    });
    const capture = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[data-reference-destination]');
      const destination = link?.dataset['referenceDestination'];
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      this.context.navigate(destination);
    };
    host.addEventListener('click', capture, true);
    host.addEventListener('auxclick', capture, true);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('click', capture, true);
      host.removeEventListener('auxclick', capture, true);
    });
  }

  ngOnChanges(): void {
    this.context.scenario = this.settings().scenario;
    this.context.administrator = this.settings().administrator;
    this.context.navigate(this.settings().path);
    this.context.destination.set('');
  }
}
