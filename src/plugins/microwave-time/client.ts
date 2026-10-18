/** The page entry: the Microwave Time Converter's tool and your microwave's wattage. */
import { definePlugin } from '@xcwds/core';
import { defaultSettings } from '../../lib/storage.js';
import { WATTS, parseWatts } from '../../lib/utils/microwave.js';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		app.settings.field('microwaveWatts', {
			default: defaultSettings.microwaveWatts,
			parse: parseWatts,
			label: 'Microwave wattage',
			hint: 'Its wattage, on the label inside the door. The Microwave Time Converter starts with it.',
			section: 'tool-defaults',
			control: { type: 'number', ...WATTS, unit: 'W' }
		});
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
