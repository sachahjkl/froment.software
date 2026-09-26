import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Icon, type IconName } from '@shared/icon/icon';
import { NewLabel } from '@shared/new-label/new-label';

type Project = {
  name: string;
  description: string;
  cta: string;
  href: string;
  image: string;
};

type Offer = {
  title: string;
  description: string;
  href: string;
  icon: IconName;
};

@Component({
  selector: 'app-home',
  imports: [Button, Icon, NewLabel, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly projects = computed<readonly Project[]>(() => [
    {
      name: 'Backoffice',
      description: this.i18n.t('home.projects.backoffice.desc'),
      cta: this.i18n.t('home.projects.backoffice.cta'),
      href: 'https://github.com/sachahjkl/backoffice',
      image: '/projects/backoffice.png',
    },
    {
      name: 'Clock-in',
      description: this.i18n.t('home.projects.clockin.desc'),
      cta: this.i18n.t('home.projects.clockin.cta'),
      href: 'https://clockin.sacha.house',
      image: '/projects/clockin.png',
    },
    {
      name: 'dw',
      description: this.i18n.t('home.projects.dw.desc'),
      cta: this.i18n.t('home.projects.dw.cta'),
      href: 'https://github.com/sachahjkl/dw',
      image: '/projects/dw.png',
    },
    {
      name: 'Albumator',
      description: this.i18n.t('home.projects.albumator.desc'),
      cta: this.i18n.t('home.projects.albumator.cta'),
      href: 'https://albumator.sacha.house',
      image: '/projects/albumator.png',
    },
  ]);

  protected readonly offers = computed<readonly Offer[]>(() => [
    {
      title: this.i18n.t('home.offers.audit.title'),
      description: this.i18n.t('home.offers.audit.desc'),
      href: this.i18n.localizedPath('/services/audit-renovation'),
      icon: 'audit',
    },
    {
      title: this.i18n.t('home.offers.renovation.title'),
      description: this.i18n.t('home.offers.renovation.desc'),
      href: this.i18n.localizedPath('/services/audit-renovation'),
      icon: 'renovation',
    },
    {
      title: this.i18n.t('home.offers.delivery.title'),
      description: this.i18n.t('home.offers.delivery.desc'),
      href: this.i18n.localizedPath('/services/development'),
      icon: 'delivery',
    },
  ]);
}
