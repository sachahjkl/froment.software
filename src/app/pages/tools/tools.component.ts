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

type PrincipleEntry = {
  title: string;
  description: string;
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
      title: 'htmx.sacha.house',
      description: this.i18n.t('home.timeline.htmx.desc'),
      status: this.i18n.t('products.status.experiment'),
      href: 'https://htmx.sacha.house',
      cta: this.i18n.t('home.timeline.htmx.cta'),
    },
    {
      title: 'sacha.house',
      description: this.i18n.t('home.timeline.sacha.desc'),
      status: this.i18n.t('products.status.public'),
      href: 'https://sacha.house',
      cta: this.i18n.t('home.timeline.sacha.cta'),
    },
  ]);

  protected readonly principles = computed<PrincipleEntry[]>(() => [
    {
      title: this.i18n.t('products.principles.focus.title'),
      description: this.i18n.t('products.principles.focus.desc'),
    },
    {
      title: this.i18n.t('products.principles.real.title'),
      description: this.i18n.t('products.principles.real.desc'),
    },
    {
      title: this.i18n.t('products.principles.honest.title'),
      description: this.i18n.t('products.principles.honest.desc'),
    },
  ]);
}
