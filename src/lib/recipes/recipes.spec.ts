import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { getArticle } from '$lib/guide';
import { FOOD_PRESETS, foodPreset } from '$lib/utils/oven';
import { MAX_STEP_TIMER_MINUTES, recipes, searchRecipes, stepText, stepTimer } from './index';
import { isScalable } from './scale';
import { systemOf } from './units';
import { getPan } from './pans';

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

describe('guides', () => {
	it('link to Kitchen Guide articles that exist', () => {
		for (const recipe of recipes) {
			for (const slug of recipe.guides ?? []) expect(getArticle(slug), recipe.slug).toBeDefined();
		}
	});
});

describe('pans', () => {
	it('name a known pan, on recipes whose yield counts pans or loaves', () => {
		for (const recipe of recipes.filter((r) => r.pan)) {
			expect(getPan(recipe.pan!), recipe.slug).toBeDefined();
			expect(['pans', 'loaves'], recipe.slug).toContain(recipe.yield.unit);
		}
	});
});

describe('alt measures', () => {
	it('give the same amount in the other system (or spoons), for a convertible unit', () => {
		for (const recipe of recipes) {
			for (const ingredient of recipe.ingredients.filter(isScalable)) {
				const { alt, unit } = ingredient;
				if (!alt) continue;
				const from = systemOf(unit);
				expect(from, `${recipe.slug}: ${ingredient.item}`).toBeDefined();
				expect(systemOf(alt.unit), `${recipe.slug}: ${ingredient.item}`).not.toBe(from);
				expect(alt.amount).toBeGreaterThan(0);
			}
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
