import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { releases } from '@app/releases';
import { Icon } from '@shared/icon/icon';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { NewLabel } from '@shared/new-label/new-label';

const contactAddress = 'contact@froment.software';
const bookingAddress = 'cal.com/sachahjkl';

const newsVersions = 3;
const newsLeads = 3;

// The bold summary that starts each entry, as plain text.
const summary = (entry: string): string => /^\*\*(.+?)\*\*/.exec(entry)?.[1] ?? entry;

// The latest versions, each with the summaries of its first entries.
const news = releases.slice(0, newsVersions).map((release) => {
  const entries = release.sections.flatMap((section) => section.entries);
  return {
    version: release.version,
    date: release.date,
    leads: entries.slice(0, newsLeads).map(summary),
    more: Math.max(0, entries.length - newsLeads),
  };
});

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
};

@Component({
  selector: 'app-home',
  imports: [Icon, LocalizedDatePipe, NewLabel, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly news = news;
  protected readonly contactAddress = contactAddress;
  protected readonly contactHref = `mailto:${contactAddress}`;
  protected readonly bookingAddress = bookingAddress;
  protected readonly bookingHref = `https://${bookingAddress}`;

  protected moreLabel(count: number): string {
    return this.i18n.tf('home.news.more', { count });
  }

  // The desktop suite is what atelier installs: a fact, not a ranking.
  protected readonly suite = computed<readonly Project[]>(() => [
    {
      name: 'atelier',
      description: this.i18n.t('home.projects.atelier.desc'),
      cta: this.i18n.t('home.projects.atelier.cta'),
      href: 'https://atelier.froment.software',
      image: '/projects/atelier.png',
    },
    {
      name: this.i18n.t('home.projects.opencodenative.name'),
      description: this.i18n.t('home.projects.opencodenative.desc'),
      cta: this.i18n.t('home.projects.opencodenative.cta'),
      href: 'https://ocn.froment.software',
      image: '/projects/opencode-native.png',
    },
    {
      name: 'papier',
      description: this.i18n.t('home.projects.papier.desc'),
      cta: this.i18n.t('home.projects.papier.cta'),
      href: 'https://papier.froment.software',
      image: '/projects/papier.png',
    },
    {
      name: 'classeur',
      description: this.i18n.t('home.projects.classeur.desc'),
      cta: this.i18n.t('home.projects.classeur.cta'),
      href: 'https://classeur.froment.software',
      image: '/projects/classeur.png',
    },
    {
      name: 'inspecteur',
      description: this.i18n.t('home.projects.inspecteur.desc'),
      cta: this.i18n.t('home.projects.inspecteur.cta'),
      href: 'https://inspecteur.froment.software',
      image: '/projects/inspecteur.png',
    },
    {
      name: 'cliche',
      description: this.i18n.t('home.projects.cliche.desc'),
      cta: this.i18n.t('home.projects.cliche.cta'),
      href: 'https://cliche.froment.software',
      image: '/projects/cliche.png',
    },
    {
      name: 'feuille',
      description: this.i18n.t('home.projects.feuille.desc'),
      cta: this.i18n.t('home.projects.feuille.cta'),
      href: 'https://feuille.froment.software',
      image: '/projects/feuille.png',
    },
  ]);

  protected readonly others = computed<readonly Project[]>(() => [
    {
      name: 'Wren',
      description: this.i18n.t('home.projects.wren.desc'),
      cta: this.i18n.t('home.projects.wren.cta'),
      href: 'https://wren.froment.software',
      image: '/projects/wren.png',
    },
    {
      name: 'modus',
      description: this.i18n.t('home.projects.modus.desc'),
      cta: this.i18n.t('home.projects.modus.cta'),
      href: 'https://modus.froment.software',
      image: '/projects/modus.png',
    },
    {
      name: 'shojiwm-desktop',
      description: this.i18n.t('home.projects.shojiwmdesktop.desc'),
      cta: this.i18n.t('home.projects.shojiwmdesktop.cta'),
      href: 'https://desktop.froment.software',
      image: '/projects/shojiwm-desktop.png',
    },
    {
      name: 'PetitPécule',
      description: this.i18n.t('home.projects.petitpecule.desc'),
      cta: this.i18n.t('home.projects.petitpecule.cta'),
      href: 'https://petitpecule.froment.software',
      image: '/projects/petitpecule.png',
    },
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
      title: this.i18n.t('home.offers.creation.title'),
      description: this.i18n.t('home.offers.creation.desc'),
      href: this.i18n.localizedPath('/services/creation'),
    },
    {
      title: this.i18n.t('home.offers.renovation.title'),
      description: this.i18n.t('home.offers.renovation.desc'),
      href: this.i18n.localizedPath('/services/renovation'),
    },
  ]);

  protected readonly howUrl = computed(() =>
    this.i18n.language() === 'fr'
      ? 'https://how.froment.software/fr/'
      : 'https://how.froment.software/',
  );
}
