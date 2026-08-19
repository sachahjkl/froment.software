import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService, TranslationKey } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { ContactActions } from '../../shared/contact-actions/contact-actions';

type Offer = 'renovation' | 'development';

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

const detailContent: Record<Offer, DetailContent> = {
  renovation: {
    titleKey: 'serviceDetail.renovation.title',
    leadKey: 'serviceDetail.renovation.lead',
    scopeTitleKey: 'serviceDetail.renovation.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.renovation.scope.projects.title',
        descriptionKey: 'serviceDetail.renovation.scope.projects.desc',
      },
      {
        titleKey: 'serviceDetail.renovation.scope.delivery.title',
        descriptionKey: 'serviceDetail.renovation.scope.delivery.desc',
      },
      {
        titleKey: 'serviceDetail.renovation.scope.quality.title',
        descriptionKey: 'serviceDetail.renovation.scope.quality.desc',
        links: [
          {
            labelKey: 'serviceDetail.renovation.scope.quality.staticAnalysis',
            href: 'https://owasp.org/www-community/Source_Code_Analysis_Tools',
          },
          {
            labelKey: 'serviceDetail.renovation.scope.quality.trufflehog',
            href: 'https://trufflesecurity.com/trufflehog',
          },
        ],
      },
      {
        titleKey: 'serviceDetail.renovation.scope.environment.title',
        descriptionKey: 'serviceDetail.renovation.scope.environment.desc',
      },
    ],
    deliverablesTitleKey: 'serviceDetail.renovation.deliverables.title',
    deliverableKeys: [
      'serviceDetail.renovation.deliverables.audit',
      'serviceDetail.renovation.deliverables.plan',
      'serviceDetail.renovation.deliverables.work',
      'serviceDetail.renovation.deliverables.handover',
    ],
    fitTitleKey: 'serviceDetail.renovation.fit.title',
    fitDescriptionKey: 'serviceDetail.renovation.fit.desc',
  },
  development: {
    titleKey: 'serviceDetail.development.title',
    leadKey: 'serviceDetail.development.lead',
    scopeTitleKey: 'serviceDetail.development.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.development.scope.design.title',
        descriptionKey: 'serviceDetail.development.scope.design.desc',
      },
      {
        titleKey: 'serviceDetail.development.scope.build.title',
        descriptionKey: 'serviceDetail.development.scope.build.desc',
      },
      {
        titleKey: 'serviceDetail.development.scope.tests.title',
        descriptionKey: 'serviceDetail.development.scope.tests.desc',
      },
      {
        titleKey: 'serviceDetail.development.scope.deploy.title',
        descriptionKey: 'serviceDetail.development.scope.deploy.desc',
      },
    ],
    deliverablesTitleKey: 'serviceDetail.development.deliverables.title',
    deliverableKeys: [
      'serviceDetail.development.deliverables.product',
      'serviceDetail.development.deliverables.source',
      'serviceDetail.development.deliverables.tests',
      'serviceDetail.development.deliverables.operations',
    ],
    fitTitleKey: 'serviceDetail.development.fit.title',
    fitDescriptionKey: 'serviceDetail.development.fit.desc',
  },
};

@Component({
  selector: 'app-service-detail',
  imports: [AnchorLink, ContactActions, RouterLink],
  templateUrl: './service-detail.html',
  styleUrl: './service-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetail {
  protected readonly i18n = inject(I18nService);
  protected readonly content =
    detailContent[inject(ActivatedRoute).snapshot.data['offer'] as Offer];
}
