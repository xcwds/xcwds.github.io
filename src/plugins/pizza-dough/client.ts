/** The page entry: the Pizza Dough Calculator's tool and saved defaults. */
import { definePlugin } from '@xcwds/core';
import { defaultSettings, parsePizzaDefaults } from '$lib/storage';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		app.settings.field('pizzaDefaults', {
			default: defaultSettings.pizzaDefaults,
			parse: parsePizzaDefaults
		});
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
