import { translate } from '@froment/l10n';
import { entryHtml, type Release } from '@froment/l10n/changelog';

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const releaseHtml = (release: Release): string =>
  release.sections
    .map(
      (section) =>
        // oxlint-disable-next-line anti-slop/no-natural-language-literals -- HTML markup; the text comes from CHANGELOG.md and translations.
        `<h3>${translate('fr', `changelog.type.${section.type}`)}</h3><ul>${section.entries
          .map((entry) => `<li>${entryHtml(entry)}</li>`)
          .join('')}</ul>`,
    )
    .join('');

export const changelogFeed = (publicOrigin: string, releases: readonly Release[]): string => {
  const origin = escapeXml(publicOrigin);
  const updated = releases[0]?.date ?? '2026-05-28';
  const entries = releases.map((release) => {
    const url = `${origin}/fr/changelog#v${escapeXml(release.version)}`;
    const alternateUrl = `${origin}/en/changelog#v${escapeXml(release.version)}`;
    // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Atom XML markup; all prose comes from CHANGELOG.md and translations.
    return `<entry>
  <id>${url}</id>
  <title>${escapeXml(translate('fr', 'metadata.publisher'))} ${escapeXml(release.version)}</title>
  <link rel="alternate" href="${url}" type="text/html" hreflang="fr" />
  <link rel="alternate" href="${alternateUrl}" type="text/html" hreflang="en" />
  <updated>${release.date}T00:00:00Z</updated>
  <content type="html">${escapeXml(releaseHtml(release))}</content>
</entry>`;
  });
  // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Atom XML markup; all prose comes from translations.
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <id>${origin}/changelog/feed</id>
  <title>${escapeXml(translate('fr', 'metadata.publisher'))} | ${escapeXml(translate('fr', 'changelog.title'))}</title>
  <subtitle>${escapeXml(translate('fr', 'changelog.lead'))}</subtitle>
  <link rel="self" href="${origin}/changelog/feed" type="application/atom+xml" />
  <link rel="alternate" href="${origin}/fr/changelog" type="text/html" hreflang="fr" />
  <link rel="alternate" href="${origin}/en/changelog" type="text/html" hreflang="en" />
  <updated>${updated}T00:00:00Z</updated>
  <author>
    <name>${escapeXml(translate('fr', 'metadata.author'))}</name>
    <uri>${origin}/</uri>
  </author>
  ${entries.join('\n  ')}
</feed>
`;
};
