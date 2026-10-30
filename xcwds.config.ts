import { defineConfig } from '@xcwds/core';
import camera from '@xcwds/plugin-camera';
import blocks from '@xcwds/plugin-blocks';
import type { AppDefinition } from '@xcwds/plugin-blocks/model';
import changelog from '@xcwds/plugin-changelog';
import install from '@xcwds/plugin-install';
import lock from '@xcwds/plugin-lock';
import qr from '@xcwds/plugin-qr';
import offline from '@xcwds/plugin-offline';
import settings from '@xcwds/plugin-settings';
import share from '@xcwds/plugin-share';
import shell from '@xcwds/plugin-shell';
import theme from '@xcwds/plugin-theme';
import timers from '@xcwds/plugin-timers';
import tools from '@xcwds/plugin-tools';
import update from '@xcwds/plugin-update';
import vault from '@xcwds/plugin-vault';
import coffeeTimer from 'xcwds-app-coffee-timer';
import cookingTimer from 'xcwds-app-cooking-timer';
import app from 'xcwds-app';
import cameraTool from 'xcwds-app-camera';
import lastDone from 'xcwds-app-last-done';
import level from 'xcwds-app-level';
import magnifier from 'xcwds-app-magnifier';
import microwaveTime from 'xcwds-app-microwave-time';
import ovenTime from 'xcwds-app-oven-time';
import photoCleaner from 'xcwds-app-photo-cleaner';
import pizzaDough from 'xcwds-app-pizza-dough';
import qrTool from 'xcwds-app-qr';
import recipes from 'xcwds-app-recipes';
import selfControl from 'xcwds-app-self-control';
import urlSanitizer from 'xcwds-app-url-sanitizer';
import weightlifting from 'xcwds-app-weightlifting';
import { APPS } from './src/lib/apps';
import { BRAND, TAGLINE } from './src/lib/brand';
import myAppsTemplates from './src/lib/my-apps/templates.json';
import { loadChangelog } from './src/lib/server/changelog';

export default defineConfig({
	brand: {
		name: BRAND,
		tagline: TAGLINE,
		description:
			'Everyday tools that never phone home: recipes, kitchen and gym tools, a URL sanitizer and QR codes.',
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
				{ path: '/recipes', label: 'Recipes', emoji: '📖', also: ['/guide'], app: 'kitchen' },
				{ path: '/utils', label: 'Utils', emoji: '🧰' },
				{ path: '/settings', label: 'Settings', emoji: '⚙️' }
			]
		}),
		theme(),
		tools({
			path: '/utils',
			title: 'Utils',
			storageKey: 'app:home:shortcuts',
			// Apps people turn on and off at /apps (#223). Each tool's `tool.js` names its app.
			apps: APPS
		}),
		timers({ page: '/utils/cooking-timer', storageKey: 'app:cooking-timer:timers' }),
		// Tools, in the order /utils and Home list them (`src/lib/utils/tools.ts` reads it).
		pizzaDough(),
		coffeeTimer(),
		cookingTimer(),
		ovenTime(),
		microwaveTime(),
		urlSanitizer(),
		qrTool(),
		weightlifting(),
		selfControl(),
		lastDone(),
		level(),
		cameraTool(),
		photoCleaner(),
		magnifier(),
		recipes(),
		// Your apps (#224): apps people build from blocks, each one a tool in the `blocks` app.
		blocks({ path: '/my-apps', app: 'blocks', templates: myAppsTemplates as AppDefinition[] }),
		// A passcode lock for the private tools, with its unlock screen at /unlock, a cover in the app
		// switcher and no spellcheck in their fields. Opt-in, from Settings → Privacy.
		lock(),
		// With a passcode set, the sensitive groups (Self-Control, Camera's photos, Your private
		// apps) are encrypted with it and open only while unlocked; backups carry them encrypted.
		vault(),
		// The camera as `app.camera` (off while hidden) and photos kept in the app as `app.photos`.
		camera(),
		// QR codes made and read on the device; the QR tool scans through `app.camera`.
		qr(),
		share({
			target: '/utils/url-sanitizer',
			// A link to one of your apps opens nothing on another device; Share design shares one.
			exclude: ['/settings', '/my-apps']
		}),
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
				'last-done': 'Last done',
				level: 'Level',
				blocks: 'Your apps',
				'blocks-private': 'Your private apps',
				photos: 'Camera',
				// The passcode and wrong tries; clearing it clears the private data it locks too.
				lock: 'Passcode lock',
				settings: 'Settings',
				tools: 'Home shortcuts',
				changelog: "What's new"
			}
		}),
		// Only the apps that are on are kept offline (xcwds/xcwds#163): turning one off at /apps
		// deletes its pages from the offline copy, and turning it on downloads them.
		offline({ byApp: true }),
		update({ marker: 'app:just-updated' }),
		changelog({ entries: loadChangelog(), storageKey: 'app:settings:whats-new-seen' }),
		install()
	]
});
