/**
 * Self-Control's weekly review (#153): a calm look back over the urge log (#147, #149), week by
 * week in local time, plus a short reflection per week. No streaks: progress is urges noticed and
 * ridden out, and what helped. Pure stats and validators; the page saves through `update()`.
 */
import { shiftWeek, startOfWeek, weekKey, type WeekDay } from '#lib/week.js';
import type { Technique, UrgeEntry } from './sos';

export type Summary = {
	urges: number;
	rodeOut: number;
	partly: number;
	gaveIn: number;
	/** The average highest rating (the starting one when there's no peak), to one decimal. */
	avgPeak?: number;
};

export function summarize(log: readonly UrgeEntry[]): Summary {
	const s: Summary = { urges: log.length, rodeOut: 0, partly: 0, gaveIn: 0 };
	let peaks = 0;
	for (const e of log) {
		if (e.outcome === 'rode-out') s.rodeOut++;
		else if (e.outcome === 'partly') s.partly++;
		else s.gaveIn++;
		peaks += e.peak ?? e.start;
	}
	if (log.length) s.avgPeak = Math.round((peaks / log.length) * 10) / 10;
	return s;
}

export type Week = { start: number; key: string; log: UrgeEntry[] };

/**
 * The last `count` weeks up to the one `now` falls in, oldest first, each with its urges. Weeks
 * are calendar weeks starting on `first`, so a DST change doesn't move their edges.
 */
export function weeks(
	log: readonly UrgeEntry[],
	first: WeekDay,
	now: number,
	count: number
): Week[] {
	const current = startOfWeek(now, first);
	const list: Week[] = [];
	for (let i = count - 1; i >= 0; i--) {
		const start = shiftWeek(current, -i);
		list.push({ start, key: weekKey(start), log: [] });
	}
	const byKey = new Map(list.map((w) => [w.key, w]));
	for (const e of log) byKey.get(weekKey(startOfWeek(e.at, first)))?.log.push(e);
	return list;
}

export type TechniqueStat = { technique: Technique; urges: number; rodeOut: number };

/** How each Urge SOS technique went, best share first (urges logged by hand have none). */
export function byTechnique(log: readonly UrgeEntry[]): TechniqueStat[] {
	const stats = new Map<Technique, TechniqueStat>();
	for (const e of log) {
		if (!e.technique) continue;
		const stat = stats.get(e.technique) ?? { technique: e.technique, urges: 0, rodeOut: 0 };
		stat.urges++;
		if (e.outcome === 'rode-out') stat.rodeOut++;
		stats.set(e.technique, stat);
	}
	return [...stats.values()].sort(
		(a, b) => b.rodeOut / b.urges - a.rodeOut / a.urges || b.urges - a.urges
	);
}

/** The habit most give-ins with `cue` belong to (for planning against it), if any. */
export function habitForCue(log: readonly UrgeEntry[], cue: string): string | undefined {
	const counts = new Map<string, number>();
	for (const e of log)
		if (
			e.habit &&
			e.outcome === 'gave-in' &&
			Object.values(e.cues ?? {}).some((l) => l.includes(cue))
		)
			counts.set(e.habit, (counts.get(e.habit) ?? 0) + 1);
	// Ties go to the habit seen first.
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Share of urges ridden out, 0–1, or undefined for a week with none. */
export const rodeOutShare = (s: Summary): number | undefined =>
	s.urges ? s.rodeOut / s.urges : undefined;

/** A week to be gentle about: at least 3 urges and more than half given in to. */
export const hardWeek = (s: Summary): boolean => s.urges >= 3 && s.gaveIn * 2 > s.urges;

/** The week in words, as encouragement: never a broken streak. */
export function encouragement(s: Summary): string {
	if (!s.urges) return 'No urges logged this week.';
	const noticed = `You noticed ${s.urges} ${s.urges === 1 ? 'urge' : 'urges'}`;
	if (s.rodeOut === s.urges) return `${noticed} and rode out every one.`;
	if (s.rodeOut) return `You rode out ${s.rodeOut} of ${s.urges} urges.`;
	if (s.partly) return `${noticed} and held some of ${s.urges === 1 ? 'it' : 'them'} off.`;
	return `${noticed}. Noticing is where change starts.`;
}

export type Reflection = { well?: string; change?: string };
/** Reflections by week (`weekKey`). */
export type Reflections = Record<string, Reflection>;

export const REFLECTION_MAX = 500;
/** Weeks of reflections kept: about a year and a half. */
export const REFLECTIONS_KEPT = 80;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isKey = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isAnswer = (v: unknown): v is string =>
	typeof v === 'string' && v.trim() !== '' && v === v.trim() && v.length <= REFLECTION_MAX;

/** Saved reflections: bad weeks and answers are dropped, the newest weeks kept. */
export function parseReflections(v: unknown): Reflections | undefined {
	if (!isRecord(v)) return undefined;
	const kept = Object.entries(v)
		.filter(([key]) => isKey(key))
		.sort(([a], [b]) => (a < b ? 1 : -1))
		.slice(0, REFLECTIONS_KEPT);
	const out: Reflections = {};
	for (const [key, value] of kept) {
		if (!isRecord(value)) continue;
		const r: Reflection = {};
		if (isAnswer(value.well)) r.well = value.well;
		if (isAnswer(value.change)) r.change = value.change;
		if (r.well || r.change) out[key] = r;
	}
	return out;
}

/** `all` with a week's reflection set (empty answers removed), or undefined when none are left. */
export function withReflection(
	all: Reflections | undefined,
	key: string,
	reflection: Reflection
): Reflections | undefined {
	const next = { ...all };
	const r: Reflection = {};
	const well = reflection.well?.trim();
	const change = reflection.change?.trim();
	if (well) r.well = well;
	if (change) r.change = change;
	if (r.well || r.change) next[key] = r;
	else delete next[key];
	return Object.keys(next).length ? next : undefined;
}
