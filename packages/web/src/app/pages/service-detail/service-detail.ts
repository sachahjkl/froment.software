import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { AnchorLink } from '@shared/anchor-link/anchor-link';
import { ContactActions } from '@shared/contact-actions/contact-actions';

type Offer = 'audit' | 'modernization' | 'delivery';

type DetailContent = {
  titleKey: TranslationKey;
  leadKey: TranslationKey;
  scopeTitleKey: TranslationKey;
  scopes: readonly {
    titleKey: TranslationKey;
    descriptionKey: TranslationKey;
    links?: readonly { labelKey: TranslationKey; href: string }[];
  }[];
  deliverablesTitleKey: TranslationKey;
  deliverableKeys: readonly TranslationKey[];
  fitTitleKey: TranslationKey;
  fitDescriptionKey: TranslationKey;
};

const detailContent = {
  audit: {
    titleKey: 'serviceDetail.audit.title',
    leadKey: 'serviceDetail.audit.lead',
    scopeTitleKey: 'serviceDetail.audit.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.audit.scope.architecture.title',
        descriptionKey: 'serviceDetail.audit.scope.architecture.desc',
      },
      {
        titleKey: 'serviceDetail.audit.scope.delivery.title',
        descriptionKey: 'serviceDetail.audit.scope.delivery.desc',
      },
      {
        titleKey: 'serviceDetail.audit.scope.security.title',
        descriptionKey: 'serviceDetail.audit.scope.security.desc',
        links: [
          {
            labelKey: 'serviceDetail.audit.scope.security.staticAnalysis',
            href: 'https://owasp.org/www-community/Source_Code_Analysis_Tools',
          },
          {
            labelKey: 'serviceDetail.audit.scope.security.trufflehog',
            href: 'https://trufflesecurity.com/trufflehog',
          },
        ],
      },
      {
        titleKey: 'serviceDetail.audit.scope.environment.title',
        descriptionKey: 'serviceDetail.audit.scope.environment.desc',
      },
    ],
    deliverablesTitleKey: 'serviceDetail.audit.deliverables.title',
    deliverableKeys: [
      'serviceDetail.audit.deliverables.report',
      'serviceDetail.audit.deliverables.map',
      'serviceDetail.audit.deliverables.plan',
      'serviceDetail.audit.deliverables.review',
    ],
    fitTitleKey: 'serviceDetail.audit.fit.title',
    fitDescriptionKey: 'serviceDetail.audit.fit.desc',
  },
  modernization: {
    titleKey: 'serviceDetail.modernization.title',
    leadKey: 'serviceDetail.modernization.lead',
    scopeTitleKey: 'serviceDetail.modernization.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.modernization.scope.takeover.title',
        descriptionKey: 'serviceDetail.modernization.scope.takeover.desc',
      },
      {
        titleKey: 'serviceDetail.modernization.scope.stability.title',
        descriptionKey: 'serviceDetail.modernization.scope.stability.desc',
      },
      {
        titleKey: 'serviceDetail.modernization.scope.refactoring.title',
        descriptionKey: 'serviceDetail.modernization.scope.refactoring.desc',
      },
      {
        titleKey: 'serviceDetail.modernization.scope.upgrades.title',
        descriptionKey: 'serviceDetail.modernization.scope.upgrades.desc',
      },
    ],
    deliverablesTitleKey: 'serviceDetail.modernization.deliverables.title',
    deliverableKeys: [
      'serviceDetail.modernization.deliverables.environment',
      'serviceDetail.modernization.deliverables.changes',
      'serviceDetail.modernization.deliverables.tests',
      'serviceDetail.modernization.deliverables.handover',
    ],
    fitTitleKey: 'serviceDetail.modernization.fit.title',
    fitDescriptionKey: 'serviceDetail.modernization.fit.desc',
  },
  delivery: {
    titleKey: 'serviceDetail.delivery.title',
    leadKey: 'serviceDetail.delivery.lead',
    scopeTitleKey: 'serviceDetail.delivery.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.delivery.scope.ci.title',
        descriptionKey: 'serviceDetail.delivery.scope.ci.desc',
      },
      {
        titleKey: 'serviceDetail.delivery.scope.packaging.title',
        descriptionKey: 'serviceDetail.delivery.scope.packaging.desc',
      },
      {
        titleKey: 'serviceDetail.delivery.scope.deployment.title',
        descriptionKey: 'serviceDetail.delivery.scope.deployment.desc',
      },
      {
        titleKey: 'serviceDetail.delivery.scope.operations.title',
        descriptionKey: 'serviceDetail.delivery.scope.operations.desc',
      },
    ],
    deliverablesTitleKey: 'serviceDetail.delivery.deliverables.title',
    deliverableKeys: [
      'serviceDetail.delivery.deliverables.pipeline',
      'serviceDetail.delivery.deliverables.configuration',
      'serviceDetail.delivery.deliverables.observability',
      'serviceDetail.delivery.deliverables.runbook',
    ],
    fitTitleKey: 'serviceDetail.delivery.fit.title',
    fitDescriptionKey: 'serviceDetail.delivery.fit.desc',
  },
} satisfies Record<Offer, DetailContent>;

@Component({
  selector: 'app-service-detail',
  imports: [AnchorLink, ContactActions, RouterLink],
  templateUrl: './service-detail.html',
  styleUrl: './service-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetail {
  protected readonly i18n = inject(I18nService);
  readonly offer = input.required<Offer>();
  protected readonly content = computed<DetailContent>(() => detailContent[this.offer()]);
}
