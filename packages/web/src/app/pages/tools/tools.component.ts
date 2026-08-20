import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { AnchorLink } from '@shared/anchor-link/anchor-link';

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
  imports: [AnchorLink],
  templateUrl: './tools.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
