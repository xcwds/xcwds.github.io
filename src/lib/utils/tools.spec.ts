import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { App } from '@xcwds/core';
import type { TestApp } from '@xcwds/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config from '../../../xcwds.config';
import { BRAND, TAGLINE } from '#lib/brand.js';
import { APPS } from '#lib/apps.js';
import { GUIDES, allTools, toolGuides, tools } from './tools';
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
			'/utils/microwave-time',
			'/utils/url-sanitizer',
			'/utils/qr',
			'/utils/weightlifting',
			'/utils/self-control',
			'/utils/last-done',
			'/utils/level',
			'/utils/camera',
			'/utils/photo-cleaner',
			'/utils/magnifier',
			'/utils/scanner',
			'/utils/voice-memos'
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

describe('apps (#223)', () => {
	it('hold every tool, and all start on', () => {
		const ids = APPS.map((a) => a.id);
		for (const tool of allTools()) expect(ids, tool.path).toContain(tool.app);
		expect(APPS.filter((a) => a.default === false)).toEqual([]);
		expect(APPS.find((a) => a.id === 'self-control')?.private).toBe(true);
	});

	it('know their tools in the service worker too, so byApp keeps only the apps that are on offline', () => {
		// The worker sees only tools added by a `./worker` entry (xcwds/xcwds#163).
		const plugins = new URL('../../plugins/', import.meta.url);
		const withTool = readdirSync(plugins).filter((name) =>
			existsSync(new URL(`${name}/tool.js`, plugins))
		);
		expect(withTool).toHaveLength(allTools().length);
		for (const name of withTool) {
			const pkg = JSON.parse(readFileSync(new URL(`${name}/package.json`, plugins), 'utf8'));
			expect(pkg.exports['./worker'], name).toBe('./worker.ts');
			const worker = readFileSync(new URL(`${name}/worker.ts`, plugins), 'utf8');
			expect(worker, name).toContain('app.tools?.add(tool)');
		}
	});

	it('each hide their marked items before first paint (app.css)', () => {
		const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
		for (const { id } of APPS)
			expect(css, id).toContain(`:root[data-apps-off~='${id}'] [data-app='${id}']`);
	});

	it("hide an app's tools while it's off, and show them again", () => {
		const kitchen = ['/utils/pizza-dough', '/utils/coffee-timer', '/utils/cooking-timer'];
		expect(app!.tools!.setOn('kitchen', false)).toBe(true);
		const shown = tools().map((t) => t.path);
		for (const path of kitchen) expect(shown).not.toContain(path);
		expect(shown).toContain('/utils/weightlifting');
		// Pages that still open (the Kitchen Guide's links) see every tool.
		expect(allTools().map((t) => t.path)).toEqual(expect.arrayContaining(kitchen));
		expect(app!.tools!.setOn('kitchen', true)).toBe(true);
		expect(tools().map((t) => t.path)).toEqual(expect.arrayContaining(kitchen));
	});
});

describe('brand', () => {
	it("is the config's brand", () => {
		expect(config.brand).toMatchObject({ name: BRAND, tagline: TAGLINE });
	});
});
