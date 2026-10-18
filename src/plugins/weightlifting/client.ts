/**
 * The page entry: the Weightlifting Calculator's tool, its equipment sets (a setting), and the
 * plate calculator, workout and history it saves.
 */
import { definePlugin } from '@xcwds/core';
import {
	defaultSettings,
	entries,
	parseLiftingSettings,
	registerEntries
} from '../../lib/storage.js';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		registerEntries(app.storage, [
			entries.liftingCalculator,
			entries.liftingWorkout,
			entries.liftingTab,
			entries.workoutHistory,
			entries.workoutMuscles
		]);
		app.settings.field('lifting', {
			default: defaultSettings.lifting,
			parse: parseLiftingSettings,
			label: 'Weightlifting Calculator',
			section: 'tool-defaults'
		});
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
