export type WeightUnit = 'lb' | 'kg';
export const WEIGHT_UNITS: WeightUnit[] = ['lb', 'kg'];

/** Plate counts keyed by plate weight (in the unit system's unit). */
export type PlateCounts = Partial<Record<number, number>>;

export type UnitSystem = {
	unit: WeightUnit;
	/** Plate sizes, heaviest first. */
	plates: readonly number[];
	/** The commercial gym's barbell. */
	barbell: number;
};

export const UNITS: Record<WeightUnit, UnitSystem> = {
	lb: { unit: 'lb', plates: [45, 35, 25, 10, 5, 2.5, 1.25], barbell: 45 },
	// Olympic 20 kg bar.
	kg: { unit: 'kg', plates: [25, 20, 15, 10, 5, 2.5, 1.25], barbell: 20 }
};

/**
 * The heaviest total the calculator loads, past what an Olympic bar is rated for (about 1,000 lb).
 * A typo or a joke can't load a ton of plates (#92). 545 kg is 1,200 lb, to the nearest 5 kg.
 */
export const MAX_TOTAL: Record<WeightUnit, number> = { lb: 1200, kg: 545 };

export type BarType = 'barbell' | 'dumbbell' | 'kettlebell';
export const BAR_TYPES: BarType[] = ['barbell', 'dumbbell', 'kettlebell'];

/** A bar, dumbbell handle or kettlebell handle in an equipment set (#82). */
export type Bar = {
	/** Unique within its set; saved as the calculator's remembered station. */
	id: string;
	name: string;
	type: BarType;
	/** Weight of the bar or handle. */
	weight: number;
	/** How many you have; two or more dumbbell handles can also be loaded as a pair. */
	count: number;
	/** Most plate weight it holds, bar not included (none: no limit, #71). */
	maxLoad?: number;
	/** Most plates on one side, or on a kettlebell's post (none: no limit). */
	maxPlatesPerSide?: number;
	/** Plate sizes that fit (none: every size). */
	plates?: number[];
};

/**
 * How many plates of each standard size you have, in total (not per side): `null` is
 * unlimited, a missing size is none.
 */
export type PlateInventory = Partial<Record<number, number | null>>;

/** Where you lift: its bars and plates, in one unit (#82). */
export type EquipmentSet = {
	id: string;
	name: string;
	unit: WeightUnit;
	bars: Bar[];
	plates: PlateInventory;
};

/** Something to load in the calculator: one bar or handle, or a pair of dumbbells. */
export type Equipment = {
	/** The bar's id, or `<bar id>:pair` for a pair of dumbbells. */
	id: string;
	name: string;
	type: BarType;
	/** Weight of one bar or handle. */
	bar: number;
	/** 2 for bars and dumbbell handles (plates on both ends), 1 for a kettlebell post. */
	sides: 1 | 2;
	/** How many identical implements (a pair of dumbbells is 2). */
	count: 1 | 2;
	maxLoad?: number;
	plates?: readonly number[];
	maxPlatesPerSide?: number;
	/** Most total weight, bar(s) included (`MAX_TOTAL` for the set's unit). */
	maxTotal?: number;
};

/** The built-in set's id; it isn't saved with your own sets. */
export const COMMERCIAL_GYM = 'commercial';

/** The default name for a bar: "Barbell (35 lb)", "Dumbbell", "Kettlebell". */
export function barName(type: BarType, weight: number, unit: WeightUnit): string {
	if (type === 'barbell') return `Barbell (${weight} ${unit})`;
	return type === 'dumbbell' ? 'Dumbbell' : 'Kettlebell';
}

/** Every standard size, unlimited. */
export const unlimitedPlates = (unit: WeightUnit): PlateInventory =>
	Object.fromEntries(UNITS[unit].plates.map((plate) => [plate, null]));

/** The built-in set: one barbell and as many plates of every size as you like. */
export function commercialGym(unit: WeightUnit): EquipmentSet {
	const weight = UNITS[unit].barbell;
	return {
		id: COMMERCIAL_GYM,
		name: 'Commercial gym',
		unit,
		bars: [
			{ id: 'barbell', name: barName('barbell', weight, unit), type: 'barbell', weight, count: 1 }
		],
		plates: unlimitedPlates(unit)
	};
}

