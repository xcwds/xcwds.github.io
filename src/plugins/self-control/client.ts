/** The page entry: the Self-Control tool and the habits, preferences, urge log, reasons and seesaws it saves. */
import { definePlugin } from '@xcwds/core';
import { addHabitData } from '$lib/self-control/data';
import { logWithout } from '$lib/self-control/sos';
import { seesawWithout } from '$lib/self-control/seesaw';
import { whyWithout } from '$lib/self-control/why';
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
			entries.selfControlSos,
			entries.selfControlWhy,
			entries.selfControlSeesaw
		]);
		addHabitData({ entry: entries.selfControlLog, without: logWithout });
		addHabitData({ entry: entries.selfControlWhy, without: whyWithout });
		addHabitData({ entry: entries.selfControlSeesaw, without: seesawWithout });
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
