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

/** Warnings worth showing next to a usable result. */
export function microwaveWarnings(input: MicrowaveInput): string[] {
	if (microwaveProblem(input)) return [];
	const factor = (input.packageWatts * 100) / (input.yourWatts * input.level);
	return factor > RELIABLE_FACTOR || factor < 1 / RELIABLE_FACTOR
		? [
				'That’s a big change from the package, so the estimate is rough. Check early and add time in short bursts.'
			]
		: [];
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