/** The weightlifting part of settings. */
export type LiftingSetup = {
	/** The commercial gym's unit (your own sets have their own). */
	unit: WeightUnit;
	/** `COMMERCIAL_GYM` or the id of one of `sets`. */
	activeSet: string;
	sets: EquipmentSet[];
};

/** The set you're lifting with (the commercial gym when the saved one is gone). */
export function activeSet(lifting: LiftingSetup): EquipmentSet {
	return lifting.sets.find((s) => s.id === lifting.activeSet) ?? commercialGym(lifting.unit);
}

/** What the calculator offers for a set: each bar, plus a pair for two or more dumbbell handles. */
export function stations(set: EquipmentSet): Equipment[] {
	return set.bars.flatMap((bar) => {
		const one: Equipment = {
			id: bar.id,
			name: bar.name,
			type: bar.type,
			bar: bar.weight,
			sides: bar.type === 'kettlebell' ? 1 : 2,
			count: 1,
			maxTotal: MAX_TOTAL[set.unit]
		};
		if (bar.maxLoad !== undefined) one.maxLoad = bar.maxLoad;
		if (bar.maxPlatesPerSide !== undefined) one.maxPlatesPerSide = bar.maxPlatesPerSide;
		if (bar.plates) one.plates = bar.plates;
		if (bar.type !== 'dumbbell' || bar.count < 2) return [one];
		return [one, { ...one, id: `${bar.id}:pair`, name: `${bar.name} pair`, count: 2 }];
	});
}

/** A station by id, or the set's first one. */
export function findStation(set: EquipmentSet, id: string | undefined): Equipment {
	const list = stations(set);
	return list.find((e) => e.id === id) ?? list[0];
}

/** Bounds for a set's numbers and lists, checked when saving and when loading settings. */
export const SETUP_LIMITS = {
	maxWeight: 2000,
	maxPlatesPerSide: 30,
	maxPlateCount: 99,
	maxBarCount: 20,
	maxBars: 20,
	maxSets: 20,
	maxName: 40
};

const isWeight = (v: unknown): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= SETUP_LIMITS.maxWeight;
const isIntIn = (v: unknown, min: number, max: number): v is number =>
	Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string =>
	typeof v === 'string' && v.length > 0 && v.length <= SETUP_LIMITS.maxName;
const cleanName = (v: unknown) =>
	typeof v === 'string' ? v.trim().slice(0, SETUP_LIMITS.maxName) : '';

/** Plate sizes that fit, from saved data: undefined when invalid or when every size fits. */
export function parseFitting(unit: WeightUnit, v: unknown): number[] | undefined {
	const sizes = UNITS[unit].plates;
	if (!Array.isArray(v) || !v.every((p) => sizes.includes(p)) || v.length >= sizes.length)
		return undefined;
	return sizes.filter((p) => v.includes(p));
}

/** A bar from saved data, or undefined without a usable id, type and weight. */
export function parseBar(unit: WeightUnit, v: unknown): Bar | undefined {
	if (!isRecord(v) || !isId(v.id) || !BAR_TYPES.includes(v.type as BarType) || !isWeight(v.weight))
		return undefined;
	const type = v.type as BarType;
	const bar: Bar = {
		id: v.id,
		name: cleanName(v.name) || barName(type, v.weight, unit),
		type,
		weight: v.weight,
		count: isIntIn(v.count, 1, SETUP_LIMITS.maxBarCount) ? v.count : 1
	};
	if (isWeight(v.maxLoad)) bar.maxLoad = v.maxLoad;
	if (isIntIn(v.maxPlatesPerSide, 1, SETUP_LIMITS.maxPlatesPerSide))
		bar.maxPlatesPerSide = v.maxPlatesPerSide;
	const plates = parseFitting(unit, v.plates);
	if (plates) bar.plates = plates;
	return bar;
}

/** Every standard size's count from saved data: unlimited, a count, or none when invalid. */
export function parseInventory(unit: WeightUnit, v: unknown): PlateInventory {
	const saved = isRecord(v) ? v : {};
	return Object.fromEntries(
		UNITS[unit].plates.map((plate) => {
			const n = saved[plate];
			return [plate, n === null ? null : isIntIn(n, 0, SETUP_LIMITS.maxPlateCount) ? n : 0];
		})
	);
}

