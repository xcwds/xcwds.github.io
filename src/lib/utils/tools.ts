import type { ShortcutTool } from '$lib/home';

/**
 * Every tool under /utils. The /utils index and the home page both render from this list.
 * A private tool sets `recents: false` so it never shows under "Recently used" on Home.
 */
export const tools = [
	{
		path: '/utils/pizza-dough',
		emoji: '🍕',
		name: 'Pizza Dough Calculator',
		blurb: 'Ingredient weights from dough balls and hydration.'
	},
	{
		path: '/utils/coffee-timer',
		emoji: '☕',
		name: 'Coffee Timer',
		blurb: '90-second countdown with quick adjustments.'
	},
	{
		path: '/utils/cooking-timer',
		emoji: '⏲️',
		name: 'Cooking Timer',
		blurb: 'Several labeled timers at once.'
	},
	{
		path: '/utils/oven-time',
		emoji: '🌡️',
		name: 'Oven Time Converter',
		blurb: 'New cook time when the oven has to be hotter or cooler.'
	},
	{
		path: '/utils/url-sanitizer',
		emoji: '🧼',
		name: 'URL Sanitizer',
		blurb: 'Strip tracking params from a link before sharing it.'
	},
	{
		path: '/utils/weightlifting',
		emoji: '🏋️',
		name: 'Weightlifting Calculator',
		blurb: 'Plate math for bars, dumbbells and kettlebells, plus a workout log.'
	}
] as const satisfies readonly (ShortcutTool & { name: string; emoji: string; blurb: string })[];
