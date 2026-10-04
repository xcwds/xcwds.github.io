import { describe, expect, it } from 'vitest';
import {
	UNITS,
	findEquipment,
	formatWeight,
	historyToText,
	platesForTarget,
	sumPlates,
	totalWeight,
	workoutHasContent,
	workoutSummary,
	workoutToText
} from './lifting';

const eq = (id: string) => findEquipment('lb', id);
const kg = (id: string) => findEquipment('kg', id);
const LB = UNITS.lb.plates;
const KG = UNITS.kg.plates;

describe('totalWeight', () => {
	it('adds the bar and plates on both sides', () => {
		const side = { 45: 1, 25: 1, 2.5: 1 };
		expect(sumPlates(side)).toBe(72.5);
		expect(totalWeight(eq('barbell'), [side, side])).toBe(190);
		expect(totalWeight(eq('barbell-light'), [{}, {}])).toBe(25);
	});

	it('supports uneven sides', () => {
		expect(totalWeight(eq('barbell'), [{ 45: 1 }, { 25: 1 }])).toBe(115);
	});

	it('counts both dumbbells of a pair and one post on a kettlebell', () => {
		expect(totalWeight(eq('dumbbell'), [{ 10: 1 }, { 10: 1 }])).toBe(27.5);
		expect(totalWeight(eq('dumbbells'), [{ 10: 1 }, { 10: 1 }])).toBe(55);
		expect(totalWeight(eq('kettlebell'), [{ 10: 2 }, { 45: 9 }])).toBe(25);
	});
});

/** The original unbounded DP (one array slot per 1.25 units of target), as a reference. */
function referencePlates(equipment: ReturnType<typeof eq>, target: number, available: number[]) {
	const empty = equipment.count * equipment.bar;
	if (!(target >= empty)) return null;
	const maxUnits = Math.floor((target - empty) / (equipment.count * equipment.sides) / 1.25 + 1e-9);
	const best = new Array<number>(maxUnits + 1).fill(Infinity);
	best[0] = 0;
	for (let u = 1; u <= maxUnits; u++)
		for (const p of available) {
			const size = Math.round(p / 1.25);
			if (size <= u) best[u] = Math.min(best[u], best[u - size] + 1);
		}
	let u = maxUnits;
	while (u > 0 && best[u] === Infinity) u--;
	return { units: u, plates: best[u] };
}

const countPlates = (perSide: Partial<Record<number, number>>) =>
	Object.values(perSide).reduce((sum: number, n) => sum + (n ?? 0), 0);

describe('platesForTarget, bounded (#32)', () => {
	it('matches the unbounded search for every target and several plate sets', () => {
		const sets = [[...LB], [45, 25, 10, 5], [45, 35], [25, 10], [10, 2.5], [45], []];
		for (const available of sets) {
			for (let target = 45; target <= 6000; target += 2.5) {
				const got = platesForTarget(eq('barbell'), target, available)!;
				const want = referencePlates(eq('barbell'), target, available)!;
				const label = `${target} lb with [${available}]`;
				expect(got.total, label).toBe(45 + 2 * want.units * 1.25);
				expect(countPlates(got.perSide), label).toBe(want.plates);
			}
		}
	});

	it('stays fast for absurd targets and rejects non-finite ones', () => {
		const start = performance.now();
		const huge = platesForTarget(eq('barbell'), 100_000_000, LB)!;
		platesForTarget(eq('barbell'), 1e15, LB);
		platesForTarget(kg('barbell'), 123_456_789, KG);
		expect(performance.now() - start).toBeLessThan(200);
		expect(huge).toMatchObject({ total: 100_000_000, exact: true });
		const odd = platesForTarget(eq('barbell'), 100_000_001, LB)!;
		expect(odd).toMatchObject({ total: 100_000_000, exact: false });
		expect(platesForTarget(eq('barbell'), Infinity, LB)).toBeNull();
	});
});

