/** The page entry: the Oven Time Converter's tool and the °F/°C setting (recipes use it too). */
import { definePlugin } from '@xcwds/core';
import { defaultSettings, parseOvenUnit } from '../../lib/storage.js';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		app.settings.field('ovenUnit', {
			default: defaultSettings.ovenUnit,
			parse: parseOvenUnit,
			label: 'Oven Time Converter',
			section: 'tool-defaults'
		});
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
