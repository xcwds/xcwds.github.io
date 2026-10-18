/**
 * The page entry: the Self-Control tool and the habits, preferences, urge log, reasons, seesaws,
 * environment plans and weekly reflections it saves.
 */
import { definePlugin } from '@xcwds/core';
import { addHabitData } from '../../lib/self-control/data.js';
import { environmentWithout } from '../../lib/self-control/environment.js';
import { logWithout } from '../../lib/self-control/sos.js';
import { seesawWithout } from '../../lib/self-control/seesaw.js';
import { whyWithout } from '../../lib/self-control/why.js';
import { entries, registerEntries } from '../../lib/storage.js';
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
			entries.selfControlSeesaw,
			entries.selfControlPlan,
			entries.selfControlReview
		]);
		addHabitData({ entry: entries.selfControlLog, without: logWithout });
		addHabitData({ entry: entries.selfControlWhy, without: whyWithout });
		addHabitData({ entry: entries.selfControlSeesaw, without: seesawWithout });
		addHabitData({ entry: entries.selfControlPlan, without: environmentWithout });
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
