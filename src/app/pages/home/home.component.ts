import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';
import { AnchorLink } from '../../shared/anchor-link/anchor-link';
import { ConcreteExamples } from '../../shared/concrete-examples/concrete-examples';
import { Icon } from '../../shared/icon/icon';

type PublicEntry = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

type ContentEntry = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [AnchorLink, ConcreteExamples, Icon, RouterLink],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly calUrl = 'https://cal.com/sachahjkl';

  protected readonly contactMailto = computed(() => {
    const subject = encodeURIComponent(this.i18n.t('home.engage.subject'));
    const body = encodeURIComponent(this.i18n.t('home.engage.body'));
    return `mailto:contact@froment.software?subject=${subject}&body=${body}`;
  });

  protected readonly publicEntries = computed<PublicEntry[]>(() => [
    {
      title: 'albumator.sacha.house',
      description: this.i18n.t('home.timeline.albumator.desc'),
      href: 'https://albumator.sacha.house',
      cta: this.i18n.t('home.timeline.albumator.cta'),
    },
    {
      title: 'sacha.house',
      description: this.i18n.t('home.timeline.sacha.desc'),
      href: 'https://sacha.house',
      cta: this.i18n.t('home.timeline.sacha.cta'),
    },
    {
      title: 'clockin.sacha.house',
      description: this.i18n.t('home.timeline.clockin.desc'),
      href: 'https://clockin.sacha.house',
      cta: this.i18n.t('home.timeline.clockin.cta'),
    },
    {
      title: 'htmx.sacha.house',
      description: this.i18n.t('home.timeline.htmx.desc'),
      href: 'https://htmx.sacha.house',
      cta: this.i18n.t('home.timeline.htmx.cta'),
    },
  ]);

  protected readonly services = computed<ContentEntry[]>(() => [
    {
      title: this.i18n.t('home.services.renovation.title'),
      description: this.i18n.t('home.services.renovation.desc'),
    },
    {
      title: this.i18n.t('home.services.development.title'),
      description: this.i18n.t('home.services.development.desc'),
    },
  ]);
}
