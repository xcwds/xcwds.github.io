/**
 * The page entry: the app's saved data from before @xcwds. Its keys stay as they were, and the
 * migrations that upgrade them (and older backups) keep the app's schema version (`app:version`)
 * in the app's own namespace (`''`). Registered first, so they're in place before anything reads.
 */
import { definePlugin } from '@xcwds/core';
import { migrations } from '$lib/storage';
import { NAME } from './index.js';

export default definePlugin(
	(app) => {
		for (const migration of migrations) app.storage.migration(migration);
	},
	{ name: NAME, namespace: '', network: false }
);
