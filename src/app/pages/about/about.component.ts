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

  protected readonly faqKeys: { question: string; answerKey: TranslationKey }[] = [
    { question: this.i18n.t('about.faq.process.q'), answerKey: 'about.faq.process.a' },
    { question: this.i18n.t('about.faq.stack.q'), answerKey: 'about.faq.stack.a' },
    { question: this.i18n.t('about.faq.remote.q'), answerKey: 'about.faq.remote.a' },
    { question: this.i18n.t('about.faq.nda.q'), answerKey: 'about.faq.nda.a' },
    { question: this.i18n.t('about.faq.timeline.q'), answerKey: 'about.faq.timeline.a' },
    { question: this.i18n.t('about.faq.maintenance.q'), answerKey: 'about.faq.maintenance.a' },
    { question: this.i18n.t('about.faq.pricing.q'), answerKey: 'about.faq.pricing.a' },
    { question: this.i18n.t('about.faq.availability.q'), answerKey: 'about.faq.availability.a' },
  ];
}
