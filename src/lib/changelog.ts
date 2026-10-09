/**
 * What's new, in user-facing words, newest first. Add an entry (next `id`, today's date) in every
 * PR that changes something people will notice; the app shows entries newer than the last one
 * the user saw after an update, and lists recent ones in Settings → What's new.
 */
export type ChangelogEntry = { id: number; date: string; items: string[] };

export const changelog: ChangelogEntry[] = [
	{
		id: 27,
		date: '2026-10-09',
		items: [
			'On computers, the weightlifting calculator shows your plates beside your workout, the URL Sanitizer lists the params beside the link, and Settings uses two columns.'
		]
	},
	{
		id: 26,
		date: '2026-10-09',
		items: [
			'On tablets and computers, Home, Utils and Recipes show their cards in a grid.',
			'On computers, a recipe keeps its ingredients in view beside the steps while you scroll.'
		]
	},
	{
		id: 25,
		date: '2026-10-09',
		items: [
			'On tablets in landscape and on computers, sections now live in a sidebar. Pick a top bar or the sidebar for portrait and landscape in Settings → Appearance.',
			'On bigger screens, pages line up with their titles, and notifications show at the top right.'
		]
	},
	{
		id: 24,
		date: '2026-10-09',
		items: [
			'The weightlifting calculator now tops out at 1,200 lb (545 kg), a bit past what an Olympic bar is rated for.'
		]
	},
	{
		id: 23,
		date: '2026-10-09',
		items: [
			'In the installed app, a Share button next to the page title sends a recipe or tool to anyone (or copies its link).'
		]
	},
	{
		id: 22,
		date: '2026-10-08',
		items: [
			'Switch equipment sets right in the weightlifting calculator, see how many of each plate you have left, and see when your plates are what keeps you from a target weight.'
		]
	},
	{
		id: 21,
		date: '2026-10-08',
		items: [
			'Set up your own equipment in Settings: make a set for your home gym (or copy the commercial gym), with the bars you have and how many plates of each size.'
		]
	},
	{
		id: 20,
		date: '2026-10-08',
		items: [
			'The weightlifting calculator now works from an equipment set: "Commercial gym" (a 45 lb barbell and every plate you need) or your own, picked in Settings. Your own bars and plates carry over as "My equipment".'
		]
	},
	{
		id: 19,
		date: '2026-10-08',
		items: [
			'Home gym? Set up your own bars, dumbbells and kettlebell in Settings: their weight, how much each one takes, how many plates fit and which sizes. The weightlifting calculator sticks to them.'
		]
	},
	{
		id: 18,
		date: '2026-10-08',
		items: ['A new tagline: "Everyday tools that never phone home."']
	},
	{
		id: 17,
		date: '2026-10-08',
		items: [
			'In the URL sanitizer, renaming a parameter updates its "tracking" badge and warning, and Remove tracking goes by the new name.'
		]
	},
	{
		id: 16,
		date: '2026-10-08',
		items: [
			"The pizza dough calculator only saves your defaults when every field holds a number from 0 to 100,000, and points out the one that doesn't."
		]
	},
	{
		id: 15,
		date: '2026-10-08',
		items: ['Scaling a recipe way down no longer shows tiny amounts like ⅛ tsp halved as "0 tsp".']
	},
	{
		id: 14,
		date: '2026-10-08',
		items: [
			'Timers keep ringing while you use the rest of the app, with a banner to snooze or stop them.',
			'A running coffee timer is no longer lost when you leave its page.'
		]
	},
	{
		id: 13,
		date: '2026-10-08',
		items: [
			'"+1 min" (and the coffee timer\'s + buttons) now snooze a timer that has been ringing for a while.'
		]
	},
	{
		id: 12,
		date: '2026-10-08',
		items: [
			'A large target weight with no plates selected no longer freezes the weightlifting calculator.'
		]
	},
	{
		id: 11,
		date: '2026-10-04',
		items: [
			'Pin your favorite tools (☆ in Utils) to reach them from Home in one tap, in the order you like.',
			'Home also shows the tools you used most recently.'
		]
	},
	{
		id: 10,
		date: '2026-10-04',
		items: ['A very large target weight no longer freezes the weightlifting calculator.']
	},
	{
		id: 9,
		date: '2026-10-04',
		items: [
			'Baking in a different pan? Pick yours and the recipe scales to fit.',
			'New recipe: fudgy brownies.'
		]
	},
	{
		id: 8,
		date: '2026-10-04',
		items: [
			'Recipes can show ingredients in US or metric measures, including flour, sugar and butter by weight.'
		]
	},
	{
		id: 7,
		date: '2026-10-04',
		items: [
			'Recipe steps like "bake 9–11 minutes" have a button that starts a timer, shown at the bottom of the recipe and in the Cooking Timer.'
		]
	},
	{
		id: 6,
		date: '2026-10-04',
		items: [
			'See what changed after an update, here and in the update message.',
			'Relaunching the app before tapping Update keeps the version you have.',
			'Other open tabs now offer to reload after one of them updates.'
		]
	},
	{
		id: 5,
		date: '2026-10-04',
		items: [
			'Recipes are now a set of classics, and you can scale them to the servings you need.',
			'New Oven Time Converter: how long to cook at a different oven temperature, also built into recipes.',
			"Changes you save in one tab now show up in your other open tabs, and you're told if something couldn't be saved.",
			"Pages that don't exist show a proper not-found page, even offline.",
			'The URL sanitizer ignores punctuation around a pasted link and leaves the rest of the link exactly as it was.'
		]
	},
	{
		id: 4,
		date: '2026-10-03',
		items: [
			'Finished workouts are saved to a workout history.',
			'The weightlifting calculator works in pounds or kilograms.',
			'Set tool defaults in Settings: coffee length, cooking presets, pizza dough and lifting equipment.'
		]
	},
	{
		id: 3,
		date: '2026-10-03',
		items: [
			'A new name and icon: xcwds.',
			'Install the app from Settings, and see a notice when you are offline.'
		]
	},
	{
		id: 2,
		date: '2026-10-03',
		items: [
			'Settings with dark mode, timer sounds and data backups.',
			'Updates wait until you tap Update, so timers are never interrupted.'
		]
	},
	{
		id: 1,
		date: '2026-10-03',
		items: [
			'Recipes, a pizza dough calculator, coffee and cooking timers, a URL sanitizer and a weightlifting calculator.',
			'Share links straight to the URL sanitizer.'
		]
	}
];

export const latestChangelogId = changelog[0]?.id ?? 0;

/** Entries newer than `seenId`. */
export const changelogSince = (seenId: number) => changelog.filter((e) => e.id > seenId);
