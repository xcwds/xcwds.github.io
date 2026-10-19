import type { AppGroup } from '@xcwds/plugin-tools';

/**
 * The apps people turn on and off at /apps (#223), in the order the Apps page lists them, for
 * `@xcwds/plugin-tools`' `apps` in `xcwds.config.ts`. Each tool's `tool.js` names its app;
 * `routes` are the other pages an app owns and `groups` the storage groups that hold its data.
 */
export const APPS: AppGroup[] = [
	{
		id: 'kitchen',
		name: 'Kitchen',
		emoji: '🍳',
		blurb: 'Recipes, the Kitchen Guide and kitchen timers.',
		routes: ['/recipes', '/guide'],
		groups: ['coffee-timer', 'timers']
	},
	{
		id: 'gym',
		name: 'Gym',
		emoji: '🏋️',
		blurb: 'Plate math and a workout log.',
		groups: ['weightlifting', 'workout-history']
	},
	{
		id: 'links',
		name: 'Links',
		emoji: '🔗',
		blurb: 'Clean links before you share them, and scan or show them as QR codes.'
	},
	{
		id: 'housework',
		name: 'Housework',
		emoji: '🧹',
		blurb: 'Keep track of when you last did things.',
		groups: ['last-done']
	},
	{
		id: 'camera',
		name: 'Camera',
		emoji: '📷',
		blurb: 'Photos that stay on this device, clean copies to share and a magnifier.',
		groups: ['photos']
	},
	{
		id: 'blocks',
		name: 'Your apps',
		emoji: '🧩',
		blurb: 'Build your own checklists, counters and logs.',
		routes: ['/my-apps'],
		groups: ['blocks', 'blocks-private']
	},
	// Private and discreet, like its tool (#146).
	{
		id: 'self-control',
		name: 'Self-Control',
		emoji: '🧭',
		blurb: 'Tools for building better habits.',
		private: true,
		groups: ['self-control']
	}
];
