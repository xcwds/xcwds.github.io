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
};

export type UnitSystem = {
	unit: WeightUnit;
	/** Plate sizes, heaviest first. */
	plates: readonly number[];
	equipment: Equipment[];
};

const equipment = (
	unit: WeightUnit,
	bar: number,
	lightBar: number,
	handle: number,
	kettlebell: number
) =>
	[
		{ id: 'barbell', name: `Barbell (${bar} ${unit})`, bar, sides: 2, count: 1 },
		{
			id: 'barbell-light',
			name: `Barbell (${lightBar} ${unit})`,
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

export function findEquipment(unit: WeightUnit, id: string): Equipment {
	const list = UNITS[unit].equipment;
	return list.find((e) => e.id === id) ?? list[0];
}

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
};

const UNIT = 1.25; // Smallest plate in both systems; every loadable weight is a multiple of it.

/**
 * Fewest plates per side to reach `target` total (or the closest weight under it).
 * Returns null when the target is lighter than the empty bar(s).
 */
export function platesForTarget(
	equipment: Equipment,
	target: number,
	available: readonly number[]
): TargetResult | null {
	const empty = equipment.count * equipment.bar;
	if (!(target >= empty)) return null;
	const perSideWeight = (target - empty) / (equipment.count * equipment.sides);
	const maxUnits = Math.floor(perSideWeight / UNIT + 1e-9);
	const plates = [...available].sort((a, b) => b - a);

	// Coin change over 1.25 lb/kg units: fewest plates for every reachable amount up to maxUnits.
	const best = new Array<number>(maxUnits + 1).fill(Infinity);
	const pick = new Array<number>(maxUnits + 1).fill(0);
	best[0] = 0;
	for (let units = 1; units <= maxUnits; units++) {
		for (const plate of plates) {
			const size = plate / UNIT;
			if (size <= units && best[units - size] + 1 < best[units]) {
				best[units] = best[units - size] + 1;
				pick[units] = plate;
			}
		}
	}

	let units = maxUnits;
	while (units > 0 && best[units] === Infinity) units--;
	const perSide: PlateCounts = {};
	for (let left = units; left > 0; left -= pick[left] / UNIT) {
		const plate = pick[left];
		perSide[plate] = (perSide[plate] ?? 0) + 1;
	}
	const total = equipment.count * (equipment.bar + equipment.sides * units * UNIT);
	return { perSide, total, exact: Math.abs(total - target) < 1e-9 };
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
