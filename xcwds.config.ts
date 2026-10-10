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
import urlSanitizer from 'xcwds-app-url-sanitizer';
import weightlifting from 'xcwds-app-weightlifting';
import { loadChangelog } from './src/lib/server/changelog';

export default defineConfig({
	brand: {
		name: 'xcwds',
		tagline: 'Everyday tools that never phone home.',
		description:
			'Everyday tools that never phone home: recipes, kitchen and gym tools, and a URL sanitizer.',
		icon: 'icon.svg',
		themeColor: { light: '#bfdbfe', dark: '#030712' },
		backgroundColor: '#bfdbfe'
	},
	// Backups made before the move onto @xcwds say `xcwds.com`; keep importing them.
	storage: { appName: 'xcwds.com' },
	manifest: {
		shortcuts: [
			{ name: 'URL Sanitizer', url: '/utils/url-sanitizer' },
			{ name: 'Coffee Timer', url: '/utils/coffee-timer' },
			{ name: 'Cooking Timer', url: '/utils/cooking-timer' },
			{ name: 'Recipes', url: '/recipes' }
		]
	},
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
		// Tools, in the order /utils lists them.
		pizzaDough(),
		coffeeTimer(),
		cookingTimer(),
		ovenTime(),
		urlSanitizer(),
		weightlifting(),
		recipes(),
		share({ target: '/utils/url-sanitizer', exclude: ['/settings'] }),
		settings({
			source: 'https://github.com/xcwds/xcwds.github.io',
			backupName: 'xcwds-backup',
			// The tab bar shows Settings' emoji; its header doesn't.
			emoji: '',
			width: 'split'
		}),
		offline(),
		update({ marker: 'app:just-updated' }),
		changelog({ entries: loadChangelog(), storageKey: 'app:settings:whats-new-seen' }),
		install()
	]
});
