import { readFile } from 'node:fs/promises';
import { parseChangelog } from '@froment/l10n/changelog';
import { expect, it } from 'vitest';
import { changelogFeed } from './feed.js';

const changelog = await readFile(new URL('../../../../CHANGELOG.md', import.meta.url), 'utf8');

it('links every version of CHANGELOG.md to its GitHub release', () => {
  const releases = parseChangelog(changelog);
  expect(releases.at(-1)?.version).toBe('0.1.0');
  for (const release of releases) {
    expect(release.link).toBe(
      `https://github.com/sachahjkl/froment.software/releases/tag/v${release.version}`,
    );
    expect(release.sections.length).toBeGreaterThan(0);
  }
});

it('lists the versions newest first, as escaped HTML', () => {
  const xml = changelogFeed(
    'https://froment.software',
    parseChangelog(`## [0.2.0] - 2026-11-16

### Added
- **Versions** : <page>.

## [0.1.0] - 2026-05-28

### Added
- **Site**.
`),
  );
  expect(xml).toContain('<updated>2026-11-16T00:00:00Z</updated>');
  expect(xml.indexOf('#v0.2.0')).toBeLessThan(xml.indexOf('#v0.1.0'));
  expect(xml).toContain('&lt;strong&gt;Versions&lt;/strong&gt; : &amp;lt;page&amp;gt;.');
});
