import type { Tool } from '@xcwds/plugin-tools';
import { tool as coffeeTimer } from '../../plugins/coffee-timer/tool.js';
import { tool as cookingTimer } from '../../plugins/cooking-timer/tool.js';
import { tool as ovenTime } from '../../plugins/oven-time/tool.js';
import { tool as pizzaDough } from '../../plugins/pizza-dough/tool.js';
import { tool as urlSanitizer } from '../../plugins/url-sanitizer/tool.js';
import { tool as weightlifting } from '../../plugins/weightlifting/tool.js';

/** Kitchen Guide articles shown as "Learn more" on a tool's page (slugs). */
const GUIDES: Record<string, readonly string[]> = {
	'/utils/pizza-dough': ['yeast-dough'],
	'/utils/cooking-timer': ['doneness-and-food-safety', 'eggs'],
	'/utils/oven-time': ['oven', 'doneness-and-food-safety']
};

/**
 * Every tool under /utils, in the order the /utils index and Home list them. Each comes from its
 * app plugin (`src/plugins/<tool>/tool.js`), which adds it to `@xcwds/plugin-tools`.
 */
export const tools = [
	pizzaDough,
	coffeeTimer,
	cookingTimer,
	ovenTime,
	urlSanitizer,
	weightlifting
] as (Tool & { path: ToolPath })[];

/** A tool's page. */
export type ToolPath =
	| '/utils/pizza-dough'
	| '/utils/coffee-timer'
	| '/utils/cooking-timer'
	| '/utils/oven-time'
	| '/utils/url-sanitizer'
	| '/utils/weightlifting';

/** The Kitchen Guide articles a tool links to. */
export function toolGuides(path: string): readonly string[] {
	return GUIDES[path] ?? [];
}
