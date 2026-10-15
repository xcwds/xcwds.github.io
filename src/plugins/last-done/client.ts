/** The page entry: the Last done tool and the things and history it saves (#218). */
import { definePlugin } from '@xcwds/core';
import { entries, registerEntries } from '$lib/storage';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		registerEntries(app.storage, [entries.lastDoneItems, entries.lastDoneLog]);
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
