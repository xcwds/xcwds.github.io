import { describe, expect, it } from 'vitest';
import {
	EQUIPMENT,
	lb,
	platesForTarget,
	sumPlates,
	totalWeight,
	workoutToText,
	type Equipment
} from './lifting';

const eq = (id: string) => EQUIPMENT.find((e) => e.id === id) as Equipment;

describe('totalWeight', () => {
	it('adds the bar and plates on both sides', () => {
		const side = { 45: 1, 25: 1, 2.5: 1 };
		expect(sumPlates(side)).toBe(72.5);
		expect(totalWeight(eq('barbell-45'), [side, side])).toBe(190);
		expect(totalWeight(eq('barbell-25'), [{}, {}])).toBe(25);
	});

	it('supports uneven sides', () => {
		expect(totalWeight(eq('barbell-45'), [{ 45: 1 }, { 25: 1 }])).toBe(115);
	});

	it('counts both dumbbells of a pair and one post on a kettlebell', () => {
		expect(totalWeight(eq('dumbbell'), [{ 10: 1 }, { 10: 1 }])).toBe(27.5);
		expect(totalWeight(eq('dumbbells'), [{ 10: 1 }, { 10: 1 }])).toBe(55);
		expect(totalWeight(eq('kettlebell'), [{ 10: 2 }, { 45: 9 }])).toBe(25);
	});
});

describe('platesForTarget', () => {
	it('uses the fewest plates per side', () => {
		expect(platesForTarget(eq('barbell-45'), 225)).toEqual({
			perSide: { 45: 2 },
			total: 225,
			exact: true
		});
		// 60 per side: 35 + 25 beats 45 + 10 + 5.
		expect(platesForTarget(eq('barbell-45'), 165)?.perSide).toEqual({ 35: 1, 25: 1 });
		expect(platesForTarget(eq('barbell-45'), 47.5)?.perSide).toEqual({ 1.25: 1 });
	});

	it('splits a dumbbell pair target across both dumbbells', () => {
		// 55 total → 27.5 each → 10 per side on a 7.5 handle.
		expect(platesForTarget(eq('dumbbells'), 55)).toEqual({
			perSide: { 10: 1 },
			total: 55,
			exact: true
		});
		expect(platesForTarget(eq('dumbbell'), 27.5)?.perSide).toEqual({ 10: 1 });
	});

	it('loads a kettlebell on one side only', () => {
		expect(platesForTarget(eq('kettlebell'), 40)?.perSide).toEqual({ 35: 1 });
	});

	it('falls back to the closest weight under the target', () => {
		expect(platesForTarget(eq('barbell-45'), 46)).toEqual({ perSide: {}, total: 45, exact: false });
		expect(platesForTarget(eq('barbell-45'), 136)?.total).toBe(135);
	});

	it('respects which plates are available', () => {
		expect(platesForTarget(eq('barbell-45'), 115, [45, 25, 10, 5])?.perSide).toEqual({
			25: 1,
			10: 1
		});
		expect(platesForTarget(eq('barbell-45'), 50, [45])).toEqual({
			perSide: {},
			total: 45,
			exact: false
		});
	});

	it('rejects targets lighter than the bar', () => {
		expect(platesForTarget(eq('barbell-45'), 40)).toBeNull();
		expect(platesForTarget(eq('dumbbells'), 10)).toBeNull();
		expect(platesForTarget(eq('barbell-45'), Number.NaN)).toBeNull();
	});
});

describe('lb', () => {
	it('drops trailing zeros', () => {
		expect(lb(135)).toBe('135 lb');
		expect(lb(52.5)).toBe('52.5 lb');
		expect(lb(1.25)).toBe('1.25 lb');
	});
});

describe('workoutToText', () => {
	it('groups identical consecutive sets and skips empty ones', () => {
		const text = workoutToText({
			date: 'Sat, Oct 4, 2026',
			exercises: [
				{
					id: 1,
					name: 'Bench Press',
					sets: [
						{ id: 1, weight: 135, reps: 5 },
						{ id: 2, weight: 135, reps: 5 },
						{ id: 3, weight: 155, reps: 3 },
						{ id: 4, weight: null, reps: null }
					]
				},
				{ id: 2, name: 'Push-ups', sets: [{ id: 1, weight: null, reps: 1 }] },
				{ id: 3, name: '', sets: [] }
			]
		});
		expect(text).toBe(
			[
				'Workout – Sat, Oct 4, 2026',
				'',
				'Bench Press',
				'  2 sets × 5 reps @ 135 lb',
				'  1 set × 3 reps @ 155 lb',
				'',
				'Push-ups',
				'  1 set × 1 rep'
			].join('\n')
		);
	});
});
