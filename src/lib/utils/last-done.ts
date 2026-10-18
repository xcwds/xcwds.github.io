/**
 * Last done (#218): things you do now and then (clean the bathroom, open a new bag of dog food),
 * when you last did each, and how often you usually do it. Pure types, validators and interval
 * maths; the page saves through `#lib/storage`.
 */

export type IntervalUnit = 'days' | 'weeks' | 'months';

export type Every = { n: number; unit: IntervalUnit };

export type LastDoneItem = {
	/** Random and stable: log rows point at it. */
	id: string;
	name: string;
	emoji?: string;
	/** How often you mean to do it, if you set a target. */
	every?: Every;
	notes?: string;
};

export type LastDoneEntry = {
	id: string;
	itemId: string;
	/** When it was done: an ISO timestamp from the wall clock. */
	at: string;
};

export const NAME_MAX = 40;
export const NOTES_MAX = 500;
export const EVERY_MAX = 999;
/** Long enough for any emoji sequence (flags, skin tones, ZWJ families), short enough to show. */
const EMOJI_MAX = 16;
export const UNITS: readonly { id: IntervalUnit; label: string }[] = [
	{ id: 'days', label: 'days' },
	{ id: 'weeks', label: 'weeks' },
	{ id: 'months', label: 'months' }
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** Why `name` can't be a thing's name, or undefined if it can. */
export function nameProblem(name: string): string | undefined {
	const trimmed = name.trim();
	if (!trimmed) return 'Give it a name.';
	if ([...trimmed].length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters.`;
	return undefined;
}

/** A trimmed emoji, or undefined when it's empty or too long to be one. */
export function cleanEmoji(emoji: string): string | undefined {
	const trimmed = emoji.trim();
	return trimmed && [...trimmed].length <= EMOJI_MAX ? trimmed : undefined;
}

export function parseEvery(v: unknown): Every | undefined {
	if (!isRecord(v)) return undefined;
	const { n, unit } = v;
	if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > EVERY_MAX) return undefined;
	if (!UNITS.some((u) => u.id === unit)) return undefined;
	return { n, unit: unit as IntervalUnit };
}

function parseItem(v: unknown): LastDoneItem | undefined {
	if (!isRecord(v)) return undefined;
	const { id, name, emoji, every, notes } = v;
	if (!isId(id) || typeof name !== 'string' || nameProblem(name) || name !== name.trim())
		return undefined;
	const item: LastDoneItem = { id, name };
	if (emoji !== undefined) {
		if (typeof emoji !== 'string' || cleanEmoji(emoji) !== emoji) return undefined;
		item.emoji = emoji;
	}
	if (every !== undefined) {
		const parsed = parseEvery(every);
		if (!parsed) return undefined;
		item.every = parsed;
	}
	if (notes !== undefined) {
		if (typeof notes !== 'string' || notes.length > NOTES_MAX) return undefined;
		item.notes = notes;
	}
	return item;
}

/** Saved things: malformed ones and repeated ids are dropped, not the whole list. */
export function parseItems(v: unknown): LastDoneItem[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const seen = new Set<string>();
	const out: LastDoneItem[] = [];
	for (const raw of v) {
		const item = parseItem(raw);
		if (!item || seen.has(item.id)) continue;
		seen.add(item.id);
		out.push(item);
	}
	return out;
}

/** The saved log: malformed rows and repeated ids are dropped, not the whole log. */
export function parseLog(v: unknown): LastDoneEntry[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const seen = new Set<string>();
	const out: LastDoneEntry[] = [];
	for (const raw of v) {
		if (!isRecord(raw)) continue;
		const { id, itemId, at } = raw;
		if (!isId(id) || !isId(itemId) || typeof at !== 'string' || seen.has(id)) continue;
		if (Number.isNaN(Date.parse(at))) continue;
		seen.add(id);
		out.push({ id, itemId, at });
	}
	return out;
}

const randomId = () => {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** An id none of `taken` has. */
export function newId(taken: Iterable<string>): string {
	const used = new Set(taken);
	let id: string;
	do id = randomId();
	while (used.has(id));
	return id;
}

// --- Dates --------------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** The calendar day `date` falls on in the local time zone, as a whole number of days. */
const dayNumber = (date: Date) =>
	Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);

/** Calendar days from `from` to `to` in the local time zone (11pm to 1am is 1 day). */
export const daysBetween = (from: Date, to: Date): number => dayNumber(to) - dayNumber(from);

/**
 * `date` plus `every`, by the calendar: a month after Jan 31 is the last day of February, and
 * a week is 7 calendar days whatever the clocks do.
 */
export function addInterval(date: Date, every: Every): Date {
	const next = new Date(date);
	if (every.unit === 'months') {
		const day = next.getDate();
		next.setDate(1);
		next.setMonth(next.getMonth() + every.n);
		const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
		next.setDate(Math.min(day, last));
	} else next.setDate(next.getDate() + every.n * (every.unit === 'weeks' ? 7 : 1));
	return next;
}

/** "today", "yesterday", "3 days ago", "2 weeks ago": by calendar day. */
export function agoLabel(at: Date, now: Date): string {
	const days = daysBetween(at, now);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 14) return `${days} days ago`;
	if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
	const months = Math.floor(days / 30.4);
	if (days < 730) return `${months} months ago`;
	return `${Math.floor(days / 365)} years ago`;
}

/** "every 9 days", "every week", "every 2 months". */
export function everyLabel(every: Every): string {
	const unit = every.unit.slice(0, -1);
	return every.n === 1 ? `every ${unit}` : `every ${every.n} ${every.unit}`;
}

/** "in 3 days", "tomorrow", "today", "2 days ago" for a due date. */
export function dueLabel(due: Date, now: Date): string {
	const days = daysBetween(now, due);
	if (days === 0) return 'today';
	if (days === 1) return 'tomorrow';
	if (days === -1) return 'yesterday';
	return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

// --- Stats ------------------------------------------------------------------------------

/** Times an item was done, oldest first. */
export const timesOf = (log: readonly LastDoneEntry[], itemId: string): Date[] =>
	log
		.filter((e) => e.itemId === itemId)
		.map((e) => new Date(e.at))
		.sort((a, b) => a.getTime() - b.getTime());

/** Calendar days between each time and the next. */
export const gaps = (times: readonly Date[]): number[] =>
	times.slice(1).map((t, i) => daysBetween(times[i]!, t));

export function median(values: readonly number[]): number | undefined {
	if (!values.length) return undefined;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export const average = (values: readonly number[]): number | undefined =>
	values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;

/** The usual interval in whole days: the median gap, once there are at least 2 gaps. */
export function usualDays(times: readonly Date[]): number | undefined {
	const g = gaps(times);
	if (g.length < 2) return undefined;
	return Math.max(1, Math.round(median(g)!));
}

export type Status = {
	item: LastDoneItem;
	times: Date[];
	last?: Date;
	usual?: number;
	/** When it's next due: from the target if it has one, else from the usual interval. */
	due?: Date;
	/** Past its due day. */
	overdue: boolean;
	/** Calendar days past due (negative: days left). */
	daysOver?: number;
};

export function statusOf(item: LastDoneItem, log: readonly LastDoneEntry[], now: Date): Status {
	const times = timesOf(log, item.id);
	const last = times.at(-1);
	const usual = usualDays(times);
	const every = item.every ?? (usual ? { n: usual, unit: 'days' as const } : undefined);
	const due = last && every ? addInterval(last, every) : undefined;
	const daysOver = due ? daysBetween(due, now) : undefined;
	return { item, times, last, usual, due, overdue: (daysOver ?? 0) > 0, daysOver };
}

/**
 * The list's order: the most overdue first, then the longest since it was done, then things
 * never done, by name.
 */
export function sortStatuses(list: readonly Status[], now: Date): Status[] {
	const since = (s: Status) => (s.last ? daysBetween(s.last, now) : -1);
	return [...list].sort((a, b) => {
		if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
		if (a.overdue && b.overdue && a.daysOver !== b.daysOver) return b.daysOver! - a.daysOver!;
		if (!a.last !== !b.last) return a.last ? -1 : 1;
		if (since(a) !== since(b)) return since(b) - since(a);
		return a.item.name.localeCompare(b.item.name);
	});
}

/** A local date and optional time (`YYYY-MM-DD`, `HH:MM`) as a Date; noon when there's no time. */
export function fromInputs(day: string, time: string): Date | undefined {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
	if (!d) return undefined;
	const t = /^(\d{2}):(\d{2})$/.exec(time);
	const date = new Date(
		Number(d[1]),
		Number(d[2]) - 1,
		Number(d[3]),
		t ? Number(t[1]) : 12,
		t ? Number(t[2]) : 0
	);
	return Number.isNaN(date.getTime()) || date.getDate() !== Number(d[3]) ? undefined : date;
}

/** `date` as `YYYY-MM-DD` in the local time zone, for a date input. */
export const dayInput = (date: Date): string =>
	[date.getFullYear(), date.getMonth() + 1, date.getDate()]
		.map((n) => String(n).padStart(2, '0'))
		.join('-');

/** `date`'s local time as `HH:MM`, for a time input. */
export const timeInput = (date: Date): string =>
	[date.getHours(), date.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
