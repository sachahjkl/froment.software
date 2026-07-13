import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

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
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly calUrl = 'https://cal.com/sachahjkl';

  protected readonly publicEntries = computed<PublicEntry[]>(() => [
    {
      title: 'albumator.sacha.house',
      description: this.i18n.t('home.timeline.albumator.desc'),
      href: 'https://albumator.sacha.house',
      cta: this.i18n.t('home.timeline.albumator.cta'),
    },
    {
      title: 'htmx.sacha.house',
      description: this.i18n.t('home.timeline.htmx.desc'),
      href: 'https://htmx.sacha.house',
      cta: this.i18n.t('home.timeline.htmx.cta'),
    },
    {
      title: 'sacha.house',
      description: this.i18n.t('home.timeline.sacha.desc'),
      href: 'https://sacha.house',
      cta: this.i18n.t('home.timeline.sacha.cta'),
    },
  ]);

  protected readonly fitEntries = computed<ContentEntry[]>(() => [
    {
      title: this.i18n.t('home.fit.internal.title'),
      description: this.i18n.t('home.fit.internal.desc'),
    },
    {
      title: this.i18n.t('home.fit.legacy.title'),
      description: this.i18n.t('home.fit.legacy.desc'),
    },
    {
      title: this.i18n.t('home.fit.delivery.title'),
      description: this.i18n.t('home.fit.delivery.desc'),
    },
  ]);

  protected readonly services = computed<ContentEntry[]>(() => [
    {
      title: this.i18n.t('home.services.web.title'),
      description: this.i18n.t('home.services.web.desc'),
    },
    {
      title: this.i18n.t('home.services.desktop.title'),
      description: this.i18n.t('home.services.desktop.desc'),
    },
    {
      title: this.i18n.t('home.services.cli.title'),
      description: this.i18n.t('home.services.cli.desc'),
    },
    {
      title: this.i18n.t('home.services.legacy.title'),
      description: this.i18n.t('home.services.legacy.desc'),
    },
    {
      title: this.i18n.t('home.services.consulting.title'),
      description: this.i18n.t('home.services.consulting.desc'),
    },
  ]);

  protected readonly references = ['Alstom', 'AG2R La Mondiale', 'OGF'];
}
