import type { Tool } from '@xcwds/plugin-tools';
import { getApp } from '@xcwds/sveltekit';

/** Kitchen Guide articles shown as "Learn more" on a tool's page (slugs). */
export const GUIDES: Readonly<Record<string, readonly string[]>> = {
	'/utils/pizza-dough': ['yeast-dough'],
	'/utils/cooking-timer': ['doneness-and-food-safety', 'eggs'],
	'/utils/oven-time': ['oven', 'doneness-and-food-safety']
};

/**
 * Every tool under /utils, in the order the /utils index and Home list them: `@xcwds/plugin-tools`'
 * list, which each tool plugin (`src/plugins/<tool>/tool.js`) adds to in the order
 * `xcwds.config.ts` lists the plugins. Call it while rendering: the app has loaded by then.
 */
export const tools = (): readonly Tool[] => getApp().tools?.list() ?? [];

/** The Kitchen Guide articles a tool links to. */
export function toolGuides(path: string): readonly string[] {
	return GUIDES[path] ?? [];
}
