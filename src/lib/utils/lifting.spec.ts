import { describe, expect, it } from 'vitest';
import {
	COMMERCIAL_GYM,
	activeSet,
	canAdd,
	commercialGym,
	findStation,
	formatWeight,
	historyToText,
	loadProblems,
	parseEquipmentSet,
	platesForTarget as search,
	stations,
	sumPlates,
	totalWeight,
	unlimitedPlates,
	workoutHasContent,
	workoutSummary,
	workoutToText,
	type Bar,
	type Equipment,
	type EquipmentSet,
	type PlateInventory,
	type WeightUnit
} from './lifting';

/** v2's five stations as one set (a dumbbell handle you have two of), every plate unlimited. */
const gym = (unit: WeightUnit, bars: Partial<Record<string, Partial<Bar>>> = {}): EquipmentSet => {
	const [barbell, light, handle, kettlebell] =
		unit === 'lb' ? [45, 25, 7.5, 5] : [20, 15, 2.5, 2.5];
	const list: Bar[] = [
		{
			id: 'barbell',
			name: `Barbell (${barbell} ${unit})`,
			type: 'barbell',
			weight: barbell,
			count: 1
		},
		{
			id: 'barbell-light',
			name: `Barbell (${light} ${unit})`,
			type: 'barbell',
			weight: light,
			count: 1
		},
		{ id: 'dumbbell', name: 'Dumbbell', type: 'dumbbell', weight: handle, count: 2 },
		{ id: 'kettlebell', name: 'Kettlebell', type: 'kettlebell', weight: kettlebell, count: 1 }
	];
	return {
		id: 'test',
		name: 'Test',
		unit,
		bars: list.map((bar) => ({ ...bar, ...bars[bar.id] })),
		plates: unlimitedPlates(unit)
	};
};
/** v2 station ids, as stations of `gym`. */
const station = (set: EquipmentSet, id: string): Equipment => {
	const found = stations(set).find((e) => e.id === (id === 'dumbbells' ? 'dumbbell:pair' : id));
	if (!found) throw new Error(`no station ${id}`);
	return found;
};
const eq = (id: string) => station(gym('lb'), id);
const kg = (id: string) => station(gym('kg'), id);
/** Only these sizes, unlimited. */
const only = (sizes: readonly number[]): PlateInventory =>
	Object.fromEntries(sizes.map((p) => [p, null]));
/** Older tests list the sizes you have (unlimited); newer ones pass an inventory. */
const platesForTarget = (e: Equipment, target: number, have: readonly number[] | PlateInventory) =>
	search(e, target, Array.isArray(have) ? only(have) : (have as PlateInventory));
const LB = [45, 35, 25, 10, 5, 2.5, 1.25];
const KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const ALL_LB = unlimitedPlates('lb');

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
		expect(stations(commercialGym('kg')).map((e) => e.name)).toEqual(['Barbell (20 kg)']);
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

