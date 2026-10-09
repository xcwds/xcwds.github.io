import { describe, expect, it } from 'vitest';
import { doneness, formatInternal, formatRise, MEATS, type Meat } from './doneness';

const meat = (id: string) => MEATS.find((m) => m.id === id)!;
const pick = (m: Meat, size: string, level: string) =>
	doneness(m, m.sizes.find((s) => s.id === size)!, m.levels.find((l) => l.id === level)!);

describe('doneness data', () => {
	it('uses the USDA safe minimums', () => {
		expect(meat('beef').usdaF).toBe(145);
		expect(meat('pork').usdaF).toBe(145);
		expect(meat('poultry').usdaF).toBe(165);
		expect(meat('ground').usdaF).toBe(160);
		expect(meat('fish').usdaF).toBe(145);
	});

	it('has unique ids and levels in rising order', () => {
		expect(new Set(MEATS.map((m) => m.id)).size).toBe(MEATS.length);
		for (const m of MEATS) {
			const temps = m.levels.map((l) => l.targetF);
			expect(temps).toEqual([...temps].sort((a, b) => a - b));
			expect(new Set(m.levels.map((l) => l.id)).size).toBe(m.levels.length);
			expect(m.sizes.length).toBeGreaterThan(0);
		}
	});
});

describe('doneness', () => {
	it('pulls a rare steak early and flags it as below the USDA minimum', () => {
		expect(pick(meat('beef'), 'steak', 'rare')).toEqual({
			targetF: 125,
			pullF: 120,
			overshootF: 0,
			restMinutes: 5,
			belowUsda: true
		});
		expect(pick(meat('beef'), 'roast', 'medium-rare').pullF).toBe(125);
	});

	it('never pulls a safe level below the USDA minimum', () => {
		expect(pick(meat('pork'), 'steak', 'medium')).toMatchObject({
			pullF: 145,
			overshootF: 5,
			belowUsda: false
		});
		expect(pick(meat('beef'), 'roast', 'medium')).toMatchObject({ pullF: 145, overshootF: 10 });
		expect(pick(meat('beef'), 'roast', 'medium-well').pullF).toBe(145);
		expect(pick(meat('beef'), 'roast', 'well-done')).toMatchObject({ pullF: 150, overshootF: 0 });
	});

	it('takes poultry and ground meat off at the target', () => {
		expect(pick(meat('poultry'), 'whole', 'breast')).toEqual({
			targetF: 165,
			pullF: 165,
			overshootF: 10,
			restMinutes: 20,
			belowUsda: false
		});
		expect(pick(meat('ground'), 'patties', 'beef-pork')).toMatchObject({
			pullF: 160,
			overshootF: 0
		});
	});

	it('has no carryover for fall-apart braises', () => {
		expect(pick(meat('pork'), 'roast', 'fall-apart')).toMatchObject({ pullF: 200, overshootF: 0 });
	});
});

describe('formatRise', () => {
	it('converts a difference without the 32° offset', () => {
		expect(formatRise(5, 'F')).toBe('5°F');
		expect(formatRise(5, 'C')).toBe('3°C');
		expect(formatRise(10, 'C')).toBe('6°C');
	});
});

describe('formatInternal', () => {
	it('rounds to the whole degree, matching USDA °C figures', () => {
		expect(formatInternal(145, 'C')).toBe('63°C');
		expect(formatInternal(160, 'C')).toBe('71°C');
		expect(formatInternal(165, 'C')).toBe('74°C');
		expect(formatInternal(125, 'C')).toBe('52°C');
		expect(formatInternal(165, 'F')).toBe('165°F');
	});
});
