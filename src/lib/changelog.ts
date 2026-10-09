import compiled from 'virtual:changelog';

/**
 * What's new, in user-facing words, newest first. Each entry is a file in `changelog/`, compiled
 * at build time by `src/lib/server/changelog.ts` (see `changelog/README.md`). The app shows
 * entries newer than the last one the user saw after an update, and lists recent ones in
 * Settings → What's new.
 */
export type ChangelogEntry = { id: number; date: string; items: string[] };

export const changelog: ChangelogEntry[] = compiled;

export const latestChangelogId = changelog[0]?.id ?? 0;

/** Entries newer than `seenId`. */
export const changelogSince = (seenId: number) => changelog.filter((e) => e.id > seenId);
