/** Home shortcuts: tools pinned to Home (in the user's order) and the most recently opened ones. */
export type { HomeShortcuts } from '@xcwds/plugin-tools';

export const emptyShortcuts = () => ({ pins: [] as string[], recent: [] as string[] });