/**
 * One of your sets from saved data, or undefined when it can't be used (no valid bars, or the
 * built-in set's id). Bad bars are dropped, as are repeated bar ids.
 */
export function parseEquipmentSet(v: unknown): EquipmentSet | undefined {
	if (!isRecord(v) || !isId(v.id) || v.id === COMMERCIAL_GYM) return undefined;
	if (v.unit !== 'lb' && v.unit !== 'kg') return undefined;
	const unit = v.unit;
	const bars: Bar[] = [];
	for (const item of Array.isArray(v.bars) ? v.bars.slice(0, SETUP_LIMITS.maxBars) : []) {
		const bar = parseBar(unit, item);
		if (bar && !bars.some((b) => b.id === bar.id)) bars.push(bar);
	}
	if (!bars.length) return undefined;
	return {
		id: v.id,
		name: cleanName(v.name) || 'My equipment',
		unit,
		bars,
		plates: parseInventory(unit, v.plates)
	};
}

/** What a number in a set must be (blank is handled by each field: unlimited, none or required). */
export type NumberRule = 'weight' | 'plateCount' | 'barCount' | 'platesPerSide';

/** Why `value` can't be saved under `rule` ('' when it can). Mirrors the parsers above. */
export function numberProblem(rule: NumberRule, value: number, unit: WeightUnit): string {
	if (rule === 'weight')
		return isWeight(value)
			? ''
			: `Enter a weight from 0 to ${formatWeight(SETUP_LIMITS.maxWeight, unit)}.`;
	const [min, max] = {
		plateCount: [0, SETUP_LIMITS.maxPlateCount],
		barCount: [1, SETUP_LIMITS.maxBarCount],
		platesPerSide: [1, SETUP_LIMITS.maxPlatesPerSide]
	}[rule];
	return isIntIn(value, min, max) ? '' : `Enter a whole number from ${min} to ${max}.`;
}

/** `prefix-1`, `prefix-2`, … : the first one not in `taken`. */
export function uniqueId(prefix: string, taken: readonly string[]): string {
	for (let n = 1; ; n++) if (!taken.includes(`${prefix}-${n}`)) return `${prefix}-${n}`;
}

/** A new bar for a set: a barbell of the commercial gym's weight. */
export function newBar(set: EquipmentSet): Bar {
	const weight = UNITS[set.unit].barbell;
	return {
		id: uniqueId(
			'bar',
			set.bars.map((b) => b.id)
		),
		name: barName('barbell', weight, set.unit),
		type: 'barbell',
		weight,
		count: 1
	};
}

/** A new set of your own: one barbell, and no plates until you say how many you have. */
export function newSet(name: string, unit: WeightUnit, taken: readonly string[]): EquipmentSet {
	const set: EquipmentSet = {
		id: uniqueId('set', taken),
		name: name.trim().slice(0, SETUP_LIMITS.maxName) || 'My equipment',
		unit,
		bars: [],
		plates: Object.fromEntries(UNITS[unit].plates.map((plate) => [plate, 0]))
	};
	set.bars.push(newBar(set));
	return set;
}

/** An editable copy of a set (the commercial gym included), named "… copy". */
export function copySet(set: EquipmentSet, taken: readonly string[]): EquipmentSet {
	return {
		// JSON, not structuredClone: `set` may be reactive state (a proxy structuredClone rejects).
		...(JSON.parse(JSON.stringify(set)) as EquipmentSet),
		id: uniqueId('set', taken),
		name: `${set.name} copy`.slice(0, SETUP_LIMITS.maxName)
	};
}

/** "bar", "dumbbell" or "kettlebell", for messages. */
export const kind = (equipment: Equipment) =>
	equipment.type === 'barbell' ? 'bar' : equipment.type;

export const fits = (equipment: Equipment, plate: number) =>
	!equipment.plates || equipment.plates.includes(plate);

/** How many of a plate you have (Infinity when unlimited). */
export const owned = (inventory: PlateInventory, plate: number) => {
	const n = inventory[plate];
	return n === null ? Infinity : (n ?? 0);
};

/** How many plates are on one side. */
export const plateCount = (counts: PlateCounts) =>
	Object.values(counts).reduce((sum: number, n) => sum + Math.max(0, n ?? 0), 0);

