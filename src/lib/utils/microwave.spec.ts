import { describe, expect, it } from 'vitest';
import {
	FOODS,
	foodPackage,
	formatClock,
	foodTime,
	microwaveProblem,
	microwaveTime,
	microwaveWarnings,
	parseWatts,
	POWER_LEVELS,
	type MicrowaveInput
} from './microwave';

const input = (over: Partial<MicrowaveInput> = {}): MicrowaveInput => ({
	seconds: 180,
	packageWatts: 1100,
	yourWatts: 1100,
	level: 100,
	...over
});

describe('microwaveTime', () => {
	it('keeps the time at the same wattage and full power', () => {
		expect(microwaveTime(input())).toBe(180);
	});

	it('scales with wattage: a weaker microwave takes longer', () => {
		// 3 min at 1100 W → 3 × 1100 / 700 = 4:42.9, to the nearest 5 s.
		expect(microwaveTime(input({ yourWatts: 700 }))).toBe(285);
		expect(microwaveTime(input({ packageWatts: 700, yourWatts: 1100 }))).toBe(115);
	});

	it('treats the power level as a share of the wattage', () => {
		expect(microwaveTime(input({ level: 50 }))).toBe(360);
		expect(microwaveTime(input({ yourWatts: 1000, packageWatts: 1000, level: 80 }))).toBe(225);
	});

	it('never rounds down to nothing', () => {
		expect(microwaveTime(input({ seconds: 1, packageWatts: 300, yourWatts: 2000 }))).toBe(5);
	});

	it('has no time for bad input, and says why', () => {
		expect(microwaveTime(input({ seconds: 0 }))).toBeUndefined();
		expect(microwaveProblem(input({ seconds: 0 }))).toMatch(/more than 0/);
		expect(microwaveProblem(input({ yourWatts: NaN }))).toBe('Enter every number.');
		expect(microwaveProblem(input({ packageWatts: 100 }))).toMatch(/between 300 and 2000/);
		expect(microwaveProblem(input({ level: 0 }))).toMatch(/power level/);
		expect(microwaveProblem(input())).toBeUndefined();
	});
});

describe('microwaveWarnings', () => {
	it('flags changes of more than double or half', () => {
		expect(microwaveWarnings(input())).toEqual([]);
		expect(microwaveWarnings(input({ yourWatts: 700 }))).toEqual([]);
		expect(microwaveWarnings(input({ level: 50 }))).toEqual([]);
		expect(microwaveWarnings(input({ level: 40 }))[0]).toMatch(/rough/);
		expect(microwaveWarnings(input({ yourWatts: 300, packageWatts: 700 }))).toHaveLength(1);
		expect(microwaveWarnings(input({ packageWatts: 2000, yourWatts: 700 }))).toHaveLength(1);
		expect(microwaveWarnings(input({ seconds: -1 }))).toEqual([]);
	});
});

describe('formatClock', () => {
	it('reads like a microwave display', () => {
		expect(formatClock(5)).toBe('0:05');
		expect(formatClock(285)).toBe('4:45');
		expect(formatClock(3725)).toBe('1:02:05');
	});
});

describe('parseWatts', () => {
	it('takes whole wattages in range', () => {
		expect(parseWatts(1000)).toBe(1000);
		expect(parseWatts(1000.5)).toBeUndefined();
		expect(parseWatts(250)).toBeUndefined();
		expect(parseWatts('1000')).toBeUndefined();
	});
});

describe('foodTime', () => {
	const food = (id: string) => FOODS.find((f) => f.id === id)!;
	const soup = food('soup');
	const [fromFridge, frozenSoup] = soup.states as [
		(typeof soup.states)[0],
		(typeof soup.states)[0]
	];

	it('gives the starting time at 1000 W, and scales with wattage', () => {
		expect(foodTime({ food: soup, state: fromFridge, amount: 1, yourWatts: 1000 })).toBe(90);
		// 90 s × 1000 / 700 = 128.6 s, to the nearest 5.
		expect(foodTime({ food: soup, state: fromFridge, amount: 1, yourWatts: 700 })).toBe(130);
		// Frozen is at 50% power: the same share of a 1200 W microwave.
		expect(foodTime({ food: soup, state: frozenSoup, amount: 1, yourWatts: 1200 })).toBe(250);
	});

	it('takes longer for more, but less than in proportion, up to the most it holds for', () => {
		// 2 cups: 90 × 2^0.8 = 156.7 s.
		expect(foodTime({ food: soup, state: fromFridge, amount: 2, yourWatts: 1000 })).toBe(155);
		const most = foodTime({ food: soup, state: fromFridge, amount: soup.max, yourWatts: 1000 });
		expect(foodTime({ food: soup, state: fromFridge, amount: 99, yourWatts: 1000 })).toBe(most);
		expect(foodTime({ food: soup, state: fromFridge, amount: NaN, yourWatts: 1000 })).toBe(90);
	});

	it('warns in its own words when your microwave is far from 1000 W', () => {
		const input = foodPackage({ food: soup, state: fromFridge, amount: 1, yourWatts: 450 });
		expect(microwaveWarnings(input, true)).toEqual([expect.stringContaining('1000 W microwave')]);
		expect(microwaveWarnings(input, true)[0]).not.toContain('package');
		expect(microwaveWarnings({ ...input, yourWatts: 800 }, true)).toEqual([]);
	});

	it('has no time for a wattage out of range', () => {
		expect(foodTime({ food: soup, state: fromFridge, amount: 1, yourWatts: 100 })).toBeUndefined();
	});

	it('lists foods with unique ids, sensible times and power levels', () => {
		expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
		for (const f of FOODS) {
			expect(f.max).toBeGreaterThanOrEqual(1);
			expect(f.scale).toBeGreaterThan(0);
			expect(f.scale).toBeLessThanOrEqual(1);
			expect(new Set(f.states.map((s) => s.id)).size).toBe(f.states.length);
			for (const s of f.states) {
				expect(s.seconds).toBeGreaterThan(0);
				expect(POWER_LEVELS).toContain(s.level);
				expect(s.tip).not.toBe('');
			}
		}
	});
});
