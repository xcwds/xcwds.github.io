/** The page entry: the URL Sanitizer's tool. Shared links reach it through @xcwds/plugin-share. */
import { definePlugin } from '@xcwds/core';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin((app) => void app.tools?.add(tool), {
	name: NAME,
	namespace: '',
	dependencies: ['@xcwds/plugin-tools'],
	network: false
});
