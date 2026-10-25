/** The service-worker entry: the tool, so the worker knows which app its page belongs to. */
import { definePlugin } from '@xcwds/core';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin((app) => void app.tools?.add(tool), {
	name: NAME,
	dependencies: ['@xcwds/plugin-tools'],
	network: false
});
