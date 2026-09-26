import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { AnchorLink } from '@shared/anchor-link/anchor-link';
import { ContactActions } from '@shared/contact-actions/contact-actions';

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
      title: this.i18n.t('services.offer.audit.title'),
      description: this.i18n.t('services.offer.audit.desc'),
      href: this.i18n.localizedPath('/services/audit'),
      cta: this.i18n.t('services.offer.audit.cta'),
    },
    {
      title: this.i18n.t('services.offer.modernization.title'),
      description: this.i18n.t('services.offer.modernization.desc'),
      href: this.i18n.localizedPath('/services/modernization'),
      cta: this.i18n.t('services.offer.modernization.cta'),
    },
    {
      title: this.i18n.t('services.offer.delivery.title'),
      description: this.i18n.t('services.offer.delivery.desc'),
      href: this.i18n.localizedPath('/services/delivery-operations'),
      cta: this.i18n.t('services.offer.delivery.cta'),
    },
  ]);
}
