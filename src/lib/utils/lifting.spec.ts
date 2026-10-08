import { describe, expect, it } from 'vitest';
import {
	UNITS,
	canAdd,
	equipmentList,
	findEquipment,
	loadProblems,
	formatWeight,
	historyToText,
	type EquipmentSetups,
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

	it('returns the empty bar right away when no plates are selected (#64)', () => {
		const start = performance.now();
		const none = platesForTarget(eq('barbell'), 100_000_000, []);
		platesForTarget(eq('barbell'), 1e15, []);
		expect(performance.now() - start).toBeLessThan(200);
		expect(none).toEqual({ perSide: {}, total: 45, exact: false });
		expect(platesForTarget(eq('barbell'), 45, [])).toEqual({ perSide: {}, total: 45, exact: true });
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

describe('equipment setups (#71)', () => {
	const setups: EquipmentSetups = {
		lb: {
			kettlebell: { plates: [10], maxPlatesPerSide: 4 },
			dumbbell: { bar: 5, plates: [10, 5, 2.5], maxPlatesPerSide: 4, maxLoad: 50 },
			barbell: { bar: 35 }
		},
		kg: {}
	};
	const mine = (id: string) => findEquipment('lb', id, setups);

	it('applies a setup over the default and keeps the default without one', () => {
		expect(mine('barbell')).toMatchObject({ bar: 35, name: 'Barbell (35 lb)', sides: 2 });
		expect(mine('dumbbell')).toMatchObject({ bar: 5, maxLoad: 50, maxPlatesPerSide: 4 });
		expect(mine('barbell-light')).toEqual(eq('barbell-light'));
		expect(findEquipment('kg', 'barbell', setups)).toEqual(kg('barbell'));
		expect(equipmentList('lb', setups).map((e) => e.name)).toEqual([
			'Barbell (35 lb)',
			'Barbell (25 lb)',
			'Dumbbell',
			'Dumbbell pair',
			'Kettlebell'
		]);
	});

	it('only uses plates that fit', () => {
		// Only 10s fit, four at most: 5 lb handle + 40 = 45 is the most it takes.
		expect(platesForTarget(mine('kettlebell'), 45, LB)).toEqual({
			perSide: { 10: 4 },
			total: 45,
			exact: true
		});
		expect(platesForTarget(mine('kettlebell'), 60, LB)).toEqual({
			perSide: { 10: 4 },
			total: 45,
			exact: false
		});
		expect(platesForTarget(mine('kettlebell'), 50, LB)?.perSide).toEqual({ 10: 4 });
	});

	it('stops at the max weight and says so', () => {
		// 50 max: 45 lb of plates on a 5 lb handle, so 22.5 per side at most, in four plates.
		expect(platesForTarget(mine('dumbbell'), 100, LB)).toEqual({
			perSide: { 10: 2, 2.5: 1 },
			total: 50,
			exact: false,
			overMax: true
		});
		expect(platesForTarget(mine('dumbbell'), 50, LB)).toEqual({
			perSide: { 10: 2, 2.5: 1 },
			total: 50,
			exact: true
		});
		// A pair's max is per dumbbell.
		const pair = findEquipment('lb', 'dumbbells', { lb: { dumbbells: { maxLoad: 30 } } });
		expect(platesForTarget(pair, 100, LB)).toMatchObject({ total: 60, overMax: true });
	});

	it('finds the heaviest load within the plate limit, matching a brute-force search', () => {
		const sets = [[...LB], [45, 25, 10, 5], [25, 10, 2.5], [10]];
		for (const plates of sets) {
			for (const limit of [1, 2, 3, 5]) {
				const bar = findEquipment('lb', 'barbell', {
					lb: { barbell: { maxPlatesPerSide: limit } }
				});
				// Every per-side total reachable with at most `limit` plates.
				let reachable = new Set([0]);
				for (let i = 0; i < limit; i++)
					reachable = new Set([
						...reachable,
						...[...reachable].flatMap((w) => plates.map((p) => w + p))
					]);
				for (let target = 45; target <= 600; target += 2.5) {
					const best = Math.max(...[...reachable].filter((w) => 45 + 2 * w <= target + 1e-9));
					const got = platesForTarget(bar, target, plates)!;
					const label = `${target} lb, ${limit} of [${plates}]`;
					expect(got.total, label).toBeCloseTo(45 + 2 * best, 9);
					expect(countPlates(got.perSide), label).toBeLessThanOrEqual(limit);
				}
			}
		}
	});

	it('only adds plates that fit, within the limits', () => {
		const kb = mine('kettlebell');
		expect(canAdd(kb, [{ 10: 3 }, { 10: 3 }], 0, 10, true)).toBe(true);
		expect(canAdd(kb, [{ 10: 4 }, { 10: 4 }], 0, 10, true)).toBe(false);
		expect(canAdd(kb, [{}, {}], 0, 5, true)).toBe(false);

		const db = mine('dumbbell');
		// 5 + 2 × 20 = 45; another 2.5 on both sides makes 50 (the max), another 5 makes 55.
		expect(canAdd(db, [{ 10: 2 }, { 10: 2 }], 0, 2.5, true)).toBe(true);
		expect(canAdd(db, [{ 10: 2 }, { 10: 2 }], 0, 5, true)).toBe(false);
		// Uneven sides: one more 5 on the left alone is 50.
		expect(canAdd(db, [{ 10: 2 }, { 10: 2 }], 0, 5, false)).toBe(true);

		expect(canAdd(eq('barbell'), [{ 45: 40 }, { 45: 40 }], 0, 45, true)).toBe(true);
	});

	it('explains what a saved load breaks', () => {
		expect(loadProblems(mine('kettlebell'), [{ 10: 2 }, {}], 'lb')).toEqual([]);
		expect(loadProblems(mine('kettlebell'), [{ 25: 1, 10: 5 }, {}], 'lb')).toEqual([
			"25 lb plates don't fit this kettlebell.",
			'More than 4 plates on the post.'
		]);
		expect(
			loadProblems(
				mine('dumbbell'),
				[
					{ 10: 2, 5: 1 },
					{ 10: 2, 5: 1 }
				],
				'lb'
			)
		).toEqual(['Over the 50 lb max.']);
		expect(
			loadProblems(
				findEquipment('lb', 'dumbbells', { lb: { dumbbells: { maxLoad: 20 } } }),
				[{ 10: 1 }, { 10: 1 }],
				'lb'
			)
		).toEqual(['Over the 20 lb max per dumbbell.']);
	});
});
