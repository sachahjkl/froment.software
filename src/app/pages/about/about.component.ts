import { Component, inject } from '@angular/core';
import { I18nService, TranslationKey } from '../../i18n.service';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly faqKeys: { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
    { questionKey: 'about.faq.process.q', answerKey: 'about.faq.process.a' },
    { questionKey: 'about.faq.stack.q', answerKey: 'about.faq.stack.a' },
    { questionKey: 'about.faq.remote.q', answerKey: 'about.faq.remote.a' },
    { questionKey: 'about.faq.nda.q', answerKey: 'about.faq.nda.a' },
    { questionKey: 'about.faq.timeline.q', answerKey: 'about.faq.timeline.a' },
    { questionKey: 'about.faq.maintenance.q', answerKey: 'about.faq.maintenance.a' },
    { questionKey: 'about.faq.pricing.q', answerKey: 'about.faq.pricing.a' },
    { questionKey: 'about.faq.availability.q', answerKey: 'about.faq.availability.a' },
  ];

  protected readonly approachKeys: {
    titleKey: TranslationKey;
    descriptionKey: TranslationKey;
  }[] = [
    {
      titleKey: 'about.approach.context.title',
      descriptionKey: 'about.approach.context.desc',
    },
    {
      titleKey: 'about.approach.progress.title',
      descriptionKey: 'about.approach.progress.desc',
    },
    {
      titleKey: 'about.approach.handover.title',
      descriptionKey: 'about.approach.handover.desc',
    },
  ];

  protected readonly references: { name: string; sectorKey: TranslationKey }[] = [
    { name: 'Alstom', sectorKey: 'about.bio.ref1' },
    { name: 'AG2R La Mondiale', sectorKey: 'about.bio.ref2' },
    { name: 'OGF', sectorKey: 'about.bio.ref3' },
  ];
}