describe('bar limits (#71)', () => {
	const set = gym('lb', {
		kettlebell: { plates: [10], maxPlatesPerSide: 4 },
		dumbbell: { weight: 5, plates: [10, 5, 2.5], maxPlatesPerSide: 4, maxLoad: 45 },
		barbell: { weight: 35, name: 'Barbell (35 lb)' }
	});
	const mine = (id: string) => station(set, id);

	it("carries a bar's weight and limits to its stations", () => {
		expect(mine('barbell')).toMatchObject({ bar: 35, name: 'Barbell (35 lb)', sides: 2 });
		expect(mine('dumbbell')).toMatchObject({ bar: 5, maxLoad: 45, maxPlatesPerSide: 4 });
		expect(mine('dumbbells')).toMatchObject({ bar: 5, count: 2, name: 'Dumbbell pair' });
		expect(mine('barbell-light')).toEqual(eq('barbell-light'));
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

	it('stops at the max load and says so', () => {
		// 45 lb of plates at most (the handle doesn't count), so 22.5 per side, in four plates.
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
		// A pair's max load is per dumbbell: 7.5 handle + 22.5 of plates, twice.
		const pair = station(gym('lb', { dumbbell: { maxLoad: 22.5 } }), 'dumbbells');
		expect(platesForTarget(pair, 100, LB)).toMatchObject({ total: 60, overMax: true });
	});

	it('finds the heaviest load within the plate limit, matching a brute-force search', () => {
		const sets = [[...LB], [45, 25, 10, 5], [25, 10, 2.5], [10]];
		for (const plates of sets) {
			for (const limit of [1, 2, 3, 5]) {
				const bar = station(gym('lb', { barbell: { maxPlatesPerSide: limit } }), 'barbell');
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
		expect(canAdd(kb, [{ 10: 3 }, { 10: 3 }], 0, 10, true, ALL_LB)).toBe(true);
		expect(canAdd(kb, [{ 10: 4 }, { 10: 4 }], 0, 10, true, ALL_LB)).toBe(false);
		expect(canAdd(kb, [{}, {}], 0, 5, true, ALL_LB)).toBe(false);

		const db = mine('dumbbell');
		// 40 lb of plates; another 2.5 on both sides makes 45 (the max load), another 5 makes 50.
		expect(canAdd(db, [{ 10: 2 }, { 10: 2 }], 0, 2.5, true, ALL_LB)).toBe(true);
		expect(canAdd(db, [{ 10: 2 }, { 10: 2 }], 0, 5, true, ALL_LB)).toBe(false);
		// Uneven sides: one more 5 on the left alone is 45.
		expect(canAdd(db, [{ 10: 2 }, { 10: 2 }], 0, 5, false, ALL_LB)).toBe(true);

		expect(canAdd(eq('barbell'), [{ 45: 40 }, { 45: 40 }], 0, 45, true, ALL_LB)).toBe(true);
	});

	it('explains what a saved load breaks', () => {
		expect(loadProblems(mine('kettlebell'), [{ 10: 2 }, {}], 'lb', ALL_LB)).toEqual([]);
		expect(loadProblems(mine('kettlebell'), [{ 25: 1, 10: 5 }, {}], 'lb', ALL_LB)).toEqual([
			"25 lb plates don't fit this kettlebell.",
			'More than 4 plates on the post.'
		]);
		const over = [
			{ 10: 2, 5: 1 },
			{ 10: 2, 5: 1 }
		];
		expect(loadProblems(mine('dumbbell'), over, 'lb', ALL_LB)).toEqual([
			'Over the 45 lb max load.'
		]);
		const pair = station(gym('lb', { dumbbell: { maxLoad: 15 } }), 'dumbbells');
		expect(loadProblems(pair, [{ 10: 1 }, { 10: 1 }], 'lb', ALL_LB)).toEqual([
			'Over the 15 lb max load per dumbbell.'
		]);
	});
});

describe('equipment sets (#82)', () => {
	/** The home gym from #82: 2×45, 2×25, 8×10, 4×5, 4×2.5, 4×1.25 (no 35s), a 35 lb bar. */
	const HOME: PlateInventory = { 45: 2, 35: 0, 25: 2, 10: 8, 5: 4, 2.5: 4, 1.25: 4 };
	const home: EquipmentSet = {
		id: 'home',
		name: 'Home gym',
		unit: 'lb',
		bars: [
			{ id: 'bar', name: 'Barbell (35 lb)', type: 'barbell', weight: 35, count: 1 },
			{ id: 'db', name: 'Dumbbell', type: 'dumbbell', weight: 5, count: 2 },
			{ id: 'kb', name: 'Kettlebell', type: 'kettlebell', weight: 10, count: 1 }
		],
		plates: HOME
	};

	it('has a commercial gym with one barbell and unlimited plates in either unit', () => {
		expect(stations(commercialGym('lb'))).toEqual([
			{ id: 'barbell', name: 'Barbell (45 lb)', type: 'barbell', bar: 45, sides: 2, count: 1 }
		]);
		expect(stations(commercialGym('kg'))[0]).toMatchObject({ name: 'Barbell (20 kg)', bar: 20 });
		expect(commercialGym('lb').plates).toEqual(ALL_LB);
		const lifting = { unit: 'kg' as const, activeSet: COMMERCIAL_GYM, sets: [home] };
		expect(activeSet(lifting).unit).toBe('kg');
		expect(activeSet({ ...lifting, activeSet: 'home' })).toBe(home);
		expect(activeSet({ ...lifting, activeSet: 'gone' }).id).toBe(COMMERCIAL_GYM);
	});

	it('offers a pair for two or more dumbbell handles, and falls back to the first station', () => {
		expect(stations(home).map((e) => e.id)).toEqual(['bar', 'db', 'db:pair', 'kb']);
		const one = { ...home, bars: [{ ...home.bars[1], count: 1 }] };
		expect(stations(one).map((e) => e.id)).toEqual(['db']);
		expect(findStation(home, 'nope').id).toBe('bar');
		expect(findStation(home, undefined).id).toBe('bar');
	});

	it('loads only the plates you have, the same on both sides', () => {
		const bar = findStation(home, 'bar');
		// Per side: 45, 25, 4 × 10, 2 × 5, 2 × 2.5, 2 × 1.25 = 127.5.
		expect(platesForTarget(bar, 1000, HOME)).toEqual({
			perSide: { 45: 1, 25: 1, 10: 4, 5: 2, 2.5: 2, 1.25: 2 },
			total: 35 + 2 * 127.5,
			exact: false
		});
		// No 35s: 60 per side is 45 + 10 + 5.
		expect(platesForTarget(bar, 155, HOME)?.perSide).toEqual({ 45: 1, 10: 1, 5: 1 });
		// A pair of dumbbells has 4 sides: two 10s each side of each dumbbell uses all eight.
		const pair = findStation(home, 'db:pair');
		expect(platesForTarget(pair, 2 * (5 + 2 * 20), HOME)?.perSide).toMatchObject({ 10: 2 });
		expect(platesForTarget(pair, 2 * (5 + 2 * 45), HOME)?.perSide).toEqual({
			10: 2,
			5: 1,
			2.5: 1,
			1.25: 1
		});
	});

	it('matches a brute-force search with limited, unlimited and mixed counts', () => {
		const inventories: PlateInventory[] = [
			HOME,
			{ 45: null, 25: 2, 10: 3, 2.5: 1 },
			{ 45: 1, 10: null, 5: 3 },
			{ 25: null, 5: null, 1.25: 5 },
			{ 35: 4, 10: 6 }
		];
		const bar = eq('barbell');
		for (const inventory of inventories) {
			// Every per-side total, from per-side limits of ⌊count / 2⌋ (unlimited capped by target).
			const sizes = Object.keys(inventory).map(Number);
			let reachable = new Set([0]);
			for (const plate of sizes) {
				const n = inventory[plate];
				const max = n === null ? 600 / plate : Math.floor((n ?? 0) / 2);
				const next = new Set<number>();
				for (const w of reachable)
					for (let k = 0; k <= max && w + k * plate <= 300; k++) next.add(w + k * plate);
				reachable = next;
			}
			for (let target = 45; target <= 600; target += 2.5) {
				const best = Math.max(...[...reachable].filter((w) => 45 + 2 * w <= target + 1e-9));
				const got = platesForTarget(bar, target, inventory)!;
				const label = `${target} lb with ${JSON.stringify(inventory)}`;
				expect(got.total, label).toBeCloseTo(45 + 2 * best, 9);
				for (const [plate, k] of Object.entries(got.perSide)) {
					const n = inventory[Number(plate)];
					if (n !== null) expect(2 * (k ?? 0), label).toBeLessThanOrEqual(n ?? 0);
				}
			}
		}
	});

	it('stays fast for huge targets with mixed counts (#32)', () => {
		const start = performance.now();
		const got = platesForTarget(eq('barbell'), 1e12, { 45: null, 25: 99, 10: 99, 5: 99 });
		expect(performance.now() - start).toBeLessThan(200);
		expect(got?.exact).toBe(false);
	});

	it('only adds plates you have left, counting every side of every implement', () => {
		const bar = findStation(home, 'bar');
		expect(canAdd(bar, [{ 45: 1 }, { 45: 1 }], 0, 45, true, HOME)).toBe(false);
		expect(canAdd(bar, [{ 45: 1 }, {}], 1, 45, false, HOME)).toBe(true);
		expect(canAdd(bar, [{}, {}], 0, 35, true, HOME)).toBe(false);
		const pair = findStation(home, 'db:pair');
		expect(canAdd(pair, [{ 10: 1 }, { 10: 1 }], 0, 10, true, HOME)).toBe(true);
		expect(canAdd(pair, [{ 10: 2 }, { 10: 2 }], 0, 10, true, HOME)).toBe(false);
		const kb = findStation(home, 'kb');
		expect(canAdd(kb, [{ 5: 3 }, { 5: 3 }], 0, 5, true, HOME)).toBe(true);
		expect(canAdd(kb, [{ 5: 4 }, { 5: 4 }], 0, 5, true, HOME)).toBe(false);
	});

	it('says which plates a saved load uses more of than you have', () => {
		const bar = findStation(home, 'bar');
		expect(
			loadProblems(
				bar,
				[
					{ 45: 2, 35: 1 },
					{ 45: 2, 35: 1 }
				],
				'lb',
				HOME
			)
		).toEqual(['You have 2 × 45 lb plates.', 'You have no 35 lb plates.']);
	});

	it("parses saved sets, dropping what can't be used", () => {
		expect(parseEquipmentSet(home)).toEqual(home);
		expect(parseEquipmentSet({ ...home, id: COMMERCIAL_GYM })).toBeUndefined();
		expect(parseEquipmentSet({ ...home, unit: 'stone' })).toBeUndefined();
		expect(
			parseEquipmentSet({ ...home, bars: [{ id: 'x', type: 'sled', weight: 5 }] })
		).toBeUndefined();
		const messy = parseEquipmentSet({
			id: 'm',
			name: '  ',
			unit: 'lb',
			bars: [
				{ id: 'a', type: 'barbell', weight: 33, count: 0, maxLoad: -1, plates: [45, 7] },
				{ id: 'a', type: 'dumbbell', weight: 5 },
				{ id: 'b', type: 'kettlebell', weight: 9999 },
				{ id: 'c', type: 'dumbbell', weight: 4, name: 'Spinlock', count: 4, maxPlatesPerSide: 3 }
			],
			plates: { 45: 2, 25: null, 10: 1.5, 5: -1, 99: 3 }
		});
		expect(messy).toEqual({
			id: 'm',
			name: 'My equipment',
			unit: 'lb',
			bars: [
				{ id: 'a', name: 'Barbell (33 lb)', type: 'barbell', weight: 33, count: 1 },
				{ id: 'c', name: 'Spinlock', type: 'dumbbell', weight: 4, count: 4, maxPlatesPerSide: 3 }
			],
			plates: { 45: 2, 35: 0, 25: null, 10: 0, 5: 0, 2.5: 0, 1.25: 0 }
		});
	});
});
