import { describe, expect, it } from 'vitest';
import { formatIngredient } from './scale';
import { nativeSystem, systemOf, toSystem } from './units';

const fmt = (...args: Parameters<typeof formatIngredient>) => formatIngredient(...args).quantity;

describe('systemOf and nativeSystem', () => {
	it('classifies units; spoons and counts belong to neither', () => {
		expect(systemOf('cup')).toBe('us');
		expect(systemOf('g')).toBe('metric');
		expect(systemOf('tsp')).toBeUndefined();
		expect(systemOf(undefined)).toBeUndefined();
	});

	it('picks the system most measured ingredients use, US on a tie', () => {
		expect(nativeSystem(['g', 'g', 'tsp'])).toBe('metric');
		expect(nativeSystem(['cup', 'tsp', undefined])).toBe('us');
		expect(nativeSystem(['tsp'])).toBe('us');
	});
});

describe('toSystem', () => {
	it('leaves a quantity already in the target system alone', () => {
		expect(toSystem({ lo: 2, hi: 2, unit: 'cup' }, 'us', undefined, 2)).toEqual({
			lo: 2,
			hi: 2,
			unit: 'cup'
		});
	});

	it('prefers the recipe’s own alt measure, scaled with the amount', () => {
		const flour = { amount: 2.25, unit: 'cup', item: 'flour', alt: { amount: 280, unit: 'g' } };
		expect(fmt(flour, 1, 'metric')).toBe('280 g');
		expect(fmt(flour, 0.5, 'metric')).toBe('140 g');
		expect(fmt(flour, 1, 'us')).toBe('2 ¼ cups');
		const yeast = { amount: 6, unit: 'g', item: 'yeast', alt: { amount: 2, unit: 'tsp' } };
		expect(fmt(yeast, 1, 'us')).toBe('2 tsp');
		expect(fmt(yeast, 1, 'metric')).toBe('6 g');
	});

	it('converts volume and weight without an alt, tidily rounded', () => {
		expect(fmt({ amount: 2, unit: 'cup', item: 'buttermilk' }, 1, 'metric')).toBe('475 ml');
		expect(fmt({ amount: 0.5, unit: 'cup', item: 'oil' }, 1, 'metric')).toBe('120 ml');
		expect(fmt({ amount: 4, unit: 'lb', item: 'pork' }, 1, 'metric')).toBe('1.8 kg');
		expect(fmt({ amount: 650, unit: 'g', item: 'flour' }, 1, 'us')).toBe('23 oz');
		expect(fmt({ amount: 1200, unit: 'g', item: 'pork' }, 1, 'us')).toBe('2 ⅝ lb');
		expect(fmt({ amount: 100, unit: 'g', item: 'cheese' }, 1, 'us')).toBe('3.5 oz');
		expect(fmt({ amount: 30, unit: 'ml', item: 'oil' }, 1, 'us')).toBe('2 Tbsp');
		expect(fmt({ amount: 250, unit: 'ml', item: 'milk' }, 1, 'us')).toBe('1 cup');
	});

	it('keeps spoons, counts and ranges sensible', () => {
		expect(fmt({ amount: 1, unit: 'tsp', item: 'salt' }, 1, 'metric')).toBe('1 tsp');
		expect(fmt({ amount: 2, item: 'egg', plural: 'eggs' }, 1, 'metric')).toBe('2');
		expect(fmt({ amount: [1, 2], unit: 'cup', item: 'stock' }, 1, 'metric')).toBe('235–475 ml');
	});

	it('moves to a bigger unit as amounts grow', () => {
		expect(fmt({ amount: 650, unit: 'g', item: 'flour' }, 2, 'metric')).toBe('1.3 kg');
		expect(fmt({ amount: 5, unit: 'cup', item: 'stock' }, 1, 'metric')).toBe('1.2 l');
	});
});
