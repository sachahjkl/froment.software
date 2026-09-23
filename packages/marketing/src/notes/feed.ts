import { translate } from '@froment/l10n';
import { notes } from '@froment/l10n/notes';

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const notesFeed = (publicOrigin: string): string => {
  const origin = escapeXml(publicOrigin);
  const updated = notes.reduce<string>(
    (latest, post) => (post.updated > latest ? post.updated : latest),
    notes[0].updated,
  );
  const entries = notes.map((post) => {
    const url = `${origin}/notes/${escapeXml(post.slug)}`;
    // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Atom XML markup; all prose comes from translations.
    return `<entry>
  <id>${url}</id>
  <title>${escapeXml(translate('fr', post.titleKey))}</title>
  <link rel="alternate" href="${url}" type="text/html" hreflang="fr" />
  <published>${post.published}T00:00:00Z</published>
  <updated>${post.updated}T00:00:00Z</updated>
  <summary>${escapeXml(translate('fr', post.descriptionKey))}</summary>
  ${post.topicKeys
    .map(
      (key) =>
        // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Atom XML attributes, not interface prose.
        `<category term="${escapeXml(translate('fr', key))}" />`,
    )
    .join('\n  ')}
</entry>`;
  });
  // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Atom XML markup; all prose comes from translations.
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <id>${origin}/notes/feed</id>
  <title>${escapeXml(translate('fr', 'metadata.publisher'))} | ${escapeXml(translate('fr', 'notes.title'))}</title>
  <subtitle>${escapeXml(translate('fr', 'notes.lead'))}</subtitle>
  <link rel="self" href="${origin}/notes/feed" type="application/atom+xml" />
  <link rel="alternate" href="${origin}/notes" type="text/html" hreflang="fr" />
  <updated>${updated}T00:00:00Z</updated>
  <author>
    <name>${escapeXml(translate('fr', 'metadata.author'))}</name>
    <uri>${origin}/</uri>
  </author>
  ${entries.join('\n  ')}
</feed>
`;
};
