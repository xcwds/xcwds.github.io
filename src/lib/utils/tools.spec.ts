import type { App } from '@xcwds/core';
import type { TestApp } from '@xcwds/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config from '../../../xcwds.config';
import { BRAND, TAGLINE } from '$lib/brand';
import { GUIDES, toolGuides, tools } from './tools';
import { toolsApp } from './tools-app';

let app: TestApp | undefined;
vi.mock('@xcwds/sveltekit', () => ({ getApp: (): App => app! }));
beforeAll(async () => {
	app = await toolsApp();
});
afterAll(() => app?.close());

describe('tools', () => {
	it("are @xcwds/plugin-tools' list, in the order the config lists their plugins", () => {
		expect(tools().map((t) => t.path)).toEqual([
			'/utils/pizza-dough',
			'/utils/coffee-timer',
			'/utils/cooking-timer',
			'/utils/oven-time',
			'/utils/url-sanitizer',
			'/utils/weightlifting',
			'/utils/self-control',
			'/utils/last-done'
		]);
	});

	it('are the only pages guides are linked from', () => {
		const paths = tools().map((t) => t.path);
		for (const path of Object.keys(GUIDES)) expect(paths, path).toContain(path);
		expect(toolGuides('/utils/nope')).toEqual([]);
	});

	it('make the manifest shortcuts (after Recipes), never a private tool', () => {
		const shortcuts = tools().filter((t) => t.shortcut);
		expect(shortcuts.map((t) => t.name)).toEqual([
			'Coffee Timer',
			'Cooking Timer',
			'URL Sanitizer'
		]);
		expect(shortcuts.some((t) => t.private)).toBe(false);
		expect(config.manifest?.shortcuts).toBeUndefined();
	});
});

describe('brand', () => {
	it("is the config's brand", () => {
		expect(config.brand).toMatchObject({ name: BRAND, tagline: TAGLINE });
	});
});
