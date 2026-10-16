import type { Tool } from '@xcwds/plugin-tools';
import { getApp } from '@xcwds/sveltekit';
import { trackApps } from '$lib/apps.svelte';

/** Kitchen Guide articles shown as "Learn more" on a tool's page (slugs). */
export const GUIDES: Readonly<Record<string, readonly string[]>> = {
	'/utils/pizza-dough': ['yeast-dough'],
	'/utils/cooking-timer': ['doneness-and-food-safety', 'eggs'],
	'/utils/oven-time': ['oven', 'doneness-and-food-safety']
};

/**
 * The tools under /utils that show, in the order the /utils index and Home list them:
 * `@xcwds/plugin-tools`' list, which each tool plugin (`src/plugins/<tool>/tool.js`) adds to in
 * the order `xcwds.config.ts` lists the plugins, without the tools of apps that are off (#223).
 * Call it while rendering: the app has loaded by then, and turning an app on or off re-renders.
 */
export const tools = (): readonly Tool[] => {
	trackApps();
	return getApp().tools?.list() ?? [];
};

/** Every tool, including those of apps that are off: for links from pages that still open. */
export const allTools = (): readonly Tool[] => getApp().tools?.all() ?? [];

/** The Kitchen Guide articles a tool links to. */
export function toolGuides(path: string): readonly string[] {
	return GUIDES[path] ?? [];
}
