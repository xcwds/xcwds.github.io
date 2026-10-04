import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { FOOD_PRESETS, foodPreset } from '$lib/utils/oven';
import { recipes, searchRecipes } from './index';
import { isScalable } from './scale';

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

	it('has the required content', () => {
		for (const recipe of recipes) {
			expect(recipe.name).not.toBe('');
			expect(recipe.ingredients.length).toBeGreaterThan(0);
			expect(recipe.instructions.length).toBeGreaterThan(0);
		}
	});

	it('has a scalable yield, and valid oven data', () => {
		for (const recipe of recipes) {
			expect(recipe.yield.amount).toBeGreaterThan(0);
			expect(recipe.yield.unit).not.toBe('');
			expect(recipe.yield.singular).not.toBe('');
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
		expect(searchRecipes(recipes, 'COOKIES').length).toBeGreaterThan(0);
		expect(searchRecipes(recipes, 'baking bread').map((r) => r.slug)).toEqual(['banana-bread']);
		expect(searchRecipes(recipes, 'zzzz-no-match')).toHaveLength(0);
	});
});
