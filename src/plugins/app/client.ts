/**
 * The page entry: the app's saved data from before @xcwds. Its keys stay as they were, and the
 * migrations that upgrade them (and older backups) keep the app's schema version (`app:version`)
 * in the app's own namespace (`''`). Registered first, so they're in place before anything reads.
 * Also the app-wide "Week starts on" setting.
 */
import { definePlugin } from '@xcwds/core';
import { defaultSettings, migrations, parseWeekStart } from '../../lib/storage.js';
import { NAME } from './index.js';

export default definePlugin(
	(app) => {
		for (const migration of migrations) app.storage.migration(migration);
		app.settings.field('weekStart', {
			default: defaultSettings.weekStart,
			parse: parseWeekStart,
			label: 'Week starts on',
			section: 'appearance'
		});
	},
	{ name: NAME, namespace: '', network: false }
);
