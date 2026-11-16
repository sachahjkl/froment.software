import { parseChangelog, type Release } from '@froment/l10n/changelog';
import changelogText from '../../../../CHANGELOG.md';

// Parsed once when the module loads: the changelog only changes with a new build.
// The home page shows the latest versions, the versions page shows them all.
export const releases: readonly Release[] = parseChangelog(changelogText);
