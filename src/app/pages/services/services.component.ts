import { Component, computed, inject } from '@angular/core';
import { I18nService } from '../../i18n.service';

type ServiceEntry = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-services',
  standalone: true,
  templateUrl: './services.component.html',
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

  protected readonly services = computed<ServiceEntry[]>(() => [
    {
      title: this.i18n.t('services.entry.web.title'),
      description: this.i18n.t('services.entry.web.desc'),
    },
    {
      title: this.i18n.t('services.entry.desktop.title'),
      description: this.i18n.t('services.entry.desktop.desc'),
    },
    {
      title: this.i18n.t('services.entry.cli.title'),
      description: this.i18n.t('services.entry.cli.desc'),
    },
    {
      title: this.i18n.t('services.entry.legacy.title'),
      description: this.i18n.t('services.entry.legacy.desc'),
    },
    {
      title: this.i18n.t('services.entry.consulting.title'),
      description: this.i18n.t('services.entry.consulting.desc'),
    },
  ]);
}
