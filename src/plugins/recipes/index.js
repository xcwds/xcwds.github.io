/**
 * The build entry: the Recipes and Kitchen Guide pages, with each recipe and article's title,
 * so the header shows them and the build prerenders them. Both share the Recipes tab.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { definePlugin, descriptor } from '@xcwds/core';
import { NAME } from './name.js';

export { NAME };

/**
 * The recipes or guide articles in `src/lib/<dir>/data/`.
 * @param {string} dir
 * @returns {{ slug: string; name: string; emoji: string }[]}
 */
function load(dir) {
	const folder = new URL(`../../lib/${dir}/data/`, import.meta.url);
	return readdirSync(folder)
		.filter((file) => file.endsWith('.json'))
		.map((file) => JSON.parse(readFileSync(new URL(file, folder), 'utf8')));
}

export default descriptor(NAME);

export const build = definePlugin(
	(app) => {
		app.route({ path: '/recipes', title: 'Recipes' });
		for (const { slug, name, emoji } of load('recipes'))
			app.route({ path: `/recipes/${slug}`, title: name, emoji, parent: '/recipes' });
		// A peer of Recipes in its tab, so it has no back arrow.
		app.route({ path: '/guide', title: 'Kitchen Guide' });
		for (const { slug, name, emoji } of load('guide'))
			app.route({ path: `/guide/${slug}`, title: name, emoji, parent: '/guide' });
	},
	{ name: NAME, network: false }
);
