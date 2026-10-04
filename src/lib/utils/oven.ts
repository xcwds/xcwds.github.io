/**
 * Cook time at a different oven temperature.
 *
 * Newton's law of heating: food starting at `start` in an oven at `oven` reaches `done` after a
 * time proportional to ln((oven − start) / (oven − done)). The constant (size, shape, pan) is
 * the same at both temperatures, so it cancels out of the ratio. It's an estimate: surface
 * browning, moisture and texture don't follow it, which is why the UI says to check doneness.
 */

export type TempUnit = 'F' | 'C';
export const TEMP_UNITS: TempUnit[] = ['F', 'C'];

export const toF = (t: number, unit: TempUnit) => (unit === 'F' ? t : (t * 9) / 5 + 32);
export const fromF = (f: number, unit: TempUnit) => (unit === 'F' ? f : ((f - 32) * 5) / 9);

/** What's in the oven, as the core temperature it starts at and is done at (°F). */
export type FoodPreset = { id: string; name: string; startF: number; doneF: number };

export const FOOD_PRESETS = [
	{ id: 'meat', name: 'Meat & poultry, from the fridge', startF: 40, doneF: 165 },
	{ id: 'roast', name: 'Roast, cooked medium', startF: 40, doneF: 140 },
	{ id: 'baked', name: 'Baked goods (cakes, breads, cookies)', startF: 70, doneF: 205 },
	{ id: 'casserole', name: 'Casserole or reheating', startF: 40, doneF: 165 }
] as const satisfies readonly FoodPreset[];

export type FoodId = (typeof FOOD_PRESETS)[number]['id'];

export const foodPreset = (id: FoodId): FoodPreset => FOOD_PRESETS.find((p) => p.id === id)!;

export type OvenInput = {
	/** Oven temperature the recipe calls for, °F. */
	fromF: number;
	/** Oven temperature you're cooking at, °F. */
	toF: number;
	/** Recipe time, minutes. */
	minutes: number;
	startF: number;
	doneF: number;
};

/** Why there's no estimate, for an inline error; undefined when the input is usable. */
export function ovenProblem(input: OvenInput): string | undefined {
	const { fromF: a, toF: b, minutes, startF, doneF } = input;
	if (![a, b, minutes, startF, doneF].every(Number.isFinite)) return 'Enter every number.';
	if (minutes <= 0) return 'The recipe time must be more than 0.';
	if (startF >= doneF) return 'The food must start colder than it is when done.';
	if (a <= doneF || b <= doneF) return 'The oven must be hotter than the food is when done.';
	return undefined;
}

/** Estimated minutes at `toF`, or undefined when there's no answer (see ovenProblem). */
export function adjustOvenTime(input: OvenInput): number | undefined {
	if (ovenProblem(input)) return undefined;
	const k = (oven: number) => Math.log((oven - input.startF) / (oven - input.doneF));
	return (input.minutes * k(input.toF)) / k(input.fromF);
}

/** Rounds a temperature the way oven dials do: to 5°. */
export const roundTemp = (t: number) => Math.round(t / 5) * 5;

/** "350°F" or "175°C", rounded like an oven dial. */
export const formatTemp = (f: number, unit: TempUnit) => `${roundTemp(fromF(f, unit))}°${unit}`;

/** "45 min", "1 h", "1 h 10 min". */
export function formatMinutes(minutes: number): string {
	const m = Math.max(1, Math.round(minutes));
	const h = Math.floor(m / 60);
	const rest = m % 60;
	if (h === 0) return `${rest} min`;
	return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** A time as a [min, max] range. */
export const asRange = (m: number | readonly [number, number]): [number, number] =>
	typeof m === 'number' ? [m, m] : [m[0], m[1]];

/** A time or time range: "9–11 min", "1 h 10 min – 1 h 20 min". */
export function formatMinutesRange(range: readonly [number, number]): string {
	const [lo, hi] = range.map((m) => Math.max(1, Math.round(m)));
	if (lo === hi) return formatMinutes(lo);
	if (lo < 60 && hi < 60) return `${lo}–${hi} min`;
	return `${formatMinutes(lo)} – ${formatMinutes(hi)}`;
}
