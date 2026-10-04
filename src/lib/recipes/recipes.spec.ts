import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { FOOD_PRESETS, foodPreset } from '$lib/utils/oven';
import { MAX_STEP_TIMER_MINUTES, recipes, searchRecipes, stepText, stepTimer } from './index';
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

describe('step timers', () => {
	it('have a positive time or range, and oven timers only in recipes with an oven', () => {
		for (const recipe of recipes) {
			for (const step of recipe.instructions) {
				expect(stepText(step)).not.toBe('');
				const timer = stepTimer(step);
				if (!timer) continue;
				const [lo, hi] =
					typeof timer.minutes === 'number' ? [timer.minutes, timer.minutes] : timer.minutes;
				expect(lo).toBeGreaterThan(0);
				expect(hi).toBeGreaterThanOrEqual(lo);
				// Longer waits (fridge rests, slow cookers) would keep the screen on for hours.
				expect(hi).toBeLessThanOrEqual(MAX_STEP_TIMER_MINUTES);
				if (timer.oven) expect(recipe.oven).toBeDefined();
				if (timer.label !== undefined) expect(timer.label.trim()).not.toBe('');
			}
		}
	});

	it('are used by the recipes', () => {
		expect(recipes.some((r) => r.instructions.some((s) => stepTimer(s)?.oven))).toBe(true);
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
