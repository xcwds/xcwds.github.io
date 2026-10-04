import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { FOOD_PRESETS, foodPreset } from '$lib/utils/oven';
import { isClassic, recipes, searchRecipes } from './index';
import { isScalable } from './scale';
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
		const ids = recipes.flatMap((r) => (r.notion ? [r.notion.id] : []));
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

	it('gives classics a scalable yield, and valid oven data', () => {
		const classics = recipes.filter(isClassic);
		expect(classics.length).toBeGreaterThan(0);
		for (const recipe of classics) {
			expect(recipe.notion).toBeUndefined();
			expect(recipe.yield?.amount).toBeGreaterThan(0);
			expect(recipe.ingredients.some(isScalable)).toBe(true);
		}
		for (const recipe of recipes.filter((r) => r.oven)) {
			const oven = recipe.oven!;
			expect(FOOD_PRESETS.map((p) => p.id)).toContain(oven.food);
			const [lo, hi] =
				typeof oven.minutes === 'number' ? [oven.minutes, oven.minutes] : oven.minutes;
			expect(lo).toBeGreaterThan(0);
			expect(hi).toBeGreaterThanOrEqual(lo);
			expect(oven.temp).toBeGreaterThan(foodPreset(oven.food).doneF);
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
