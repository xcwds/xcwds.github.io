/** The page entry: the Level and compass (#217) and this phone's calibration. */
import { definePlugin } from '@xcwds/core';
import { entries, registerEntries } from '../../lib/storage.js';
import { NAME } from './index.js';
import { tool } from './tool.js';

export default definePlugin(
	(app) => {
		app.tools?.add(tool);
		registerEntries(app.storage, [entries.levelCalibration]);
	},
	{ name: NAME, namespace: '', dependencies: ['@xcwds/plugin-tools'], network: false }
);
