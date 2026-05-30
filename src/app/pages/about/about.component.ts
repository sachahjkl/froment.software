import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly faqKeys: { question: string; answerKey?: string }[] = [
    { question: this.i18n.t('about.faq.process.q') },
    { question: this.i18n.t('about.faq.stack.q') },
    { question: this.i18n.t('about.faq.remote.q') },
    { question: this.i18n.t('about.faq.nda.q') },
    { question: this.i18n.t('about.faq.timeline.q') },
    { question: this.i18n.t('about.faq.maintenance.q') },
    { question: this.i18n.t('about.faq.pricing.q') },
    { question: this.i18n.t('about.faq.availability.q') },
  ];
}
