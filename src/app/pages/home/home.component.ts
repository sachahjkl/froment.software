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
      title: this.i18n.t('home.services.applications.title'),
      description: this.i18n.t('home.services.applications.desc'),
    },
    {
      title: this.i18n.t('home.services.internal.title'),
      description: this.i18n.t('home.services.internal.desc'),
    },
    {
      title: this.i18n.t('home.services.renovation.title'),
      description: this.i18n.t('home.services.renovation.desc'),
    },
  ]);

}
