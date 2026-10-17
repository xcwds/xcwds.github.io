/** The page entry: the QR codes tool (#211). It saves nothing (no scan history). */
import { definePlugin } from '@xcwds/core';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin((app) => void app.tools?.add(tool), {
	name: NAME,
	namespace: '',
	dependencies: ['@xcwds/plugin-tools'],
	network: false
});
