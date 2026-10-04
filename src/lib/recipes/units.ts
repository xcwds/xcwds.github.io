/**
 * US ↔ metric for recipe ingredients. A recipe is written in one system; the page can show it in
 * the other. An ingredient's `alt` (the same amount in the other system, from the recipe itself,
 * e.g. 2 ¼ cups flour = 281 g) wins over unit conversion, since cups of flour have no fixed weight.
 * Spoons (tsp, Tbsp) and counts are used everywhere and stay as written.
 */

export type UnitSystem = 'us' | 'metric';
export const UNIT_SYSTEMS: UnitSystem[] = ['us', 'metric'];

/** The same quantity in the other system, for the ingredient's written amount (low end of a range). */
export type AltMeasure = { amount: number; unit: string };

const ML = { tsp: 4.92892, Tbsp: 14.7868, cup: 236.588, ml: 1, l: 1000 } as const;
const G = { oz: 28.3495, lb: 453.592, g: 1, kg: 1000 } as const;

const SYSTEM_OF: Record<string, UnitSystem> = {
	cup: 'us',
	oz: 'us',
	lb: 'us',
	g: 'metric',
	kg: 'metric',
	ml: 'metric',
	l: 'metric'
};

/** 'us' or 'metric' for system-specific units; undefined for spoons, counts and the like. */
export const systemOf = (unit: string | undefined): UnitSystem | undefined =>
	unit ? SYSTEM_OF[unit] : undefined;

/** The system a recipe is written in: whichever its measured ingredients mostly use (US on a tie). */
export function nativeSystem(units: (string | undefined)[]): UnitSystem {
	let metric = 0;
	let us = 0;
	for (const unit of units) {
		const system = systemOf(unit);
		if (system === 'metric') metric++;
		else if (system === 'us') us++;
	}
	return metric > us ? 'metric' : 'us';
}

export type Quantity = { lo: number; hi: number; unit: string | undefined };

/** Rounds converted grams and millilitres the way a recipe would print them. */
function tidyMetric(n: number): number {
	if (n >= 100) return Math.round(n / 5) * 5;
	if (n >= 10) return Math.round(n);
	return Math.round(n * 10) / 10;
}

/** Picks a readable unit for the size: 1500 g → 1.5 kg, 40 oz → 2 ½ lb (US recipes keep ounces under 2 lb). */
function normalize(q: Quantity, converted: boolean): Quantity {
	const { lo, hi, unit } = q;
	const scale = (to: string, by: number): Quantity => ({ lo: lo / by, hi: hi / by, unit: to });
	if (unit === 'g' && lo >= 1000) return scale('kg', 1000);
	if (unit === 'ml' && lo >= 1000) return scale('l', 1000);
	if (unit === 'oz' && lo >= 32) return scale('lb', 16);
	if (converted && (unit === 'g' || unit === 'ml'))
		return { lo: tidyMetric(lo), hi: tidyMetric(hi), unit };
	return q;
}

/** US volume for a number of millilitres: teaspoons, tablespoons or cups by size. */
function usVolume(ml: number): string {
	if (ml < ML.Tbsp) return 'tsp';
	if (ml < ML.cup / 4) return 'Tbsp';
	return 'cup';
}

/**
 * Converts a (scaled) quantity to `target`. `writtenLow` is the ingredient's unscaled low amount,
 * so `alt` (given for that amount) scales the same way.
 */
export function toSystem(
	q: Quantity,
	target: UnitSystem,
	alt: AltMeasure | undefined,
	writtenLow: number
): Quantity {
	const from = systemOf(q.unit);
	if (!from || from === target) return normalize(q, false);
	if (alt && systemOf(alt.unit) !== from) {
		const ratio = alt.amount / writtenLow;
		return normalize({ lo: q.lo * ratio, hi: q.hi * ratio, unit: alt.unit }, false);
	}
	const unit = q.unit!;
	if (unit in G) {
		const g = G[unit as keyof typeof G];
		const to = target === 'metric' ? 'g' : 'oz';
		const by = G[to];
		return normalize({ lo: (q.lo * g) / by, hi: (q.hi * g) / by, unit: to }, true);
	}
	const ml = ML[unit as keyof typeof ML];
	if (target === 'metric') return normalize({ lo: q.lo * ml, hi: q.hi * ml, unit: 'ml' }, true);
	const to = usVolume(q.lo * ml);
	const by = ML[to as keyof typeof ML];
	return { lo: (q.lo * ml) / by, hi: (q.hi * ml) / by, unit: to };
}