describe('platesForTarget', () => {
	it('uses the fewest plates per side', () => {
		expect(platesForTarget(eq('barbell'), 225, LB)).toEqual({
			perSide: { 45: 2 },
			total: 225,
			exact: true
		});
		// 60 per side: 35 + 25 beats 45 + 10 + 5.
		expect(platesForTarget(eq('barbell'), 165, LB)?.perSide).toEqual({ 35: 1, 25: 1 });
		expect(platesForTarget(eq('barbell'), 47.5, LB)?.perSide).toEqual({ 1.25: 1 });
	});

	it('splits a dumbbell pair target across both dumbbells', () => {
		// 55 total → 27.5 each → 10 per side on a 7.5 handle.
		expect(platesForTarget(eq('dumbbells'), 55, LB)).toEqual({
			perSide: { 10: 1 },
			total: 55,
			exact: true
		});
		expect(platesForTarget(eq('dumbbell'), 27.5, LB)?.perSide).toEqual({ 10: 1 });
	});

	it('loads a kettlebell on one side only', () => {
		expect(platesForTarget(eq('kettlebell'), 40, LB)?.perSide).toEqual({ 35: 1 });
	});

	it('falls back to the closest weight under the target', () => {
		expect(platesForTarget(eq('barbell'), 46, LB)).toEqual({
			perSide: {},
			total: 45,
			exact: false
		});
		expect(platesForTarget(eq('barbell'), 136, LB)?.total).toBe(135);
	});

	it('respects which plates are available', () => {
		expect(platesForTarget(eq('barbell'), 115, [45, 25, 10, 5])?.perSide).toEqual({
			25: 1,
			10: 1
		});
		expect(platesForTarget(eq('barbell'), 50, [45])).toEqual({
			perSide: {},
			total: 45,
			exact: false
		});
	});

	it('rejects targets lighter than the bar', () => {
		expect(platesForTarget(eq('barbell'), 40, LB)).toBeNull();
		expect(platesForTarget(eq('dumbbells'), 10, LB)).toBeNull();
		expect(platesForTarget(eq('barbell'), Number.NaN, LB)).toBeNull();
	});
});

describe('formatWeight', () => {
	it('drops trailing zeros', () => {
		expect(formatWeight(135, 'lb')).toBe('135 lb');
		expect(formatWeight(52.5, 'lb')).toBe('52.5 lb');
		expect(formatWeight(1.25, 'lb')).toBe('1.25 lb');
	});
});

describe('workoutToText', () => {
	it('groups identical consecutive sets and skips empty ones', () => {
		const text = workoutToText({
			date: 'Sat, Oct 4, 2026',
			unit: 'lb',
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

describe('kg', () => {
	it('uses kg bars, handles and plates', () => {
		expect(UNITS.kg.equipment.map((e) => e.name)).toContain('Barbell (20 kg)');
		expect(totalWeight(kg('barbell'), [{ 20: 1 }, { 20: 1 }])).toBe(60);
		expect(totalWeight(kg('barbell-light'), [{}, {}])).toBe(15);
	});

	it('finds the fewest kg plates for a target', () => {
		// 100 kg on a 20 kg bar: 40 kg per side = 25 + 15.
		expect(platesForTarget(kg('barbell'), 100, KG)).toEqual({
			perSide: { 25: 1, 15: 1 },
			total: 100,
			exact: true
		});
		expect(formatWeight(102.5, 'kg')).toBe('102.5 kg');
	});

	it('labels workout weights with the unit', () => {
		const workout = {
			date: 'Sun',
			unit: 'kg' as const,
			exercises: [{ id: 1, name: 'Squat', sets: [{ id: 2, weight: 100, reps: 5 }] }]
		};
		expect(workoutToText(workout)).toContain('@ 100 kg');
	});
});

describe('history helpers', () => {
	const make = (name: string, sets: { weight: number | null; reps: number | null }[]) => ({
		date: 'Sat',
		unit: 'lb' as const,
		exercises: [{ id: 1, name, sets: sets.map((s, i) => ({ id: i + 2, ...s })) }]
	});

	it('knows when a workout has anything worth keeping', () => {
		expect(workoutHasContent(make('', [{ weight: null, reps: null }]))).toBe(false);
		expect(workoutHasContent(make('Squat', [{ weight: null, reps: null }]))).toBe(true);
		expect(workoutHasContent(make('', [{ weight: null, reps: 5 }]))).toBe(true);
	});

	it('summarizes exercises and counts logged sets', () => {
		expect(
			workoutSummary(
				make('Squat', [
					{ weight: 225, reps: 5 },
					{ weight: 225, reps: 5 },
					{ weight: null, reps: null }
				])
			)
		).toBe('Squat · 2 sets');
		expect(workoutSummary(make('', [{ weight: 10, reps: 1 }]))).toBe('Workout · 1 set');
	});

	it('joins all workouts as text', () => {
		const a = make('Squat', [{ weight: 225, reps: 5 }]);
		const b = { ...make('Row', [{ weight: 40, reps: 8 }]), unit: 'kg' as const };
		const text = historyToText([
			{ id: 2, finishedAt: '', workout: b },
			{ id: 1, finishedAt: '', workout: a }
		]);
		expect(text).toContain('Row\n  1 set × 8 reps @ 40 kg');
		expect(text.indexOf('Row')).toBeLessThan(text.indexOf('Squat'));
	});
});
