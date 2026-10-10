/** The page entry: the Coffee Timer's tool, saved length and brew, and its default length. */
import { definePlugin } from '@xcwds/core';
import { defaultSettings, entries, parseCoffeeSeconds, registerEntries } from '$lib/storage';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		registerEntries(app.storage, [entries.coffeeDuration, entries.coffeeBrew]);
		app.settings.field('coffeeDefaultSeconds', {
			default: defaultSettings.coffeeDefaultSeconds,
			parse: parseCoffeeSeconds
		});
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
