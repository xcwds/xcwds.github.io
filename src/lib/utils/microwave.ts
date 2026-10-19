/**
 * Microwave time at a different wattage or power level (#229).
 *
 * A microwave heats food with roughly constant power, so the energy that reaches the food is
 * power × time. Lower power levels cycle the magnetron on and off, so 50% power delivers about
 * half the energy over the same time. Keeping the energy the same:
 * time = package time × package watts / (your watts × power level). It's an estimate: small
 * ovens heat less evenly and food heats faster at the edges, so the UI says to stir and check.
 */

/** Microwave wattages people can enter (the label on the door or inside it). */
export const WATTS = { min: 300, max: 2000, step: 50 };

/** A common wattage when you don't know yours (and what many packages are tested at). */
export const DEFAULT_WATTS = 1000;
/** What a package's time is for when it doesn't say: most say "1100 W" or "high". */
export const DEFAULT_PACKAGE_WATTS = 1100;

/** Power levels on a typical microwave, in percent. */
export const POWER_LEVELS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10] as const;

/** Beyond this factor either way, the estimate is rough: say so. */
export const RELIABLE_FACTOR = 2;

/** Results are rounded to this many seconds, like a microwave's keypad. */
const ROUND_SECONDS = 5;

export type MicrowaveInput = {
	/** The package or recipe time, seconds. */
	seconds: number;
	/** The wattage the time is for. */
	packageWatts: number;
	/** Your microwave's wattage. */
	yourWatts: number;
	/** The power level you'll use, percent (10–100). */
	level: number;
};

const inWatts = (w: number) => w >= WATTS.min && w <= WATTS.max;

/** Why there's no estimate, for an inline error; undefined when the input is usable. */
export function microwaveProblem(input: MicrowaveInput): string | undefined {
	const { seconds, packageWatts, yourWatts, level } = input;
	if (![seconds, packageWatts, yourWatts, level].every(Number.isFinite))
		return 'Enter every number.';
	if (seconds <= 0) return 'The package time must be more than 0.';
	if (!inWatts(packageWatts) || !inWatts(yourWatts))
		return `Wattage must be between ${WATTS.min} and ${WATTS.max} W.`;
	if (level <= 0 || level > 100) return 'Pick a power level.';
	return undefined;
}

/** The time at your wattage and power level, in whole seconds (rounded to 5), or undefined. */
export function microwaveTime(input: MicrowaveInput): number | undefined {
	if (microwaveProblem(input)) return undefined;
	const { seconds, packageWatts, yourWatts, level } = input;
	const exact = (seconds * packageWatts) / ((yourWatts * level) / 100);
	return Math.max(ROUND_SECONDS, Math.round(exact / ROUND_SECONDS) * ROUND_SECONDS);
}

/**
 * Warnings worth showing next to a usable result. `food`: the time is one of {@link FOODS}, for
 * a 1000 W microwave, not a package's.
 */
export function microwaveWarnings(input: MicrowaveInput, food = false): string[] {
	if (microwaveProblem(input)) return [];
	const factor = (input.packageWatts * 100) / (input.yourWatts * input.level);
	if (factor <= RELIABLE_FACTOR && factor >= 1 / RELIABLE_FACTOR) return [];
	return [
		food
			? `These times are for a ${FOOD_WATTS} W microwave, so the estimate is rough this far from it. Check early and add time in short bursts.`
			: 'That’s a big change from the package, so the estimate is rough. Check early and add time in short bursts.'
	];
}

