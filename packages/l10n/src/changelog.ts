// CHANGELOG.md is the only source of the versions page and of the releases feed:
// the web app and the server both read it with this parser, so they never disagree.

export const changeTypes = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
] as const;

export type ChangeType = (typeof changeTypes)[number];

export interface ChangeSection {
  readonly type: ChangeType;
  readonly entries: readonly string[];
}

export interface Release {
  readonly version: string;
  readonly date: string;
  readonly link: string | undefined;
  readonly sections: readonly ChangeSection[];
}

const versionHeading = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/;
const sectionHeading = /^### (\w+)\s*$/;
const linkReference = /^\[(\d+\.\d+\.\d+)\]:\s*(\S+)\s*$/;

const changeTypeNames: ReadonlySet<string> = new Set(changeTypes);

const isChangeType = (value: string): value is ChangeType => changeTypeNames.has(value);

export const parseChangelog = (text: string): Release[] => {
  const lines = text.split(/\r?\n/);
  const links = new Map<string, string>();
  for (const line of lines) {
    const match = linkReference.exec(line);
    if (match) links.set(match[1], match[2]);
  }

  const releases: {
    version: string;
    date: string;
    sections: { type: ChangeType; entries: string[] }[];
  }[] = [];
  for (const line of lines) {
    const version = versionHeading.exec(line);
    if (version) {
      releases.push({ version: version[1], date: version[2], sections: [] });
      continue;
    }
    const release = releases.at(-1);
    if (!release) continue;
    const section = sectionHeading.exec(line);
    if (section) {
      if (!isChangeType(section[1])) throw new Error(`Unknown change type: ${section[1]}`);
      release.sections.push({ type: section[1], entries: [] });
      continue;
    }
    const entries = release.sections.at(-1)?.entries;
    if (!entries) continue;
    if (line.startsWith('- ')) entries.push(line.slice(2).trim());
    else if (line.startsWith('  ') && line.trim() !== '' && entries.length > 0)
      entries[entries.length - 1] += ` ${line.trim()}`;
  }

  return releases.map((release) => ({ ...release, link: links.get(release.version) }));
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// Entries only use bold, code and links: a full Markdown parser would add a dependency
// to the server bundle for three rules.
export const entryHtml = (entry: string): string =>
  escapeHtml(entry)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
