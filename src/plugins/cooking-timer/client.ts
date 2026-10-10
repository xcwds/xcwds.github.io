/** The page entry: the Cooking Timer's tool and quick-start presets (in minutes). */
import { definePlugin } from '@xcwds/core';
import { defaultSettings, parseCookingPresets } from '$lib/storage';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		app.settings.field('cookingPresets', {
			default: defaultSettings.cookingPresets,
			parse: parseCookingPresets
		});
	},
	{
		name: NAME,
		namespace: '',
		dependencies: ['@xcwds/plugin-tools', '@xcwds/plugin-timers'],
		network: false
	}
);
