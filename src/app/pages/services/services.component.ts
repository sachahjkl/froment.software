import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { Icon } from '../../shared/icon/icon';
import { LinkButton } from '../../shared/link-button/link-button';

type ContentEntry = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [AnchorLink, Icon, LinkButton, RouterLink],
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
      href: '/services/audit-renovation',
      cta: this.i18n.t('services.offer.renovation.cta'),
    },
    {
      title: this.i18n.t('services.offer.development.title'),
      description: this.i18n.t('services.offer.development.desc'),
      href: '/services/developpement',
      cta: this.i18n.t('services.offer.development.cta'),
    },
  ]);
}
