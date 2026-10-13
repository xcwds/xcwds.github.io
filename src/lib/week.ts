/**
 * Weeks in local time: which day they start on (Settings → Week starts on, or the locale's when
 * it's unset) and the week a moment falls in. Days are numbered like `Intl.Locale`'s week info:
 * 1 is Monday, 7 is Sunday.
 */

export type WeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const isWeekDay = (v: unknown): v is WeekDay =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7;

type WeekInfo = { firstDay?: number };
type LocaleWithWeek = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };

/**
 * The first day of the week where `locale` is (the browser's by default), or Monday when the
 * browser can't say (`Intl.Locale#getWeekInfo` isn't everywhere yet).
 */
export function localeWeekStart(locale?: string): WeekDay {
	try {
		const tag = locale ?? (typeof navigator === 'undefined' ? undefined : navigator.language);
		if (!tag) return 1;
		const loc = new Intl.Locale(tag) as LocaleWithWeek;
		const first = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
		return isWeekDay(first) ? first : 1;
	} catch {
		return 1;
	}
}

/** The week's first day: your setting, or the locale's when there's none. */
export const weekStartDay = (setting: WeekDay | null, locale?: string): WeekDay =>
	setting ?? localeWeekStart(locale);

/** Local midnight on the first day of the week `at` falls in (ms since the epoch). */
export function startOfWeek(at: number, first: WeekDay): number {
	const d = new Date(at);
	// `getDay()` is 0 for Sunday; week days here are 1–7 with Sunday as 7.
	const day = d.getDay() || 7;
	const back = (day - first + 7) % 7;
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

/** The week `weeks` before (negative) or after the one starting at `start`, by calendar days. */
export function shiftWeek(start: number, weeks: number): number {
	const d = new Date(start);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + weeks * 7).getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A week's key: its first day as `YYYY-MM-DD` (local). */
export function weekKey(start: number): string {
	const d = new Date(start);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const WEEK_DAYS: readonly { value: WeekDay; label: string }[] = [
	{ value: 1, label: 'Monday' },
	{ value: 6, label: 'Saturday' },
	{ value: 7, label: 'Sunday' }
];

export const dayName = (day: WeekDay): string =>
	['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day - 1]!;
