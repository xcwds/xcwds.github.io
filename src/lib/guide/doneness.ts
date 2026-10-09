/**
 * Doneness temperatures for the cooking guide's chart (/guide/doneness-and-food-safety).
 *
 * Every temperature is the meat's internal temperature in °F, measured at the thickest part.
 * USDA FSIS safe minimums: https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart
 * Levels below the USDA minimum are common choices (a rare steak), so the chart shows them, but
 * flags them.
 */

import type { TempUnit } from '$lib/utils/oven';

export type DonenessLevel = {
	id: string;
	name: string;
	/** Internal temperature once rested, °F. */
	targetF: number;
	/** What it looks like, for when you cut into it. */
	looks: string;
	/** A tenderness target for tough cuts, cooked far past done; no carryover applies. */
	tender?: boolean;
};

export type Size = {
	id: string;
	name: string;
	/** How much the temperature keeps rising off the heat, °F. */
	carryoverF: number;
	/** Rest, minutes. */
	restMinutes: number;
};

export type Meat = {
	id: string;
	name: string;
	emoji: string;
	/** USDA FSIS safe minimum internal temperature, °F. */
	usdaF: number;
	/** The USDA wording that goes with the minimum. */
	usdaNote: string;
	/**
	 * Poultry and ground meat: take it off the heat at the target, not before, because the
	 * minimum must actually be reached (carryover can't be counted on in thin pieces and patties).
	 */
	noEarlyPull?: boolean;
	sizes: Size[];
	levels: DonenessLevel[];
};

const STEAK: Size = { id: 'steak', name: 'Steaks & chops', carryoverF: 5, restMinutes: 5 };
const ROAST: Size = { id: 'roast', name: 'Roasts', carryoverF: 10, restMinutes: 15 };

const WHOLE_CUT_USDA = '145°F (63°C), then rest at least 3 minutes.';

export const MEATS: Meat[] = [
	{
		id: 'beef',
		name: 'Beef & lamb',
		emoji: '🥩',
		usdaF: 145,
		usdaNote: WHOLE_CUT_USDA,
		sizes: [STEAK, ROAST],
		levels: [
			{ id: 'rare', name: 'Rare', targetF: 125, looks: 'Cool red center' },
			{ id: 'medium-rare', name: 'Medium-rare', targetF: 135, looks: 'Warm red-pink center' },
			{ id: 'medium', name: 'Medium', targetF: 145, looks: 'Pink center' },
			{ id: 'medium-well', name: 'Medium-well', targetF: 150, looks: 'Slightly pink center' },
			{ id: 'well-done', name: 'Well done', targetF: 160, looks: 'No pink' },
			{
				id: 'fall-apart',
				name: 'Fall-apart tender (braising cuts)',
				targetF: 200,
				looks: 'Shreds with a fork: chuck, brisket, short ribs, lamb shoulder',
				tender: true
			}
		]
	},
	{
		id: 'pork',
		name: 'Pork',
		emoji: '🐖',
		usdaF: 145,
		usdaNote: WHOLE_CUT_USDA,
		sizes: [STEAK, ROAST],
		levels: [
			{ id: 'medium', name: 'Medium', targetF: 145, looks: 'Juicy, with a blush of pink' },
			{ id: 'medium-well', name: 'Medium-well', targetF: 150, looks: 'Barely pink' },
			{ id: 'well-done', name: 'Well done', targetF: 160, looks: 'No pink; drier' },
			{
				id: 'fall-apart',
				name: 'Fall-apart tender (shoulder, ribs)',
				targetF: 200,
				looks: 'Shreds with a fork, for pulled pork and carnitas',
				tender: true
			}
		]
	},
	{
		id: 'poultry',
		name: 'Chicken & turkey',
		emoji: '🍗',
		usdaF: 165,
		usdaNote: '165°F (74°C) for all poultry: whole, parts and ground.',
		noEarlyPull: true,
		sizes: [
			{ id: 'pieces', name: 'Pieces', carryoverF: 5, restMinutes: 5 },
			{ id: 'whole', name: 'Whole bird', carryoverF: 10, restMinutes: 20 }
		],
		levels: [
			{
				id: 'breast',
				name: 'Breast (white meat)',
				targetF: 165,
				looks: 'Opaque, juices run clear'
			},
			{
				id: 'thigh',
				name: 'Thighs, legs & wings (dark meat)',
				targetF: 180,
				looks: 'Tender, pulls from the bone; safe at 165°F (74°C), better a little higher'
			}
		]
	},
	{
		id: 'ground',
		name: 'Ground meat',
		emoji: '🍔',
		usdaF: 160,
		usdaNote:
			'160°F (71°C) for ground beef, pork, veal and lamb; 165°F (74°C) for ground chicken and turkey.',
		noEarlyPull: true,
		sizes: [{ id: 'patties', name: 'Burgers, meatballs, meatloaf', carryoverF: 0, restMinutes: 0 }],
		levels: [
			{ id: 'beef-pork', name: 'Beef, pork, veal, lamb', targetF: 160, looks: 'No pink' },
			{ id: 'poultry', name: 'Chicken, turkey', targetF: 165, looks: 'No pink' }
		]
	},
	{
		id: 'fish',
		name: 'Fish',
		emoji: '🐟',
		usdaF: 145,
		usdaNote: '145°F (63°C), or until the flesh is opaque and flakes with a fork.',
		sizes: [{ id: 'fillets', name: 'Fillets & steaks', carryoverF: 5, restMinutes: 3 }],
		levels: [
			{
				id: 'medium-rare',
				name: 'Medium-rare (salmon, tuna)',
				targetF: 125,
				looks: 'Translucent center, just flaking'
			},
			{
				id: 'done',
				name: 'Cooked through',
				targetF: 145,
				looks: 'Opaque, flakes easily'
			}
		]
	}
];

export type Doneness = {
	targetF: number;
	/** Take it off the heat here; it rises to the target while it rests. */
	pullF: number;
	/**
	 * How far past the target it's likely to finish (°F): when it can't come off early (safety,
	 * poultry), it still rises while it rests.
	 */
	overshootF: number;
	restMinutes: number;
	/** The finished temperature is under the USDA safe minimum. */
	belowUsda: boolean;
};

export function doneness(meat: Meat, size: Size, level: DonenessLevel): Doneness {
	const early = meat.noEarlyPull || level.tender ? 0 : size.carryoverF;
	const belowUsda = level.targetF < meat.usdaF;
	// A safe level is taken off no lower than the USDA minimum: carryover varies too much to
	// count on for safety (a thin chop barely rises).
	const pullF = belowUsda
		? level.targetF - early
		: Math.max(level.targetF - early, Math.min(level.targetF, meat.usdaF));
	const rise = level.tender ? 0 : size.carryoverF;
	return {
		targetF: level.targetF,
		pullF,
		overshootF: Math.max(0, pullF + rise - level.targetF),
		restMinutes: size.restMinutes,
		belowUsda
	};
}

/**
 * An internal temperature in °F or °C, to the whole degree. Not oven-dial rounding (`formatTemp`
 * in oven.ts rounds to 5°), since 165°F is 74°C, not 75°C.
 */
export function formatInternal(f: number, unit: TempUnit): string {
	const value = unit === 'F' ? f : ((f - 32) * 5) / 9;
	return `${Math.round(value)}°${unit}`;
}

/** A temperature difference ("5°F", "3°C"): no 32° offset, unlike a temperature. */
export function formatRise(f: number, unit: TempUnit): string {
	return `${Math.round(unit === 'F' ? f : (f * 5) / 9)}°${unit}`;
}
