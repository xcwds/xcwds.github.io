/**
 * Self-Control's Cue Audit (#147): what was going on when an urge hit, logged on the urge log's
 * entries (`UrgeEntry.cues`), and the patterns that show when, where and why urges come. Pure
 * types, validators and stats; the page saves through `update()`. Dates use local time.
 */
import type { Outcome, UrgeEntry } from './sos';

export const CUE_FIELDS = ['where', 'doing', 'with', 'feeling', 'trigger'] as const;
export type CueField = (typeof CUE_FIELDS)[number];
/** Each field's cues, in the order you picked them. */
export type Cues = Partial<Record<CueField, string[]>>;

export const CUE_LABELS: Record<CueField, string> = {
	where: 'Where',
	doing: 'Doing',
	with: 'With',
	feeling: 'Feeling',
	trigger: 'What set it off'
};

/** The chips each field offers; your own come first (`chipsFor`). Feeling includes HALT. */
export const CUE_CHIPS: Record<CueField, readonly string[]> = {
	where: ['Home', 'Bed', 'Work', 'Car', 'Kitchen', 'Out'],
	doing: ['After a meal', 'Waiting', 'Working', 'Scrolling', 'TV', 'Commuting'],
	with: ['Alone', 'Partner', 'Family', 'Friends', 'Coworkers'],
	feeling: ['Bored', 'Tired', 'Stressed', 'Lonely', 'Anxious', 'Hungry', 'Happy', 'Angry'],
	trigger: [
		'A notification',
		'Saw it',
		'Smelled it',
		'Someone offered',
		'Time of day',
		'Nothing obvious'
	]
};

export const CUE_MAX = 40;
/** Cues per field on one entry. */
export const CUES_PER_ENTRY = 10;
/** Your own chips kept per field. */
export const CUSTOM_MAX = 20;
/** Entries a habit needs before its patterns show. */
export const PATTERN_MIN = 5;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Why `text` can't be a cue, or undefined if it can. */
export function cueProblem(text: string): string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return 'Write a cue first.';
	if ([...trimmed].length > CUE_MAX) return `Keep it to ${CUE_MAX} characters.`;
	return undefined;
}

/** Saved cues: bad ones and repeats (ignoring case) are dropped, each field capped at `max`. */
export function parseCues(v: unknown, max = CUES_PER_ENTRY): Cues | undefined {
	if (!isRecord(v)) return undefined;
	const cues: Cues = {};
	for (const field of CUE_FIELDS) {
		const list = v[field];
		if (!Array.isArray(list)) continue;
		const kept: string[] = [];
		for (const cue of list) {
			if (typeof cue !== 'string' || cueProblem(cue) || cue !== cue.trim()) continue;
			if (kept.length < max && !kept.some((k) => same(k, cue))) kept.push(cue);
		}
		if (kept.length) cues[field] = kept;
	}
	return Object.keys(cues).length ? cues : undefined;
}

/** The chips a field offers: your own first, then the built-in ones. */
export const chipsFor = (field: CueField, custom: Cues | undefined): string[] => {
	const own = custom?.[field] ?? [];
	return [...own, ...CUE_CHIPS[field].filter((c) => !own.some((o) => same(o, c)))];
};

/** The built-in or own chip `text` matches (ignoring case), or `text` itself, trimmed. */
export function matchChip(field: CueField, text: string, custom: Cues | undefined): string {
	const trimmed = text.trim();
	return chipsFor(field, custom).find((c) => same(c, trimmed)) ?? trimmed;
}

/**
 * Your own chips after logging `used`: the ones that aren't built in move to the front, so they're
 * offered first next time. Undefined when there are none.
 */
export function withCustomChips(
	custom: Cues | undefined,
	used: Cues | undefined
): Cues | undefined {
	const next: Cues = {};
	for (const field of CUE_FIELDS) {
		const fresh = (used?.[field] ?? []).filter((c) => !CUE_CHIPS[field].some((b) => same(b, c)));
		const old = (custom?.[field] ?? []).filter((c) => !fresh.some((f) => same(f, c)));
		const list = [...fresh, ...old].slice(0, CUSTOM_MAX);
		if (list.length) next[field] = list;
	}
	return Object.keys(next).length ? next : undefined;
}

/** What you log by hand, or change on an entry. */
export type LogFields = {
	habit?: string;
	at: number;
	intensity: number;
	outcome: Outcome;
	cues?: Cues;
	note?: string;
};

