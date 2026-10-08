export type WeightUnit = 'lb' | 'kg';
export const WEIGHT_UNITS: WeightUnit[] = ['lb', 'kg'];

/** Plate counts keyed by plate weight (in the unit system's unit). */
export type PlateCounts = Partial<Record<number, number>>;

/** Stable ids, the same in both unit systems (saved in storage and settings). */
export const EQUIPMENT_IDS = [
	'barbell',
	'barbell-light',
	'dumbbell',
	'dumbbells',
	'kettlebell'
] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export type Equipment = {
	id: EquipmentId;
	name: string;
	/** Weight of one bar or handle. */
	bar: number;
	/** 2 for bars and dumbbell handles (plates on both ends), 1 for a kettlebell post. */
	sides: 1 | 2;
	/** How many identical implements (a pair of dumbbells is 2). */
	count: 1 | 2;
	/** Heaviest one implement may weigh, bar included (none: no limit). */
	maxLoad?: number;
	/** Plate sizes that fit (none: every size). */
	plates?: readonly number[];
	/** Most plates on one side, or on a kettlebell's post (none: no limit). */
	maxPlatesPerSide?: number;
};

/**
 * Your own version of a station (#71): what's set replaces the commercial-gym default, what's
 * left out keeps it. Saved per unit in settings.
 */
export type EquipmentSetup = Pick<Equipment, 'maxLoad' | 'maxPlatesPerSide'> & {
	bar?: number;
	plates?: number[];
};
export type EquipmentSetups = Record<WeightUnit, Partial<Record<EquipmentId, EquipmentSetup>>>;

export type UnitSystem = {
	unit: WeightUnit;
	/** Plate sizes, heaviest first. */
	plates: readonly number[];
	equipment: Equipment[];
};

const barbellName = (bar: number, unit: WeightUnit) => `Barbell (${bar} ${unit})`;

const equipment = (
	unit: WeightUnit,
	bar: number,
	lightBar: number,
	handle: number,
	kettlebell: number
) =>
	[
		{ id: 'barbell', name: barbellName(bar, unit), bar, sides: 2, count: 1 },
		{
			id: 'barbell-light',
			name: barbellName(lightBar, unit),
			bar: lightBar,
			sides: 2,
			count: 1
		},
		{ id: 'dumbbell', name: 'Dumbbell', bar: handle, sides: 2, count: 1 },
		{ id: 'dumbbells', name: 'Dumbbell pair', bar: handle, sides: 2, count: 2 },
		{ id: 'kettlebell', name: 'Kettlebell', bar: kettlebell, sides: 1, count: 1 }
	] satisfies Equipment[];

export const UNITS: Record<WeightUnit, UnitSystem> = {
	lb: {
		unit: 'lb',
		plates: [45, 35, 25, 10, 5, 2.5, 1.25],
		equipment: equipment('lb', 45, 25, 7.5, 5)
	},
	// Olympic 20/15 kg bars; 2.5 kg is a common adjustable dumbbell and kettlebell handle.
	kg: {
		unit: 'kg',
		plates: [25, 20, 15, 10, 5, 2.5, 1.25],
		equipment: equipment('kg', 20, 15, 2.5, 2.5)
	}
};

/** Bounds for a setup's numbers, checked when saving and when loading settings. */
export const SETUP_LIMITS = { maxWeight: 2000, maxPlatesPerSide: 30 };

const isWeight = (v: unknown): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= SETUP_LIMITS.maxWeight;

/**
 * A valid setup from saved data, or undefined when nothing in it is usable. Bad fields are
 * dropped, so they fall back to the default; so is a max weight below the bar's weight.
 */
