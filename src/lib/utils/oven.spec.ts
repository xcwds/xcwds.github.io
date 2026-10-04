import { describe, expect, it } from 'vitest';
import {
	adjustOvenTime,
	foodPreset,
	formatMinutes,
	formatMinutesRange,
	formatTemp,
	fromF,
	ovenProblem,
	toF
} from './oven';

const meat = foodPreset('meat');
const at = (fromF: number, to: number, minutes = 60, food = meat) =>
	adjustOvenTime({ fromF, toF: to, minutes, startF: food.startF, doneF: food.doneF });

describe('adjustOvenTime', () => {
	it('keeps the time at the same temperature', () => {
		expect(at(350, 350)).toBeCloseTo(60);
	});

	it('shortens hotter and lengthens cooler, by plausible amounts', () => {
		const hotter = at(350, 400)!;
		const cooler = at(350, 325)!;
		expect(hotter).toBeGreaterThan(45);
		expect(hotter).toBeLessThan(55);
		expect(cooler).toBeGreaterThan(62);
		expect(cooler).toBeLessThan(72);
	});

	it('round-trips', () => {
		const there = at(350, 425, 60)!;
		expect(at(425, 350, there)).toBeCloseTo(60);
	});

	it('scales linearly with the recipe time', () => {
		expect(at(350, 400, 120)!).toBeCloseTo(2 * at(350, 400, 60)!);
	});

	it('is the same in °C (the math only depends on temperature ratios)', () => {
		expect(toF(fromF(400, 'C'), 'C')).toBeCloseTo(400);
		expect(toF(180, 'C')).toBeCloseTo(356);
	});

	it('has no answer when the oven is not hotter than the done temperature', () => {
		expect(at(350, 160)).toBeUndefined();
		expect(ovenProblem({ fromF: 350, toF: 160, minutes: 60, startF: 40, doneF: 165 })).toMatch(
			/hotter/
		);
		expect(ovenProblem({ fromF: 350, toF: 400, minutes: 0, startF: 40, doneF: 165 })).toMatch(
			/time/
		);
		expect(ovenProblem({ fromF: 350, toF: NaN, minutes: 60, startF: 40, doneF: 165 })).toBe(
			'Enter every number.'
		);
	});
});

describe('formatting', () => {
	it('formats temperatures like an oven dial', () => {
		expect(formatTemp(350, 'F')).toBe('350°F');
		expect(formatTemp(350, 'C')).toBe('175°C');
		expect(formatTemp(425, 'C')).toBe('220°C');
	});

	it('formats minutes and ranges', () => {
		expect(formatMinutes(45)).toBe('45 min');
		expect(formatMinutes(60)).toBe('1 h');
		expect(formatMinutes(83.6)).toBe('1 h 24 min');
		expect(formatMinutesRange([9, 11])).toBe('9–11 min');
		expect(formatMinutesRange([10, 10])).toBe('10 min');
		expect(formatMinutesRange([55, 65])).toBe('55 min – 1 h 5 min');
	});
});