export function sumPlates(counts: PlateCounts): number {
	return Object.entries(counts).reduce(
		(sum, [plate, n]) => sum + Number(plate) * Math.max(0, n ?? 0),
		0
	);
}

/** Weight of one implement (bar + plates on each side). */
export function implementWeight(equipment: Equipment, sides: PlateCounts[]): number {
	return equipment.bar + sides.slice(0, equipment.sides).reduce((sum, s) => sum + sumPlates(s), 0);
}

/** Total weight lifted: every implement counted (a dumbbell pair is two dumbbells). */
export function totalWeight(equipment: Equipment, sides: PlateCounts[]): number {
	return equipment.count * implementWeight(equipment, sides);
}

/** How many of a plate a load uses: on every side of every implement. */
export function platesUsed(equipment: Equipment, sides: PlateCounts[], plate: number): number {
	return (
		equipment.count *
		sides.slice(0, equipment.sides).reduce((sum, s) => sum + Math.max(0, s[plate] ?? 0), 0)
	);
}

/** The heaviest total this equipment loads: its `maxTotal`, but never less than the empty bar(s). */
export const totalCap = (equipment: Equipment) =>
	Math.max(equipment.count * equipment.bar, equipment.maxTotal ?? Infinity);

export type TargetResult = {
	/** Plates for one side (repeat on each side and on each implement). */
	perSide: PlateCounts;
	/** Total weight actually loaded with those plates. */
	total: number;
	/** True when `total` equals the target. */
	exact: boolean;
	/** Set when the target needs more than the equipment's max load (so the result stops there). */
	overMax?: true;
	/** Set when the target is over the calculator's `maxTotal` (so the result stops there). */
	overLimit?: true;
};

const UNIT = 1.25; // Smallest plate in both systems; every loadable weight is a multiple of it.

/**
 * Fewest plates per side to reach `target` total (or the closest weight under it), using only
 * plates you have (`inventory`) that fit the equipment, within its max load, plates per side and
 * max total.
 * Loads are symmetric, so a size can go on each side at most count ÷ (sides × implements)
 * times. Returns null when the target is lighter than the empty bar(s), or isn't a number.
 *
 * Coin change over 1.25 lb/kg units, bounded so any target costs the same small amount of work
 * (a huge typo used to freeze the page, #32). Sizes you have a limited number of add at most
 * their total. Of the unlimited ones, in a fewest-plates load you never need L or more of a
 * smaller one (L: the largest unlimited plate, in units), since L of them weigh as much as fewer
 * of the largest. So everything else adds at most `spare` units, everything above that window is
 * plain largest plates, and the DP only covers the window. With a plate limit there's no such
 * shortcut, but the limit itself bounds the search (at most that many of the largest plate).
 */