export function parseEquipmentSetup(
	unit: WeightUnit,
	id: EquipmentId,
	v: unknown
): EquipmentSetup | undefined {
	if (typeof v !== 'object' || v === null) return undefined;
	const r = v as Record<string, unknown>;
	const out: EquipmentSetup = {};
	if (isWeight(r.bar)) out.bar = r.bar;
	const bar = out.bar ?? builtIn(unit, id).bar;
	if (isWeight(r.maxLoad) && r.maxLoad >= bar) out.maxLoad = r.maxLoad;
	const n = r.maxPlatesPerSide;
	if (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= SETUP_LIMITS.maxPlatesPerSide)
		out.maxPlatesPerSide = n as number;
	const sizes = UNITS[unit].plates;
	const plates = r.plates;
	if (Array.isArray(plates) && plates.every((p) => sizes.includes(p)))
		if (plates.length < sizes.length)
			// Every size fitting is the default; keep the list only when it leaves something out.
			out.plates = sizes.filter((p) => plates.includes(p));
	return Object.keys(out).length ? out : undefined;
}

const builtIn = (unit: WeightUnit, id: string): Equipment => {
	const list = UNITS[unit].equipment;
	return list.find((e) => e.id === id) ?? list[0];
};

/** A station as you've set it up (or the commercial-gym default when it has no setup). */
export function findEquipment(
	unit: WeightUnit,
	id: string,
	setups?: Partial<EquipmentSetups>
): Equipment {
	const base = builtIn(unit, id);
	const setup = setups?.[unit]?.[base.id];
	if (!setup) return base;
	const bar = setup.bar ?? base.bar;
	return {
		...base,
		...setup,
		bar,
		name: base.id.startsWith('barbell') ? barbellName(bar, unit) : base.name
	};
}

/** Every station in a unit, with your setups applied. */
export function equipmentList(unit: WeightUnit, setups?: Partial<EquipmentSetups>): Equipment[] {
	return UNITS[unit].equipment.map((e) => findEquipment(unit, e.id, setups));
}

/** "bar", "dumbbell" or "kettlebell", for messages. */
export const kind = (equipment: Equipment) =>
	equipment.sides === 1 ? 'kettlebell' : equipment.id.startsWith('barbell') ? 'bar' : 'dumbbell';

export const fits = (equipment: Equipment, plate: number) =>
	!equipment.plates || equipment.plates.includes(plate);

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

export type TargetResult = {
	/** Plates for one side (repeat on each side and on each implement). */
	perSide: PlateCounts;
	/** Total weight actually loaded with those plates. */
	total: number;
	/** True when `total` equals the target. */
	exact: boolean;
	/** Set when the target is over the equipment's max weight (so the result stops there). */
	overMax?: true;
};

const UNIT = 1.25; // Smallest plate in both systems; every loadable weight is a multiple of it.

/**
 * Fewest plates per side to reach `target` total (or the closest weight under it), using only
 * plates that are available and fit the equipment, within its max weight and plates per side.
 * Returns null when the target is lighter than the empty bar(s), or isn't a finite number.
 *
 * Coin change over 1.25 lb/kg units, bounded so any target costs the same small amount of work
 * (a huge typo used to freeze the page, #32). In a fewest-plates load you never need L or more of
 * a smaller plate (where L is the largest plate in units): L of them weigh as much as fewer of the
 * largest. So the smaller plates add at most `spare` units, and everything above that window is
 * plain largest plates; the DP only covers the window. With a plate limit there's no such
 * shortcut, but the limit itself bounds the search (at most that many of the largest plate).
 */
