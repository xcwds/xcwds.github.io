import { describe, expect, it } from 'vitest';
import { formatDecimal, formatFraction, formatIngredient, formatYield, scaleAmount } from './scale';

describe('formatFraction', () => {
	it('prints kitchen fractions', () => {
		expect(formatFraction(2)).toBe('2');
		expect(formatFraction(1.5)).toBe('1 ½');
		expect(formatFraction(0.333)).toBe('⅓');
		expect(formatFraction(0.75)).toBe('¾');
		expect(formatFraction(2.25)).toBe('2 ¼');
		expect(formatFraction(0.125)).toBe('⅛');
	});

	it('rounds to the nearest fraction, carrying into the whole number', () => {
		expect(formatFraction(0.98)).toBe('1');
		expect(formatFraction(1.68)).toBe('1 ⅔');
		expect(formatFraction(3.01)).toBe('3');
	});

	it('keeps tiny amounts visible', () => {
		expect(formatFraction(0.03)).toBe('0.03');
		expect(formatFraction(0)).toBe('0');
	});

	it('never prints a positive amount as 0 (#69)', () => {
		expect(formatFraction(1 / 16)).toBe('0.06');
		expect(formatFraction(0.07)).toBe('⅛');
		expect(formatIngredient({ amount: 0.125, unit: 'tsp', item: 'salt' }, 0.5).quantity).toBe(
			'0.06 tsp'
		);
		expect(formatIngredient({ amount: 0.25, unit: 'tsp', item: 'salt' }, 0.25).quantity).toBe(
			'0.06 tsp'
		);
	});
});

describe('formatDecimal', () => {
	it('rounds grams sensibly', () => {
		expect(formatDecimal(650.4)).toBe('650');
		expect(formatDecimal(6.25)).toBe('6.3');
	});
});

describe('scaleAmount', () => {
	it('scales numbers and ranges', () => {
		expect(scaleAmount(2, 1.5)).toBe(3);
		expect(scaleAmount([2, 3], 2)).toEqual([4, 6]);
	});
});

describe('formatIngredient', () => {
	it('leaves strings alone', () => {
		expect(formatIngredient('Salt, to taste', 3)).toEqual({ quantity: '', text: 'Salt, to taste' });
	});

	it('pluralizes units and items by the printed quantity', () => {
		const flour = { amount: 1, unit: 'cup', item: 'flour' };
		expect(formatIngredient(flour)).toEqual({ quantity: '1 cup', text: 'flour' });
		expect(formatIngredient(flour, 0.5)).toEqual({ quantity: '½ cup', text: 'flour' });
		expect(formatIngredient(flour, 1.5)).toEqual({ quantity: '1 ½ cups', text: 'flour' });
		const egg = { amount: 1, item: 'large egg', plural: 'large eggs', note: 'beaten' };
		expect(formatIngredient(egg)).toEqual({ quantity: '1', text: 'large egg, beaten' });
		expect(formatIngredient(egg, 2)).toEqual({ quantity: '2', text: 'large eggs, beaten' });
	});

	it('keeps metric amounts as decimals and prints ranges', () => {
		expect(formatIngredient({ amount: 650, unit: 'g', item: 'flour' }, 0.5).quantity).toBe('325 g');
		expect(formatIngredient({ amount: [2, 3], unit: 'Tbsp', item: 'oil' }, 2).quantity).toBe(
			'4–6 Tbsp'
		);
		expect(formatIngredient({ amount: [0.5, 1], unit: 'cup', item: 'nuts' }).quantity).toBe(
			'½–1 cup'
		);
	});
});

describe('formatYield', () => {
	it('uses the singular for one', () => {
		const loaf = { unit: 'loaves', singular: 'loaf' };
		expect(formatYield(1, loaf)).toBe('1 loaf');
		expect(formatYield(2, loaf)).toBe('2 loaves');
	});
});
