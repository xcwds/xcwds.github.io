import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { recipes, searchRecipes } from './index';
import skipped from './notion-skipped.json';

describe('recipes', () => {
	it('loads every data file', () => {
		const files = readdirSync(new URL('./data', import.meta.url)).filter((f) =>
			f.endsWith('.json')
		);
		expect(recipes).toHaveLength(files.length);
	});

	it('uses the file name as the slug', () => {
		const files = readdirSync(new URL('./data', import.meta.url));
		for (const recipe of recipes) {
			expect(files).toContain(`${recipe.slug}.json`);
			expect(recipe.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		}
	});

	it('has unique Notion ids that are not also marked skipped', () => {
		const ids = recipes.map((r) => r.notion.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of skipped.skipped) expect(ids).not.toContain(s.id);
	});

	it('never imports parody recipes', () => {
		for (const recipe of recipes) expect(recipe.tags).not.toContain('Parody');
	});

	it('has the required content', () => {
		for (const recipe of recipes) {
			expect(recipe.name).not.toBe('');
			expect(recipe.ingredients.length).toBeGreaterThan(0);
			expect(recipe.instructions.length).toBeGreaterThan(0);
		}
	});
});

describe('searchRecipes', () => {
	it('matches names and tags, case-insensitively, on every term', () => {
		expect(searchRecipes(recipes, '').length).toBe(recipes.length);
		expect(searchRecipes(recipes, 'SALMON').length).toBeGreaterThan(0);
		expect(searchRecipes(recipes, 'autumn pork').every((r) => r.tags.includes('Autumn'))).toBe(
			true
		);
		expect(searchRecipes(recipes, 'zzzz-no-match')).toHaveLength(0);
	});
});
