import { defineConfig } from '@xcwds/core';
import changelog from '@xcwds/plugin-changelog';
import install from '@xcwds/plugin-install';
import offline from '@xcwds/plugin-offline';
import settings from '@xcwds/plugin-settings';
import share from '@xcwds/plugin-share';
import shell from '@xcwds/plugin-shell';
import theme from '@xcwds/plugin-theme';
import timers from '@xcwds/plugin-timers';
import tools from '@xcwds/plugin-tools';
import update from '@xcwds/plugin-update';
import coffeeTimer from 'xcwds-app-coffee-timer';
import cookingTimer from 'xcwds-app-cooking-timer';
import app from 'xcwds-app';
import ovenTime from 'xcwds-app-oven-time';
import pizzaDough from 'xcwds-app-pizza-dough';
import recipes from 'xcwds-app-recipes';
import selfControl from 'xcwds-app-self-control';
import urlSanitizer from 'xcwds-app-url-sanitizer';
import weightlifting from 'xcwds-app-weightlifting';
import { BRAND, TAGLINE } from './src/lib/brand';
import { loadChangelog } from './src/lib/server/changelog';

export default defineConfig({
	brand: {
		name: BRAND,
		tagline: TAGLINE,
		description:
			'Everyday tools that never phone home: recipes, kitchen and gym tools, and a URL sanitizer.',
		icon: 'icon.svg',
		themeColor: { light: '#bfdbfe', dark: '#030712' },
		backgroundColor: '#bfdbfe'
	},
	// Backups made before the move onto @xcwds say `xcwds.com`; keep importing them.
	storage: { appName: 'xcwds.com' },
	// The manifest's shortcuts: Recipes (the recipes plugin), then each tool with `shortcut: true`
	// in its `tool.js`. Shortcuts set in `manifest.shortcuts` here would come before them.
	plugins: [
		// The app's own saved data from before @xcwds: its keys, schema version and migrations.
		app(),
		shell({
			sections: [
				{ path: '/', label: 'Home', emoji: '🏠' },
				{ path: '/recipes', label: 'Recipes', emoji: '📖', also: ['/guide'] },
				{ path: '/utils', label: 'Utils', emoji: '🧰' },
				{ path: '/settings', label: 'Settings', emoji: '⚙️' }
			]
		}),
		theme(),
		tools({ path: '/utils', title: 'Utils', storageKey: 'app:home:shortcuts' }),
		timers({ page: '/utils/cooking-timer', storageKey: 'app:cooking-timer:timers' }),
		// Tools, in the order /utils and Home list them (`src/lib/utils/tools.ts` reads it).
		pizzaDough(),
		coffeeTimer(),
		cookingTimer(),
		ovenTime(),
		urlSanitizer(),
		weightlifting(),
		selfControl(),
		recipes(),
		share({ target: '/utils/url-sanitizer', exclude: ['/settings'] }),
		settings({
			source: 'https://github.com/xcwds/xcwds.github.io',
			backupName: 'xcwds-backup',
			// The tab bar shows Settings' emoji; its header doesn't.
			emoji: '',
			width: 'split',
			sections: { appearance: 'Appearance', timers: 'Timers', 'tool-defaults': 'Tool defaults' },
			// Your data's groups, in the order it lists them.
			groups: {
				'coffee-timer': 'Coffee Timer',
				timers: 'Cooking Timer',
				weightlifting: 'Weightlifting Calculator',
				'workout-history': 'Workout History',
				'self-control': 'Self-Control',
				settings: 'Settings',
				tools: 'Home shortcuts',
				changelog: "What's new"
			}
		}),
		offline(),
		update({ marker: 'app:just-updated' }),
		changelog({ entries: loadChangelog(), storageKey: 'app:settings:whats-new-seen' }),
		install()
	]
});