function apply(entry: UrgeEntry, fields: LogFields): UrgeEntry {
	const next: UrgeEntry = {
		...entry,
		at: fields.at,
		start: fields.intensity,
		outcome: fields.outcome
	};
	delete next.habit;
	delete next.cues;
	delete next.note;
	if (fields.habit) next.habit = fields.habit;
	// The peak is the highest rating, so it's never below the starting one.
	if (next.peak !== undefined && next.peak < next.start) next.peak = next.start;
	const cues = parseCues(fields.cues);
	if (cues) next.cues = cues;
	// The page keeps notes within `NOTE_MAX`.
	const note = fields.note?.trim();
	if (note) next.note = note;
	return next;
}

/** An entry logged by hand: no technique, just what happened. */
export const logEntry = (fields: LogFields, id: string): UrgeEntry =>
	apply({ id, at: fields.at, start: fields.intensity, outcome: fields.outcome }, fields);

/** `entry` with your changes; its technique and ratings from Urge SOS stay. */
export const editEntry = (entry: UrgeEntry, fields: LogFields): UrgeEntry => apply(entry, fields);

const pad = (n: number) => String(n).padStart(2, '0');

/** `at` as a `datetime-local` input's value, in local time. */
export function toLocalInput(at: number): string {
	const d = new Date(at);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` input's value as ms since the epoch, or undefined if it isn't one. */
export function fromLocalInput(value: string): number | undefined {
	// Browsers may add seconds (and milliseconds); the log keeps minutes.
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
	if (!match) return undefined;
	const [y, mo, d, h, mi] = match.slice(1).map(Number) as [number, number, number, number, number];
	const at = new Date(y, mo - 1, d, h, mi).getTime();
	return Number.isFinite(at) && at > 0 ? at : undefined;
}

/** The day split in six, for "when" (local time). */
export const HOUR_BLOCKS: readonly string[] = [
	'12–4am',
	'4–8am',
	'8am–12pm',
	'12–4pm',
	'4–8pm',
	'8pm–12am'
];
export const WEEKDAYS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** How many urges fell in each of `HOUR_BLOCKS`. */
export function byHourBlock(log: readonly UrgeEntry[]): number[] {
	const counts = HOUR_BLOCKS.map(() => 0);
	for (const e of log) counts[Math.floor(new Date(e.at).getHours() / 4)]!++;
	return counts;
}

/** How many urges fell on each of `WEEKDAYS` (Monday first). */
export function byWeekday(log: readonly UrgeEntry[]): number[] {
	const counts = WEEKDAYS.map(() => 0);
	for (const e of log) counts[(new Date(e.at).getDay() + 6) % 7]!++;
	return counts;
}

export type CueStat = { field: CueField; cue: string; urges: number; gaveIn: number };

/** A field's most common cues: how many urges had each, and how many of those you gave in to. */
export function topCues(log: readonly UrgeEntry[], field: CueField, count = 3): CueStat[] {
	const stats = new Map<string, CueStat>();
	for (const e of log)
		for (const cue of e.cues?.[field] ?? []) {
			const stat = stats.get(cue) ?? { field, cue, urges: 0, gaveIn: 0 };
			stat.urges++;
			if (e.outcome === 'gave-in') stat.gaveIn++;
			stats.set(cue, stat);
		}
	// Map keeps first-seen order, and sort is stable, so ties stay in that order.
	return [...stats.values()]
		.sort((a, b) => b.urges - a.urges || b.gaveIn - a.gaveIn)
		.slice(0, count);
}

export type Combination = { cues: { field: CueField; cue: string }[]; gaveIn: number };

/**
 * The riskiest moments: pairs of cues from different fields that came together most often when
 * you gave in (at least twice).
 */
export function riskiest(log: readonly UrgeEntry[], count = 3): Combination[] {
	const combos = new Map<string, Combination>();
	for (const e of log) {
		if (e.outcome !== 'gave-in') continue;
		const all = CUE_FIELDS.flatMap((field) =>
			(e.cues?.[field] ?? []).map((cue) => ({ field, cue }))
		);
		for (let i = 0; i < all.length; i++)
			for (let j = i + 1; j < all.length; j++) {
				const [a, b] = [all[i]!, all[j]!];
				if (a.field === b.field) continue;
				const key = JSON.stringify([a.field, a.cue, b.field, b.cue]);
				const combo = combos.get(key) ?? { cues: [a, b], gaveIn: 0 };
				combo.gaveIn++;
				combos.set(key, combo);
			}
	}
	return [...combos.values()]
		.filter((c) => c.gaveIn >= 2)
		.sort((a, b) => b.gaveIn - a.gaveIn)
		.slice(0, count);
}
