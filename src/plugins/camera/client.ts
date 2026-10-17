/**
 * The page entry: the Camera tool (#210). Its photos are `@xcwds/plugin-camera`'s `app.photos`,
 * which registers their collections itself (group `photos`, sensitive, never in backups).
 */
import { definePlugin } from '@xcwds/core';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin((app) => void app.tools?.add(tool), {
	name: NAME,
	namespace: '',
	dependencies: ['@xcwds/plugin-tools'],
	network: false
});
