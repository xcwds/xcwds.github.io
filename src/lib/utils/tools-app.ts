/**
 * For unit tests: the app as xcwds.config.ts builds it, with `@xcwds/plugin-tools` and the app's
 * own plugins (in the config's order), so `tools()` lists what the page does. Plugins that need a
 * DOM to boot are left out.
 */
import type { Descriptor } from '@xcwds/core';
import { buildTestApp } from '@xcwds/testing';
import config from '../../../xcwds.config';

const KEEP = /^(@xcwds\/plugin-tools|@xcwds\/plugin-timers|xcwds-app(-.+)?)$/;

export const toolsApp = () =>
	buildTestApp(
		{
			...config,
			plugins: (config.plugins ?? []).filter((p) => KEEP.test((p as Descriptor).name ?? ''))
		},
		{ import: (id) => import(/* @vite-ignore */ id) }
	);
