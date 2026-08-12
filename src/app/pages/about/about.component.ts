import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService, TranslationKey } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [AnchorLink, Icon],
  templateUrl: './about.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly contactMailto = computed(() => {
    const subject = encodeURIComponent(this.i18n.t('home.engage.subject'));
    const body = encodeURIComponent(this.i18n.t('home.engage.body'));
    return `mailto:contact@froment.software?subject=${subject}&body=${body}`;
  });

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
}