export function platesForTarget(
	equipment: Equipment,
	target: number,
	inventory: PlateInventory
): TargetResult | null {
	const empty = equipment.count * equipment.bar;
	if (!Number.isFinite(target) || !(target >= empty)) return null;
	const equipmentCap = equipment.count * (equipment.bar + (equipment.maxLoad ?? Infinity));
	const limitCap = totalCap(equipment);
	const overMax = target > equipmentCap + 1e-9 && equipmentCap <= limitCap;
	const overLimit = target > limitCap + 1e-9 && limitCap < equipmentCap;
	const loadable = Math.min(target, equipmentCap, limitCap);
	const perSideWeight = (loadable - empty) / (equipment.count * equipment.sides);
	let maxUnits = Math.max(0, Math.floor(perSideWeight / UNIT + 1e-9));
	const implementsSides = equipment.count * equipment.sides;
	// Each usable size with how many can go on one side.
	const usable = Object.keys(inventory)
		.map(Number)
		.filter((plate) => Math.round(plate / UNIT) > 0 && fits(equipment, plate))
		.map((plate) => ({
			plate,
			size: Math.round(plate / UNIT),
			max: Math.floor(owned(inventory, plate) / implementsSides)
		}))
		.filter((p) => p.max > 0)
		.sort((a, b) => b.size - a.size);
	const result = (perSide: PlateCounts, total: number): TargetResult => ({
		perSide,
		total,
		exact: Math.abs(total - target) < 1e-9,
		...(overMax ? { overMax } : {}),
		...(overLimit ? { overLimit } : {})
	});
	// Nothing to load: the bar alone is the only option (and the search below would be unbounded).
	if (!usable.length) return result({}, empty);

	const limit = equipment.maxPlatesPerSide;
	if (limit !== undefined) maxUnits = Math.min(maxUnits, limit * usable[0].size);
	const finite = usable.filter((p) => p.max !== Infinity);
	const finiteUnits = finite.reduce((sum, p) => sum + p.max * p.size, 0);
	const largest = usable.find((p) => p.max === Infinity);
	if (!largest) maxUnits = Math.min(maxUnits, finiteUnits);

	// Largest unlimited plates that every closest-under load is sure to contain (see above).
	let fixed = 0;
	if (largest && limit === undefined) {
		const L = largest.size;
		const others = usable.filter((p) => p.max === Infinity && p !== largest);
		const spare = finiteUnits + (L - 1) * others.reduce((sum, p) => sum + p.size, 0);
		fixed = Math.max(0, Math.floor((maxUnits - L - spare) / L));
	}
	const windowUnits = maxUnits - fixed * (largest?.size ?? 0);

	// Fewest plates for every reachable amount in the window, one size at a time, smallest first
	// so heavier plates win ties (25 + 15 rather than 20 + 20); `used[i][u]` is how many of
	// `rows[i]` the best way to reach u (with rows 0..i) uses.
	const rows = usable.toReversed();
	let best = new Array<number>(windowUnits + 1).fill(Infinity);
	best[0] = 0;
	const used: Uint16Array[] = [];
	for (const { size, max } of rows) {
		const next = best.slice();
		const n = new Uint16Array(windowUnits + 1);
		for (let u = size; u <= windowUnits; u++) {
			if (max === Infinity) {
				// Unbounded: build on this size's own row.
				if (next[u - size] + 1 <= next[u]) {
					next[u] = next[u - size] + 1;
					n[u] = n[u - size] + 1;
				}
			} else {
				for (let k = 1; k <= max && k * size <= u; k++) {
					if (best[u - k * size] + k <= next[u]) {
						next[u] = best[u - k * size] + k;
						n[u] = k;
					}
				}
			}
		}
		best = next;
		used.push(n);
	}

	// The heaviest amount reachable with few enough plates (fewest plates is what limits it).
	let units = windowUnits;
	while (units > 0 && (best[units] === Infinity || best[units] > (limit ?? Infinity))) units--;
	const perSide: PlateCounts = {};
	if (fixed && largest) perSide[largest.plate] = fixed;
	for (let i = rows.length - 1, left = units; i >= 0 && left > 0; i--) {
		const k = used[i][left];
		if (!k) continue;
		perSide[rows[i].plate] = (perSide[rows[i].plate] ?? 0) + k;
		left -= k * rows[i].size;
	}
	const loadedUnits = units + fixed * (largest?.size ?? 0);
	return result(perSide, equipment.count * (equipment.bar + equipment.sides * loadedUnits * UNIT));
}

/**
 * Whether one more `plate` can go on: on `side`, or on both when `both` (same plates on both
 * sides, or a kettlebell's one post). `sides` are the plates loaded now, one count per side.
 */
export function canAdd(
	equipment: Equipment,
	sides: PlateCounts[],
	side: number,
	plate: number,
	both: boolean,
	inventory: PlateInventory
): boolean {
	if (!fits(equipment, plate)) return false;
	const changed = both ? [0, 1] : [side];
	const next = sides.map((s, i) =>
		changed.includes(i) ? { ...s, [plate]: (s[plate] ?? 0) + 1 } : s
	);
	if (platesUsed(equipment, next, plate) > owned(inventory, plate)) return false;
	const limit = equipment.maxPlatesPerSide;
	if (
		limit !== undefined &&
		changed.some((i) => i < equipment.sides && plateCount(next[i]) > limit)
	)
		return false;
	if (totalWeight(equipment, next) > totalCap(equipment) + 1e-9) return false;
	return implementWeight(equipment, next) - equipment.bar <= (equipment.maxLoad ?? Infinity) + 1e-9;
}

