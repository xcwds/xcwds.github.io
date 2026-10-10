/** The page entry: the recipe units setting (US, metric, or each recipe as written). */
import { definePlugin } from '@xcwds/core';
import { defaultSettings, parseRecipeUnits } from '$lib/storage';
import { NAME } from './name.js';

export default definePlugin(
	(app) => {
		app.settings.field('recipeUnits', {
			default: defaultSettings.recipeUnits,
			parse: parseRecipeUnits
		});
	},
	{ name: NAME, namespace: '', network: false }
);
