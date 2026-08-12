import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { ConcreteExamples } from '../../shared/concrete-examples/concrete-examples';
import { Icon } from '../../shared/icon/icon';

type ContentEntry = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [AnchorLink, ConcreteExamples, Icon],
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
      title: this.i18n.t('services.entry.applications.title'),
      description: this.i18n.t('services.entry.applications.desc'),
    },
    {
      title: this.i18n.t('services.entry.internal.title'),
      description: this.i18n.t('services.entry.internal.desc'),
    },
    {
      title: this.i18n.t('services.entry.renovation.title'),
      description: this.i18n.t('services.entry.renovation.desc'),
    },
  ]);

  protected readonly process = computed<ContentEntry[]>(() => [
    {
      title: this.i18n.t('services.process.discovery.title'),
      description: this.i18n.t('services.process.discovery.desc'),
    },
    {
      title: this.i18n.t('services.process.scope.title'),
      description: this.i18n.t('services.process.scope.desc'),
    },
    {
      title: this.i18n.t('services.process.build.title'),
      description: this.i18n.t('services.process.build.desc'),
    },
    {
      title: this.i18n.t('services.process.handover.title'),
      description: this.i18n.t('services.process.handover.desc'),
    },
  ]);
}
