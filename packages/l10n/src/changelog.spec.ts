import { describe, expect, it } from 'vitest';
import { entryHtml, parseChangelog } from './changelog.js';

const sample = `# Changelog

Intro text.

## [0.2.0] - 2026-11-16

### Added
- **Versions page**: every version of the site.
- **Feed**: a long entry
  on two lines.

### Fixed
- **Footer**: aligned.

## [0.1.0] - 2026-05-28

### Added
- **First page**.

[0.2.0]: https://example.test/releases/tag/v0.2.0
[0.1.0]: https://example.test/releases/tag/v0.1.0
`;

describe('changelog', () => {
  it('reads the versions, newest first, with their sections and links', () => {
    const releases = parseChangelog(sample);
    expect(releases.map(({ version, date }) => [version, date])).toEqual([
      ['0.2.0', '2026-11-16'],
      ['0.1.0', '2026-05-28'],
    ]);
    expect(releases[0].link).toBe('https://example.test/releases/tag/v0.2.0');
    expect(releases[0].sections).toEqual([
      {
        type: 'Added',
        entries: [
          '**Versions page**: every version of the site.',
          '**Feed**: a long entry on two lines.',
        ],
      },
      { type: 'Fixed', entries: ['**Footer**: aligned.'] },
    ]);
  });

  it('rejects an unknown section', () => {
    expect(() => parseChangelog('## [0.1.0] - 2026-05-28\n\n### Misc\n')).toThrow('Misc');
  });

  it('renders bold, code and links, and escapes the rest', () => {
    expect(entryHtml('**A** `b` [c](https://d.test) <e>')).toBe(
      '<strong>A</strong> <code>b</code> <a href="https://d.test">c</a> &lt;e&gt;',
    );
  });
});
