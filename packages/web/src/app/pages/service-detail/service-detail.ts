import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { AnchorLink } from '@shared/anchor-link/anchor-link';
import { ContactActions } from '@shared/contact-actions/contact-actions';

type Offer = 'creation' | 'renovation';

type DetailContent = {
  titleKey: TranslationKey;
  leadKey: TranslationKey;
  scopeTitleKey: TranslationKey;
  scopes: readonly { titleKey: TranslationKey; descriptionKey: TranslationKey }[];
  deliverableKeys: readonly TranslationKey[];
  startDescriptionKey: TranslationKey;
};

const detailContent = {
  creation: {
    titleKey: 'serviceDetail.creation.title',
    leadKey: 'serviceDetail.creation.lead',
    scopeTitleKey: 'serviceDetail.creation.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.creation.scope.desktop.title',
        descriptionKey: 'serviceDetail.creation.scope.desktop.desc',
      },
      {
        titleKey: 'serviceDetail.creation.scope.web.title',
        descriptionKey: 'serviceDetail.creation.scope.web.desc',
      },
      {
        titleKey: 'serviceDetail.creation.scope.internal.title',
        descriptionKey: 'serviceDetail.creation.scope.internal.desc',
      },
    ],
    deliverableKeys: [
      'serviceDetail.deliverables.source',
      'serviceDetail.deliverables.tests',
      'serviceDetail.deliverables.documentation',
      'serviceDetail.deliverables.setup',
      'serviceDetail.deliverables.licence',
    ],
    startDescriptionKey: 'serviceDetail.creation.start.desc',
  },
  renovation: {
    titleKey: 'serviceDetail.renovation.title',
    leadKey: 'serviceDetail.renovation.lead',
    scopeTitleKey: 'serviceDetail.renovation.scope.title',
    scopes: [
      {
        titleKey: 'serviceDetail.renovation.scope.study.title',
        descriptionKey: 'serviceDetail.renovation.scope.study.desc',
      },
      {
        titleKey: 'serviceDetail.renovation.scope.baseline.title',
        descriptionKey: 'serviceDetail.renovation.scope.baseline.desc',
      },
      {
        titleKey: 'serviceDetail.renovation.scope.rewrite.title',
        descriptionKey: 'serviceDetail.renovation.scope.rewrite.desc',
      },
      {
        titleKey: 'serviceDetail.renovation.scope.comparison.title',
        descriptionKey: 'serviceDetail.renovation.scope.comparison.desc',
      },
    ],
    deliverableKeys: [
      'serviceDetail.deliverables.source',
      'serviceDetail.deliverables.tests',
      'serviceDetail.deliverables.documentation',
      'serviceDetail.deliverables.migration',
      'serviceDetail.deliverables.measurements',
      'serviceDetail.deliverables.licence',
    ],
    startDescriptionKey: 'serviceDetail.renovation.start.desc',
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
