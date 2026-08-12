import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

type LabEntry = {
  title: string;
  description: string;
  status: string;
  href: string;
  cta: string;
};

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
})
export class ToolsComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly labEntries = computed<LabEntry[]>(() => [
    {
      title: 'albumator.sacha.house',
      description: this.i18n.t('home.timeline.albumator.desc'),
      status: this.i18n.t('products.status.prototype'),
      href: 'https://albumator.sacha.house',
      cta: this.i18n.t('home.timeline.albumator.cta'),
    },
    {
      title: 'sacha.house',
      description: this.i18n.t('home.timeline.sacha.desc'),
      status: this.i18n.t('products.status.public'),
      href: 'https://sacha.house',
      cta: this.i18n.t('home.timeline.sacha.cta'),
    },
    {
      title: 'clockin.sacha.house',
      description: this.i18n.t('home.timeline.clockin.desc'),
      status: this.i18n.t('products.status.prototype'),
      href: 'https://clockin.sacha.house',
      cta: this.i18n.t('home.timeline.clockin.cta'),
    },
    {
      title: 'htmx.sacha.house',
      description: this.i18n.t('home.timeline.htmx.desc'),
      status: this.i18n.t('products.status.experiment'),
      href: 'https://htmx.sacha.house',
      cta: this.i18n.t('home.timeline.htmx.cta'),
    },
  ]);
}