export function platesForTarget(
	equipment: Equipment,
	target: number,
	available: readonly number[]
): TargetResult | null {
	const empty = equipment.count * equipment.bar;
	if (!Number.isFinite(target) || !(target >= empty)) return null;
	const cap = equipment.count * (equipment.maxLoad ?? Infinity);
	const overMax = target > cap + 1e-9;
	const loadable = Math.min(target, cap);
	const perSideWeight = (loadable - empty) / (equipment.count * equipment.sides);
	let maxUnits = Math.max(0, Math.floor(perSideWeight / UNIT + 1e-9));
	const plates = available
		.filter((plate) => Math.round(plate / UNIT) > 0 && fits(equipment, plate))
		.sort((a, b) => b - a);
	const result = (perSide: PlateCounts, total: number): TargetResult => ({
		perSide,
		total,
		exact: Math.abs(total - target) < 1e-9,
		...(overMax ? { overMax } : {})
	});
	// Nothing to load: the bar alone is the only option (and the search below would be unbounded).
	if (!plates.length) return result({}, empty);
	const sizes = plates.map((plate) => Math.round(plate / UNIT));
	const largest = sizes[0];
	const limit = equipment.maxPlatesPerSide;
	if (limit !== undefined) maxUnits = Math.min(maxUnits, limit * largest);

	// Largest plates that every closest-under load is sure to contain (see above).
	const spare = (largest - 1) * sizes.slice(1).reduce((sum, size) => sum + size, 0);
	const fixed =
		limit === undefined ? Math.max(0, Math.floor((maxUnits - largest - spare) / largest)) : 0;
	const windowUnits = maxUnits - fixed * largest;

	// Fewest plates for every reachable amount in the window.
	const best = new Array<number>(windowUnits + 1).fill(Infinity);
	const pick = new Array<number>(windowUnits + 1).fill(0);
	best[0] = 0;
	for (let units = 1; units <= windowUnits; units++) {
		for (let i = 0; i < plates.length; i++) {
			const size = sizes[i];
			if (size <= units && best[units - size] + 1 < best[units]) {
				best[units] = best[units - size] + 1;
				pick[units] = plates[i];
			}
		}
	}

	// The heaviest amount reachable with few enough plates (fewest plates is what limits it).
	let units = windowUnits;
	while (units > 0 && (best[units] === Infinity || best[units] > (limit ?? Infinity))) units--;
	const perSide: PlateCounts = {};
	if (fixed) perSide[plates[0]] = fixed;
	for (let left = units; left > 0; left -= Math.round(pick[left] / UNIT)) {
		const plate = pick[left];
		perSide[plate] = (perSide[plate] ?? 0) + 1;
	}
	const loadedUnits = units + fixed * largest;
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
	both: boolean
): boolean {
	if (!fits(equipment, plate)) return false;
	const changed = both ? [0, 1] : [side];
	const next = sides.map((s, i) =>
		changed.includes(i) ? { ...s, [plate]: (s[plate] ?? 0) + 1 } : s
	);
	const limit = equipment.maxPlatesPerSide;
	if (
		limit !== undefined &&
		changed.some((i) => i < equipment.sides && plateCount(next[i]) > limit)
	)
		return false;
	return implementWeight(equipment, next) <= (equipment.maxLoad ?? Infinity) + 1e-9;
}

/** What's wrong with a load on this equipment (e.g. plates saved before you changed its setup). */
export function loadProblems(
	equipment: Equipment,
	sides: PlateCounts[],
	unit: WeightUnit
): string[] {
	const used = sides.slice(0, equipment.sides);
	const problems: string[] = [];
	const misfits = UNITS[unit].plates.filter(
		(plate) => !fits(equipment, plate) && used.some((s) => (s[plate] ?? 0) > 0)
	);
	if (misfits.length)
		problems.push(
			`${misfits.map((p) => formatWeight(p, unit)).join(', ')} plates don't fit this ${kind(equipment)}.`
		);
	const limit = equipment.maxPlatesPerSide;
	if (limit !== undefined && used.some((s) => plateCount(s) > limit))
		problems.push(
			`More than ${limit} ${limit === 1 ? 'plate' : 'plates'} ${equipment.sides === 1 ? 'on the post' : 'on a side'}.`
		);
	const max = equipment.maxLoad;
	if (max !== undefined && implementWeight(equipment, sides) > max + 1e-9)
		problems.push(
			`Over the ${formatWeight(max, unit)} max${equipment.count === 2 ? ' per dumbbell' : ''}.`
		);
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