/** What's wrong with a load on this equipment (e.g. plates saved before you changed its set). */
export function loadProblems(
	equipment: Equipment,
	sides: PlateCounts[],
	unit: WeightUnit,
	inventory: PlateInventory
): string[] {
	const used = sides.slice(0, equipment.sides);
	const problems: string[] = [];
	const loaded = UNITS[unit].plates.filter((plate) => used.some((s) => (s[plate] ?? 0) > 0));
	const misfits = loaded.filter((plate) => !fits(equipment, plate));
	if (misfits.length)
		problems.push(
			`${misfits.map((p) => formatWeight(p, unit)).join(', ')} plates don't fit this ${kind(equipment)}.`
		);
	for (const plate of loaded) {
		const have = owned(inventory, plate);
		if (platesUsed(equipment, sides, plate) > have)
			problems.push(
				have
					? `You have ${have} × ${formatWeight(plate, unit)} ${have === 1 ? 'plate' : 'plates'}.`
					: `You have no ${formatWeight(plate, unit)} plates.`
			);
	}
	const limit = equipment.maxPlatesPerSide;
	if (limit !== undefined && used.some((s) => plateCount(s) > limit))
		problems.push(
			`More than ${limit} ${limit === 1 ? 'plate' : 'plates'} ${equipment.sides === 1 ? 'on the post' : 'on a side'}.`
		);
	const max = equipment.maxLoad;
	if (max !== undefined && implementWeight(equipment, sides) - equipment.bar > max + 1e-9)
		problems.push(
			`Over the ${formatWeight(max, unit)} max load${equipment.count === 2 ? ' per dumbbell' : ''}.`
		);
	if (totalWeight(equipment, sides) > totalCap(equipment) + 1e-9)
		problems.push(`Over the calculator's ${formatWeight(equipment.maxTotal ?? 0, unit)} limit.`);
	return problems;
}

/** Formats a weight without trailing zeros: "52.5 lb", "135 lb", "1.25 kg". */
export function formatWeight(weight: number, unit: WeightUnit): string {
	return `${Number(weight.toFixed(2))} ${unit}`;
}

export type WorkoutSet = { id: number; weight: number | null; reps: number | null };
export type Exercise = { id: number; name: string; sets: WorkoutSet[] };
/** A workout's weights are in the unit it was logged in (switching the calculator doesn't relabel them). */
export type Workout = { date: string; unit: WeightUnit; exercises: Exercise[] };

/** Plain-text workout for pasting into notes; identical consecutive sets are grouped. */
export function workoutToText(workout: Workout): string {
	const { unit } = workout;
	const lines = [`Workout – ${workout.date}`];
	for (const exercise of workout.exercises) {
		const sets = exercise.sets.filter((s) => s.reps || s.weight);
		if (!exercise.name.trim() && sets.length === 0) continue;
		lines.push('', exercise.name.trim() || 'Exercise');
		for (let i = 0; i < sets.length; ) {
			let n = 1;
			while (
				i + n < sets.length &&
				sets[i + n].reps === sets[i].reps &&
				sets[i + n].weight === sets[i].weight
			)
				n++;
			const { reps, weight } = sets[i];
			const parts = [`${n} ${n === 1 ? 'set' : 'sets'}`];
			if (reps) parts.push(`${reps} ${reps === 1 ? 'rep' : 'reps'}`);
			lines.push(`  ${parts.join(' × ')}${weight ? ` @ ${formatWeight(weight, unit)}` : ''}`);
			i += n;
		}
	}
	return lines.join('\n');
}

/** True once anything worth keeping was entered (an exercise name, weight or reps). */
export function workoutHasContent(workout: Workout): boolean {
	return workout.exercises.some(
		(e) => e.name.trim() !== '' || e.sets.some((s) => s.weight || s.reps)
	);
}

/** One-line summary for lists, e.g. "Squat, Bench Press · 6 sets". */
export function workoutSummary(workout: Workout): string {
	const names = workout.exercises.map((e) => e.name.trim()).filter(Boolean);
	const sets = workout.exercises.reduce(
		(n, e) => n + e.sets.filter((s) => s.weight || s.reps).length,
		0
	);
	const what = names.length ? names.join(', ') : 'Workout';
	return `${what} · ${sets} ${sets === 1 ? 'set' : 'sets'}`;
}

/** A finished workout kept in the history. */
export type HistoryEntry = { id: number; finishedAt: string; workout: Workout };

/** All of the history as text, newest first, for pasting into notes. */
export function historyToText(history: HistoryEntry[]): string {
	return history.map((h) => workoutToText(h.workout)).join('\n\n');
}