/** `m:ss` (or `h:mm:ss` past an hour), as a microwave's display shows it. */
export function formatClock(seconds: number): string {
	const s = Math.round(seconds);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Settings and saved data: a whole wattage in range, or undefined. */
export const parseWatts = (v: unknown): number | undefined =>
	typeof v === 'number' && Number.isInteger(v) && inWatts(v) ? v : undefined;

/**
 * Starting times by food, for when there's no package (#229). Times are at {@link FOOD_WATTS}
 * for one of the food's units, at the power level given; they're cautious starting points, since
 * an underdone dish only needs another burst. More food takes longer, but less than in
 * proportion (the outside heats while the inside catches up): `scale` is the exponent on the
 * amount, so 0.8 makes two cups take about 1.75× as long.
 */
export const FOOD_WATTS = 1000;

export type FoodState = {
	id: string;
	label: string;
	/** Seconds for one unit at `FOOD_WATTS` and `level`. */
	seconds: number;
	/** Power level, percent. */
	level: number;
	tip: string;
};

export type Food = {
	id: string;
	name: string;
	unit: { one: string; other: string; note?: string };
	/** The most units the estimate holds for (bigger batches heat too unevenly). */
	max: number;
	scale: number;
	states: FoodState[];
	/** Leftovers: it has to be steaming hot all the way through. */
	reheat?: boolean;
};

const fridge = (seconds: number, level: number, tip: string): FoodState => ({
	id: 'fridge',
	label: 'From the fridge',
	seconds,
	level,
	tip
});
const frozen = (seconds: number, level: number, tip: string): FoodState => ({
	id: 'frozen',
	label: 'Frozen',
	seconds,
	level,
	tip
});
const raw = (seconds: number, level: number, tip: string): FoodState => ({
	id: 'raw',
	label: 'Raw',
	seconds,
	level,
	tip
});

export const FOODS: Food[] = [
	{
		id: 'soup',
		name: 'Soup or stew',
		unit: { one: 'cup', other: 'cups', note: '240 ml' },
		max: 6,
		scale: 0.8,
		reheat: true,
		states: [
			fridge(90, 100, 'Cover loosely and stir halfway.'),
			frozen(300, 50, 'Break it up and stir as it thaws, then heat on high until it bubbles.')
		]
	},
	{
		id: 'rice',
		name: 'Rice or pasta, cooked',
		unit: { one: 'cup', other: 'cups', note: '240 ml' },
		max: 4,
		scale: 0.8,
		reheat: true,
		states: [
			fridge(60, 100, 'Sprinkle with a little water and cover, so it steams.'),
			frozen(150, 100, 'Sprinkle with a little water, cover, and stir halfway.')
		]
	},
	{
		id: 'plate',
		name: 'Plate of leftovers',
		unit: { one: 'plate', other: 'plates' },
		max: 1,
		scale: 1,
		reheat: true,
		states: [
			fridge(150, 70, 'Spread it out with thick pieces at the edge, and cover.'),
			frozen(330, 50, 'Spread it out with thick pieces at the edge, cover, and stir halfway.')
		]
	},
	{
		id: 'vegetables',
		name: 'Vegetables',
		unit: { one: 'cup', other: 'cups', note: '240 ml' },
		max: 4,
		scale: 0.8,
		states: [
			raw(150, 100, 'Add 2 tablespoons of water and cover, so they steam, until just tender.'),
			frozen(180, 100, 'Add 2 tablespoons of water, cover, and stir halfway.')
		]
	},
	{
		id: 'potato',
		name: 'Potato, whole',
		unit: { one: 'medium potato', other: 'medium potatoes', note: 'about 200 g each' },
		max: 4,
		scale: 0.7,
		states: [
			raw(
				300,
				100,
				'Prick it all over with a fork and turn it halfway. Done when a knife slides in easily.'
			)
		]
	},
	{
		id: 'eggs',
		name: 'Scrambled eggs',
		unit: { one: 'egg', other: 'eggs' },
		max: 4,
		scale: 0.75,
		states: [
			raw(
				45,
				100,
				'Beat with a splash of milk in a greased mug; stir every 30 seconds until just set, with no runny egg left.'
			)
		]
	},
	{
		id: 'bacon',
		name: 'Bacon',
		unit: { one: 'slice', other: 'slices' },
		max: 6,
		scale: 0.9,
		states: [
			raw(
				50,
				100,
				'Lay it flat between paper towels on a plate. Cook until crisp, adding 15 seconds at a time.'
			)
		]
	},
	{
		id: 'pizza',
		name: 'Pizza',
		unit: { one: 'slice', other: 'slices' },
		max: 3,
		scale: 0.8,
		reheat: true,
		states: [fridge(45, 100, 'Put a mug of water in beside it, so the crust stays soft.')]
	},
	{
		id: 'oatmeal',
		name: 'Oatmeal',
		unit: { one: 'serving', other: 'servings', note: '½ cup oats, 1 cup water' },
		max: 2,
		scale: 0.8,
		states: [
			{
				id: 'dry',
				label: 'Oats and water',
				seconds: 150,
				level: 100,
				tip: 'Use a big bowl so it doesn’t boil over, and stir halfway.'
			}
		]
	},
	{
		id: 'water',
		name: 'Water for tea',
		unit: { one: 'mug', other: 'mugs', note: '240 ml' },
		max: 2,
		scale: 0.9,
		states: [
			{
				id: 'cold',
				label: 'From the tap',
				seconds: 120,
				level: 100,
				tip: 'Water can boil up suddenly when you move it: let it stand 30 seconds first.'
			}
		]
	},
	{
		id: 'coffee',
		name: 'Coffee or tea, gone cold',
		unit: { one: 'mug', other: 'mugs', note: '240 ml' },
		max: 2,
		scale: 0.9,
		states: [
			{
				id: 'cold',
				label: 'Gone cold',
				seconds: 60,
				level: 100,
				tip: 'Let it stand 30 seconds before you take it out.'
			}
		]
	},
	{
		id: 'butter',
		name: 'Butter, melted',
		unit: { one: 'stick', other: 'sticks', note: '113 g' },
		max: 2,
		scale: 0.8,
		states: [fridge(60, 50, 'Cut it up and cover, so it doesn’t spatter.')]
	}
];

export type FoodInput = { food: Food; state: FoodState; amount: number; yourWatts: number };

/** As a package time: the food's time for this amount, at `FOOD_WATTS` and the state's level. */
export function foodPackage({ food, state, amount, yourWatts }: FoodInput): MicrowaveInput {
	const units = Number.isFinite(amount) ? Math.min(food.max, Math.max(1, amount)) : 1;
	return {
		seconds: state.seconds * units ** food.scale,
		// Your microwave at the same power level gets the same share of its own wattage.
		packageWatts: FOOD_WATTS,
		yourWatts,
		level: 100
	};
}

/** The time for this food in your microwave, at the state's power level, or undefined. */
export const foodTime = (input: FoodInput) => microwaveTime(foodPackage(input));
