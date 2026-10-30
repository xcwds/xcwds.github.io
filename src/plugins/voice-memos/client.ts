/**
 * The page entry: the Voice memos tool (#214). Its recordings are `@xcwds/plugin-recorder`'s
 * `app.recordings`, which registers their collections itself (group `recordings`, sensitive, never
 * in backups).
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
