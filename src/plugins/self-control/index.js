/** The build entry: adds the tool to /utils and its private sub-pages to the route registry. */
import { definePlugin, descriptor } from '@xcwds/core';
import { pages } from './pages.js';
import { tool } from './tool.js';

export const NAME = 'xcwds-app-self-control';

export default descriptor(NAME);

export const build = definePlugin(
	(app) => {
		app.tools?.add(tool);
		for (const { slug, title, width } of pages)
			app.route({ path: `${tool.path}/${slug}`, title, parent: tool.path, width, private: true });
	},
	{ name: NAME, dependencies: ['@xcwds/plugin-tools'], network: false }
);
