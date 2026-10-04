/** Every tool under /utils. The /utils index and the home page both render from this list. */
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
] as const;
