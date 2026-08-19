import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { ContactActions } from '../../shared/contact-actions/contact-actions';

type ContentEntry = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [AnchorLink, ContactActions, RouterLink],
  templateUrl: './services.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  protected readonly i18n = inject(I18nService);
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
