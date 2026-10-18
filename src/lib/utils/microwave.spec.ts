import { describe, expect, it } from 'vitest';
import {
	formatClock,
	microwaveProblem,
	microwaveTime,
	microwaveWarnings,
	parseWatts,
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
