/** The build entry: adds the tool to /utils (and its page to the route registry). */
import { definePlugin, descriptor } from '@xcwds/core';
import { tool } from './tool.js';

export const NAME = 'xcwds-app-weightlifting';

export default descriptor(NAME);

export const build = definePlugin((app) => void app.tools?.add(tool), {
	name: NAME,
	dependencies: ['@xcwds/plugin-tools'],
	network: false
});
