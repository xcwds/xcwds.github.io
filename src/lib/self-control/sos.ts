/**
 * Urge SOS (#149): the urge log every session ends in, and the session in progress. Pure types,
 * validators and helpers; the page saves them through `persist()` and `update()`.
 */
import { givingIn, type HabitKind } from './habits';

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
	/** Surfing (with its timer), writing to a technique's prompts, or saying how it went. */
	step: 'surf' | 'prompts' | 'outcome';
	habit?: string;
	technique: SessionTechnique;
	start: number;
	peak: number;
	last: number;
	/** When it started, and when the surf timer ends (ms since the epoch; `startedAt` without one). */
	startedAt: number;
	endsAt: number;
	/** What you wrote to the prompts, kept only until the session ends (never logged). */
	answers?: string[];
};

/** The techniques you can pick so far (the urge sprint comes later, #149). */
export const SESSION_TECHNIQUES = ['surf', 'zoom-out', 'plainly', 'friend'] as const;
export type SessionTechnique = (typeof SESSION_TECHNIQUES)[number];

export const TECHNIQUE_LABELS: Record<SessionTechnique, string> = {
	surf: 'Surf it',
	'zoom-out': 'Zoom out',
	plainly: 'See it plainly',
	friend: 'Talk to yourself like a friend'
};

/** What you'd write in a prompt technique: what it's for, and its prompts. */
export type PromptTechnique = { intro: string; prompts: string[]; optional?: boolean };

/**
 * The prompts for a writing technique, worded for the habit's kind (for one you're starting, the
 * urge is to skip it) and, for self-talk, your name when you've given it.
 */
export function techniquePrompts(
	technique: Exclude<SessionTechnique, 'surf'>,
	{ name, kind }: { name?: string; kind?: HabitKind }
): PromptTechnique {
	const giving = givingIn(kind);
	switch (technique) {
		case 'zoom-out':
			return {
				intro:
					'Describe the craving coldly, like a scientist would. The pull fades with the detail.',
				prompts: [
					"What is it, in plain words? (e.g. 'a bright rectangle', 'sugar and fat')",
					'What will it be like 10 minutes after?',
					'Would I recommend this to a friend right now?'
				]
			};
		case 'plainly':
			return {
				intro: `Picture the unappealing reality of ${giving}: ${
					kind === 'start'
						? 'the plan that didn\'t happen and the "tomorrow, then" feeling'
						: 'the greasy wrapper and the heavy feeling, the stiff neck and the lost hour'
				}. Skip any prompt that doesn't help.`,
				optional: true,
				prompts: [
					`What does ${giving} really look like, right now?`,
					'And how will you feel an hour later?'
				]
			};
		case 'friend':
			return {
				intro: 'Talk to yourself the way you would to a friend. A little distance makes it easier.',
				prompts: [
					name
						? `Write it in the third person: "${name} wants to…, but ${name} knows…"`
						: 'Write it in the third person, using your name: "Sam wants to…, but Sam knows…"',
					'What would someone you admire do right now?'
				]
			};
	}
}

/** Newest entries kept (about 600 KB at most, #146). */
export const LOG_MAX = 2000;
export const NOTE_MAX = 280;
export const ANSWER_MAX = 500;
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
	const { step, habit, technique, start, peak, last, startedAt, endsAt, answers } = v;
	if (step !== 'surf' && step !== 'prompts' && step !== 'outcome') return undefined;
	if (!SESSION_TECHNIQUES.includes(technique as SessionTechnique)) return undefined;
	// Surfing has a timer; the writing techniques have prompts.
	if ((step === 'surf') !== (technique === 'surf') && step !== 'outcome') return undefined;
	if (!isIntensity(start) || !isIntensity(peak) || !isIntensity(last)) return undefined;
	if (!isTime(startedAt) || !isTime(endsAt) || endsAt < startedAt) return undefined;
	const session: SosSession = {
		step,
		technique: technique as SessionTechnique,
		start,
		peak,
		last,
		startedAt,
		endsAt
	};
	if (isId(habit)) session.habit = habit;
	if (
		Array.isArray(answers) &&
		answers.length <= 5 &&
		answers.every((a) => typeof a === 'string' && a.length <= ANSWER_MAX)
	)
		session.answers = answers;
	return session;
}

/** A new session with the technique you picked, starting now (`minutes` is surfing's). */
export function startSession(
	fields: { habit?: string; intensity: number; technique: SessionTechnique; minutes: number },
	now = Date.now()
): SosSession {
	const surf = fields.technique === 'surf';
	const session: SosSession = {
		step: surf ? 'surf' : 'prompts',
		technique: fields.technique,
		start: fields.intensity,
		peak: fields.intensity,
		last: fields.intensity,
		startedAt: now,
		endsAt: surf ? now + fields.minutes * 60_000 : now
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

/** The log entry a finished session makes, given which habits still exist. */
export function finish(
	session: SosSession,
	outcome: Outcome,
	id: string,
	note?: string,
	habitExists: (id: string) => boolean = () => true
): UrgeEntry {
	const entry: UrgeEntry = {
		id,
		at: session.startedAt,
		start: session.start,
		// The closing rating counts once, here: the slider passes through values on its way.
		peak: Math.max(session.peak, session.last),
		end: session.last,
		technique: session.technique,
		outcome
	};
	// A habit deleted since the session began takes its log with it, so this one isn't its.
	if (session.habit && habitExists(session.habit)) entry.habit = session.habit;
	const trimmed = note?.trim().slice(0, NOTE_MAX);
	if (trimmed) entry.note = trimmed;
	return entry;
}
