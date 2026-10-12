/** The page entry: the Self-Control tool and the habits, preferences and urge log it saves. */
import { definePlugin } from '@xcwds/core';
import { addHabitData } from '$lib/self-control/data';
import { logWithout } from '$lib/self-control/sos';
import { entries, registerEntries } from '$lib/storage';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		registerEntries(app.storage, [
			entries.selfControlHabits,
			entries.selfControlPrefs,
			entries.selfControlLog,
			entries.selfControlSos
		]);
		addHabitData({ entry: entries.selfControlLog, without: logWithout });
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
