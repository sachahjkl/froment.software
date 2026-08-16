import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { ConcreteExamples } from '../../shared/concrete-examples/concrete-examples';
import { Icon } from '../../shared/icon/icon';
import { ProcessTimeline, TimelineStep } from '../../shared/process-timeline/process-timeline';

type ContentEntry = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [AnchorLink, ConcreteExamples, Icon, ProcessTimeline],
  templateUrl: './services.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly calUrl = 'https://cal.com/sachahjkl';

  protected readonly quoteMailto = computed(() => {
    const subject = encodeURIComponent(this.i18n.t('services.quote.subject'));
    const body = encodeURIComponent(this.i18n.t('services.quote.body'));
    return `mailto:contact@froment.software?subject=${subject}&body=${body}`;
  });

  protected readonly services = computed<ContentEntry[]>(() => [
    {
      title: this.i18n.t('services.offer.renovation.title'),
      description: this.i18n.t('services.offer.renovation.desc'),
    },
    {
      title: this.i18n.t('services.offer.development.title'),
      description: this.i18n.t('services.offer.development.desc'),
    },
  ]);

  protected readonly process = computed<TimelineStep[]>(() => [
    {
      title: this.i18n.t('services.process.analysis.title'),
      description: this.i18n.t('services.process.analysis.desc'),
    },
    {
      title: this.i18n.t('services.process.quote.title'),
      description: this.i18n.t('services.process.quote.desc'),
    },
    {
      title: this.i18n.t('services.process.agreement.title'),
      description: this.i18n.t('services.process.agreement.desc'),
    },
    {
      title: this.i18n.t('services.process.delivery.title'),
      description: this.i18n.t('services.process.delivery.desc'),
    },
    {
      title: this.i18n.t('services.process.validation.title'),
      description: this.i18n.t('services.process.validation.desc'),
    },
  ]);
}
