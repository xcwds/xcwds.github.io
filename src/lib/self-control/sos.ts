/**
 * Urge SOS (#149): the urge log every session ends in, and the session in progress. Pure types,
 * validators and helpers; the page saves them through `persist()` and `update()`.
 */

/** Every technique the log can record, including the ones still to come (#149). */
export const TECHNIQUES = ['surf', 'sprint', 'zoom-out', 'plainly', 'friend'] as const;
export type Technique = (typeof TECHNIQUES)[number];

export const OUTCOMES = ['rode-out', 'partly', 'gave-in'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** One urge, as the log keeps it (shared with the Cue Audit, #147). */
export type UrgeEntry = {
	id: string;
	/** When the session started (ms since the epoch). */
	at: number;
	habit?: string;
	/** Intensity 0–10 at the check-in, the highest rated, and the last. */
	start: number;
	peak?: number;
	end?: number;
	technique: Technique;
	outcome: Outcome;
	/** "What might help next time?", after giving in. */
	note?: string;
};

/** The SOS session in progress, saved per window so reopening the app returns to it. */
export type SosSession = {
	step: 'surf' | 'outcome';
	habit?: string;
	technique: 'surf';
	start: number;
	peak: number;
	last: number;
	/** When it started, and when the surf timer ends (ms since the epoch). */
	startedAt: number;
	endsAt: number;
};

/** Newest entries kept (about 600 KB at most, #146). */
export const LOG_MAX = 2000;
export const NOTE_MAX = 280;
export const SURF_MINUTES = [5, 10, 15, 20] as const;
export const DEFAULT_SURF_MINUTES = 10;

/** Cycled about once a minute while you surf. */
export const SURF_PROMPTS: readonly string[] = [
	'Notice where you feel it in your body.',
	'Breathe out slowly, a little longer than you breathe in.',
	"It's a wave. It will crest and pass.",
	'How strong is it now? Rate it below.'
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isIntensity = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && 0 <= v && v <= 10;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '' && v.length <= 64;

function parseEntry(v: unknown): UrgeEntry | undefined {
	if (!isRecord(v)) return undefined;
	const { id, at, habit, start, peak, end, technique, outcome, note } = v;
	if (!isId(id) || !isTime(at) || !isIntensity(start)) return undefined;
	if (!TECHNIQUES.includes(technique as Technique)) return undefined;
	if (!OUTCOMES.includes(outcome as Outcome)) return undefined;
	const entry: UrgeEntry = {
		id,
		at,
		start,
		technique: technique as Technique,
		outcome: outcome as Outcome
	};
	if (isId(habit)) entry.habit = habit;
	if (isIntensity(peak)) entry.peak = peak;
	if (isIntensity(end)) entry.end = end;
	if (typeof note === 'string' && note.trim() && note.length <= NOTE_MAX) entry.note = note;
	return entry;
}

/** The saved log: malformed entries are dropped, not the whole log, and it stays capped. */
export function parseLog(v: unknown): UrgeEntry[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const log: UrgeEntry[] = [];
	for (const item of v) {
		const entry = parseEntry(item);
		if (entry) log.push(entry);
	}
	return log.slice(-LOG_MAX);
}

/** `log` with `entry` added, keeping the newest `LOG_MAX`. */
export const appendEntry = (log: readonly UrgeEntry[], entry: UrgeEntry): UrgeEntry[] =>
	[...log, entry].slice(-LOG_MAX);

/** `log` without a habit's entries, or undefined when nothing is left. */
export function logWithout(log: readonly UrgeEntry[], habitId: string): UrgeEntry[] | undefined {
	const kept = log.filter((e) => e.habit !== habitId);
	return kept.length ? kept : undefined;
}

export function parseSession(v: unknown): SosSession | undefined {
	if (!isRecord(v)) return undefined;
	const { step, habit, technique, start, peak, last, startedAt, endsAt } = v;
	if (step !== 'surf' && step !== 'outcome') return undefined;
	if (technique !== 'surf') return undefined;
	if (!isIntensity(start) || !isIntensity(peak) || !isIntensity(last)) return undefined;
	if (!isTime(startedAt) || !isTime(endsAt) || endsAt < startedAt) return undefined;
	const session: SosSession = { step, technique, start, peak, last, startedAt, endsAt };
	if (isId(habit)) session.habit = habit;
	return session;
}

/** A new surfing session, starting now. */
export function startSurf(
	fields: { habit?: string; intensity: number; minutes: number },
	now = Date.now()
): SosSession {
	const session: SosSession = {
		step: 'surf',
		technique: 'surf',
		start: fields.intensity,
		peak: fields.intensity,
		last: fields.intensity,
		startedAt: now,
		endsAt: now + fields.minutes * 60_000
	};
	if (fields.habit) session.habit = fields.habit;
	return session;
}

/** `session` with a new rating: the last one, and the peak if it's higher. */
export const rate = (session: SosSession, intensity: number): SosSession => ({
	...session,
	last: intensity,
	peak: Math.max(session.peak, intensity)
});

/** The prompt to show `elapsed` ms into a session. */
export const surfPrompt = (elapsed: number): string =>
	SURF_PROMPTS[Math.floor(Math.max(0, elapsed) / 60_000) % SURF_PROMPTS.length]!;

/** The log entry a finished session makes. */
export function finish(
	session: SosSession,
	outcome: Outcome,
	id: string,
	note?: string
): UrgeEntry {
	const entry: UrgeEntry = {
		id,
		at: session.startedAt,
		start: session.start,
		peak: session.peak,
		end: session.last,
		technique: session.technique,
		outcome
	};
	if (session.habit) entry.habit = session.habit;
	const trimmed = note?.trim().slice(0, NOTE_MAX);
	if (trimmed) entry.note = trimmed;
	return entry;
}
