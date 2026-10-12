/**
 * Self-Control's habits (#148): the habits you're working on, which every self-control tool
 * attaches its data to. Pure types, validators and helpers; saving goes through `data.ts`.
 */

export type HabitKind = 'stop' | 'cut-back' | 'start';

export type Habit = {
	/** Random and stable: other tools key their data by it. */
	id: string;
	name: string;
	emoji: string;
	kind: HabitKind;
	/** The day it was added (`YYYY-MM-DD`). */
	created: string;
	/** Archived habits keep their data and log, and can be restored. */
	archived: boolean;
};

/** What the hub remembers about you: for now, whether you've seen the "not therapy" note. */
export type SelfControlPrefs = {
	noteSeen?: boolean;
};

export const HABIT_KINDS: readonly { id: HabitKind; label: string }[] = [
	{ id: 'stop', label: 'Stop' },
	{ id: 'cut-back', label: 'Cut back' },
	{ id: 'start', label: 'Start' }
];

export const NAME_MAX = 40;
export const DEFAULT_EMOJI = '🎯';
/** Long enough for any emoji sequence (flags, skin tones, ZWJ families), short enough to show. */
const EMOJI_MAX = 16;

/** Habits offered when adding one, besides "Something else". */
export const STARTERS: readonly Pick<Habit, 'name' | 'emoji' | 'kind'>[] = [
	{ name: 'Doomscrolling', emoji: '📱', kind: 'cut-back' },
	{ name: 'Snacking', emoji: '🍪', kind: 'cut-back' },
	{ name: 'Late nights', emoji: '🌙', kind: 'stop' },
	{ name: 'Impulse buying', emoji: '🛒', kind: 'stop' }
];

const isKind = (v: unknown): v is HabitKind => HABIT_KINDS.some((k) => k.id === v);
const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is string =>
	typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Why `name` can't be a habit's name, or undefined if it can. */
export function nameProblem(name: string): string | undefined {
	const trimmed = name.trim();
	if (!trimmed) return 'Give the habit a name.';
	if ([...trimmed].length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters.`;
	return undefined;
}

/** A saved emoji, or the default when it's missing or too long to be one. */
export const emojiOrDefault = (emoji: string): string => {
	const trimmed = emoji.trim();
	return trimmed && [...trimmed].length <= EMOJI_MAX ? trimmed : DEFAULT_EMOJI;
};

function parseHabit(v: unknown): Habit | undefined {
	if (!isRecord(v)) return undefined;
	const { id, name, emoji, kind, created, archived } = v;
	if (typeof id !== 'string' || !id || id.length > 64) return undefined;
	if (typeof name !== 'string' || nameProblem(name) || name !== name.trim()) return undefined;
	if (typeof emoji !== 'string' || emojiOrDefault(emoji) !== emoji) return undefined;
	if (!isKind(kind) || !isDay(created) || typeof archived !== 'boolean') return undefined;
	return { id, name, emoji, kind, created, archived };
}

/** Saved habits: malformed ones and repeated ids are dropped, not the whole list. */
export function parseHabits(v: unknown): Habit[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const seen = new Set<string>();
	const habits: Habit[] = [];
	for (const item of v) {
		const habit = parseHabit(item);
		if (!habit || seen.has(habit.id)) continue;
		seen.add(habit.id);
		habits.push(habit);
	}
	return habits;
}

export function parsePrefs(v: unknown): SelfControlPrefs | undefined {
	if (!isRecord(v)) return undefined;
	return typeof v.noteSeen === 'boolean' ? { noteSeen: v.noteSeen } : {};
}

/** A new habit, with an id no other habit has. */
export function newHabit(
	fields: Pick<Habit, 'name' | 'emoji' | 'kind'>,
	existing: readonly Habit[],
	now = new Date()
): Habit {
	const taken = new Set(existing.map((h) => h.id));
	let id: string;
	do id = randomId();
	while (taken.has(id));
	const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
		.map((n) => String(n).padStart(2, '0'))
		.join('-');
	return {
		id,
		name: fields.name.trim(),
		emoji: emojiOrDefault(fields.emoji),
		kind: fields.kind,
		created: day,
		archived: false
	};
}

/** `habit` with new name, emoji and kind, tidied like a new habit's. */
export const withFields = (
	habit: Habit,
	fields: Pick<Habit, 'name' | 'emoji' | 'kind'>
): Habit => ({
	...habit,
	name: fields.name.trim(),
	emoji: emojiOrDefault(fields.emoji),
	kind: fields.kind
});

/** A random id (for habits, log entries). */
export function randomId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
		return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const habitById = (habits: readonly Habit[], id: string): Habit | undefined =>
	habits.find((h) => h.id === id);

export const activeHabits = (habits: readonly Habit[]): Habit[] =>
	habits.filter((h) => !h.archived);

/** How the tools say "giving in" for a habit: for one you're starting, the urge is to skip it. */
export const givingIn = (kind: HabitKind | undefined): string =>
	kind === 'start' ? 'skipping it' : 'giving in';
