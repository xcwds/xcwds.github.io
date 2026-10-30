/**
 * The page entry: the Document scanner tool (#215). The scan in progress is
 * `@xcwds/plugin-scanner`'s `app.scanner.pages`, which registers its collection itself (group
 * `scanner`, sensitive, never in backups).
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
