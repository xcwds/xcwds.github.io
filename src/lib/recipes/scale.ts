/** Scaling ingredient quantities to a servings target, and printing them like a cookbook. */

import { toSystem, type AltMeasure, type UnitSystem } from './units';

/** A quantity, or a range like "2–3". */
export type Amount = number | readonly [number, number];

export type ScalableIngredient = {
	amount: Amount;
	/** Singular: "cup", "Tbsp", "g", "clove". Omit for counts ("2 eggs"). */
	unit?: string;
	/** Singular when there's no unit and the amount is 1 ("egg"), otherwise as written. */
	item: string;
	/** Plural of `item`, for counts ("eggs"). */
	plural?: string;
	/** Shown after the item: "softened", "spooned and leveled". */
	note?: string;
	/**
	 * The same amount in the other unit system, as the recipe gives it ("2 ¼ cups (281 g)"), for
	 * the low end of a range. Used instead of a unit conversion when showing the other system.
	 */
	alt?: AltMeasure;
};

/** A string is shown as is and never scaled ("Salt and pepper, to taste"). */
export type Ingredient = string | ScalableIngredient;

/** What a recipe makes, as written: `{ amount: 24, unit: "cookies", singular: "cookie" }`. */
export type RecipeYield = {
	amount: number;
	/** Plural: "servings", "loaves". */
	unit: string;
	/** For a yield of 1: "serving", "loaf". */
	singular: string;
	/** Stepper increment for the servings target (default 1). */
	step?: number;
};

const UNIT_PLURALS: Record<string, string> = {
	cup: 'cups',
	clove: 'cloves',
	can: 'cans',
	stick: 'sticks',
	slice: 'slices',
	pinch: 'pinches',
	sprig: 'sprigs',
	head: 'heads',
	lb: 'lb',
	oz: 'oz',
	Tbsp: 'Tbsp',
	tsp: 'tsp'
};

/** Units measured on a scale or in metric, shown as decimals instead of kitchen fractions. */
const DECIMAL_UNITS = new Set(['g', 'kg', 'ml', 'l', 'oz']);

const FRACTIONS: [number, string][] = [
	[0, ''],
	[1 / 8, '⅛'],
	[1 / 4, '¼'],
	[1 / 3, '⅓'],
	[3 / 8, '⅜'],
	[1 / 2, '½'],
	[5 / 8, '⅝'],
	[2 / 3, '⅔'],
	[3 / 4, '¾'],
	[7 / 8, '⅞'],
	[1, '']
];

/** 1.5 → "1 ½", 0.33 → "⅓", 2 → "2". Tiny amounts keep two decimals rather than becoming 0. */
export function formatFraction(n: number): string {
	if (n <= 0) return '0';
	// Inclusive: at exactly 1/16 the nearest fraction ties between 0 and ⅛, and 0 would win (#69).
	if (n <= 1 / 16) return String(Math.round(n * 100) / 100 || 0.01);
	let whole = Math.floor(n);
	const rest = n - whole;
	let best = FRACTIONS[0];
	for (const f of FRACTIONS) if (Math.abs(rest - f[0]) < Math.abs(rest - best[0])) best = f;
	if (best[0] === 1) whole += 1;
	if (!best[1]) return String(whole);
	return whole === 0 ? best[1] : `${whole} ${best[1]}`;
}

/** Grams and millilitres: whole numbers, one decimal below 10. */
export function formatDecimal(n: number): string {
	return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

const formatNumber = (n: number, unit?: string) =>
	unit && DECIMAL_UNITS.has(unit) ? formatDecimal(n) : formatFraction(n);

/** Multiplies an amount by the scale factor. */
export function scaleAmount(amount: Amount, factor: number): Amount {
	return typeof amount === 'number' ? amount * factor : [amount[0] * factor, amount[1] * factor];
}

/** The quantity part, e.g. "1 ½ cups" or "2–3"; the rest, e.g. "flour, spooned and leveled". */
export type FormattedIngredient = { quantity: string; text: string };

/** Formats an ingredient scaled by `factor`, in `system` if given (otherwise as written). */
export function formatIngredient(
	ingredient: Ingredient,
	factor = 1,
	system?: UnitSystem
): FormattedIngredient {
	if (typeof ingredient === 'string') return { quantity: '', text: ingredient };
	const amount = scaleAmount(ingredient.amount, factor);
	let [lo, hi] = typeof amount === 'number' ? [amount, amount] : amount;
	let { unit } = ingredient;
	if (system) {
		const written = ingredient.amount;
		const writtenLow = typeof written === 'number' ? written : written[0];
		({ lo, hi, unit } = toSystem({ lo, hi, unit }, system, ingredient.alt, writtenLow));
	}
	const top = formatNumber(hi, unit);
	let quantity = lo === hi ? top : `${formatNumber(lo, unit)}–${top}`;
	// "1 cup", "½ cup", "½–1 cup" but "1 ½ cups"; judged by what's printed, so 0.99 shown as
	// "1" stays singular.
	const plural = top !== '1' && !/^(⅛|¼|⅓|⅜|½|⅝|⅔|¾|⅞)$/.test(top);
	if (unit) quantity += ` ${plural ? (UNIT_PLURALS[unit] ?? unit) : unit}`;
	const item = !unit && plural && ingredient.plural ? ingredient.plural : ingredient.item;
	return { quantity, text: ingredient.note ? `${item}, ${ingredient.note}` : item };
}

export const isScalable = (ingredient: Ingredient): ingredient is ScalableIngredient =>
	typeof ingredient !== 'string';

/** "4 servings", "1 loaf", "36 cookies". */
export function formatYield(amount: number, y: Pick<RecipeYield, 'unit' | 'singular'>): string {
	const n = formatFraction(amount);
	return `${n} ${n === '1' ? y.singular : y.unit}`;
}
