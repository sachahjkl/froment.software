import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatPluralTranslation } from '@froment/l10n';
import { entryHtml, parseChangelog, type ChangeType } from '@froment/l10n/changelog';
import { I18nService } from '@app/i18n.service';
import { Icon } from '@shared/icon/icon';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import changelogText from '../../../../../../CHANGELOG.md';

const releasesUrl = 'https://github.com/sachahjkl/froment.software/releases';

interface ShownRelease {
  readonly version: string;
  readonly date: string;
  readonly link: string | undefined;
  readonly sections: readonly { readonly type: ChangeType; readonly entries: readonly string[] }[];
  readonly searchText: string;
}

// Parsed once when the module loads: the changelog only changes with a new build.
const releases: readonly ShownRelease[] = parseChangelog(changelogText).map((release) => ({
  ...release,
  sections: release.sections.map((section) => ({
    type: section.type,
    entries: section.entries.map(entryHtml),
  })),
  searchText: [release.version, ...release.sections.flatMap((section) => section.entries)]
    .join('\n')
    .toLocaleLowerCase(),
}));

@Component({
  host: { class: 'page-container' },
  selector: 'app-changelog',
  imports: [Icon, LocalizedDatePipe],
  templateUrl: './changelog.html',
  styleUrl: './changelog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Changelog {
  protected readonly i18n = inject(I18nService);
  protected readonly releasesUrl = releasesUrl;
  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const words = this.query().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return releases.filter((release) => words.every((word) => release.searchText.includes(word)));
  });
  protected readonly count = computed(() =>
    formatPluralTranslation(this.i18n.language(), 'changelog.count', {
      count: this.shown().length,
    }),
  );

  protected typeLabel(type: ChangeType): string {
    return this.i18n.t(`changelog.type.${type}`);
  }

  protected releaseLabel(version: string): string {
    return this.i18n.tf('changelog.releaseLink', { version });
  }
}
