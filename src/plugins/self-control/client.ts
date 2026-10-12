/** The page entry: the Self-Control tool and the habits and preferences it saves. */
import { definePlugin } from '@xcwds/core';
import { entries, registerEntries } from '$lib/storage';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		registerEntries(app.storage, [entries.selfControlHabits, entries.selfControlPrefs]);
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
