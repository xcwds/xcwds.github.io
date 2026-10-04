/**
 * What's new, in user-facing words, newest first. Add an entry (next `id`, today's date) in every
 * PR that changes something people will notice; the app shows entries newer than the last one
 * the user saw after an update, and lists recent ones in Settings → About.
 */
export type ChangelogEntry = { id: number; date: string; items: string[] };

export const changelog: ChangelogEntry[] = [
	{
		id: 5,
		date: '2026-10-04',
		items: [
			'See what changed after an update, here and in the update message.',
			'Relaunching the app before tapping Update keeps the version you have.',
			'Other open tabs now offer to reload after one of them updates.'
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
