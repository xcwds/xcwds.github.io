/**
 * Self-Control's Why Engine (#150): the reasons you're working on a habit, per habit and in
 * general, and a note to your future self. Urge SOS (#149) shows them when an urge hits. Pure
 * types, validators and helpers; the page saves through `update()`.
 */
import { randomId } from './habits';

export type Reason = { id: string; text: string; starred: boolean };
export type HabitWhy = { reasons: Reason[]; note?: string };
export type Why = { general: Reason[]; byHabit: Record<string, HabitWhy> };

export const REASON_MAX = 140;
export const WHY_NOTE_MAX = 500;
/** Per list: plenty for reasons you'd actually read in a hurry. */
export const REASONS_MAX = 50;

/** Shown while a list is empty, to help write the first reasons (values clarification). */
export const WHY_PROMPTS: readonly string[] = [
	'What will be better in a year if this changes?',
	'Who else benefits?',
	'What does giving in cost you that you care about?',
	'What kind of person are you becoming?'
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const length = (s: string) => [...s].length;

/** Why `text` can't be a reason, or undefined if it can. */
export function reasonProblem(text: string): string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return 'Write a reason first.';
	if (length(trimmed) > REASON_MAX) return `Keep it to ${REASON_MAX} characters.`;
	return undefined;
}

/** Why `note` can't be saved, or undefined if it can (empty removes it). */
export const noteProblem = (note: string): string | undefined =>
	length(note.trim()) > WHY_NOTE_MAX ? `Keep it to ${WHY_NOTE_MAX} characters.` : undefined;

function parseReasons(v: unknown): Reason[] {
	if (!Array.isArray(v)) return [];
	const seen = new Set<string>();
	const reasons: Reason[] = [];
	for (const item of v) {
		if (!isRecord(item) || reasons.length >= REASONS_MAX) continue;
		const { id, text, starred } = item;
		if (!isId(id) || seen.has(id) || typeof starred !== 'boolean') continue;
		if (typeof text !== 'string' || reasonProblem(text) || text !== text.trim()) continue;
		seen.add(id);
		reasons.push({ id, text, starred });
	}
	return reasons;
}

/**
 * Saved reasons: bad reasons are dropped, not the whole list. Habit ids are checked for shape
 * only: data for a habit that no longer exists is ignored by the page and removed with the habit
 * (`data.ts`).
 */
export function parseWhy(v: unknown): Why | undefined {
	if (!isRecord(v)) return undefined;
	const why: Why = { general: parseReasons(v.general), byHabit: {} };
	if (isRecord(v.byHabit))
		for (const [id, value] of Object.entries(v.byHabit)) {
			if (!isId(id) || !isRecord(value)) continue;
			const habit: HabitWhy = { reasons: parseReasons(value.reasons) };
			const { note } = value;
			if (typeof note === 'string' && note.trim() && note === note.trim() && !noteProblem(note))
				habit.note = note;
			if (habit.reasons.length || habit.note) why.byHabit[id] = habit;
		}
	return why;
}

/** `why`, or undefined when it holds nothing (so the saved entry is removed). */
export function tidy(why: Why): Why | undefined {
	const byHabit: Record<string, HabitWhy> = {};
	for (const [id, habit] of Object.entries(why.byHabit))
		if (habit.reasons.length || habit.note) byHabit[id] = habit;
	return why.general.length || Object.keys(byHabit).length
		? { general: why.general, byHabit }
		: undefined;
}

/** `why` without a habit's reasons and note (for deleting the habit). */
export const whyWithout = (why: Why, habitId: string): Why | undefined => {
	const byHabit = { ...why.byHabit };
	delete byHabit[habitId];
	return tidy({ ...why, byHabit });
};

/** The list for `habitId`, or the general one. */
export const reasonsFor = (why: Why | undefined, habitId?: string): Reason[] =>
	(habitId ? why?.byHabit[habitId]?.reasons : why?.general) ?? [];

/** `why` with the list for `habitId` (or the general one) changed. */
export function withReasons(
	why: Why | undefined,
	habitId: string | undefined,
	change: (reasons: Reason[]) => Reason[]
): Why | undefined {
	const base: Why = why ?? { general: [], byHabit: {} };
	if (!habitId) return tidy({ ...base, general: change(base.general) });
	const habit = base.byHabit[habitId] ?? { reasons: [] };
	return tidy({
		...base,
		byHabit: { ...base.byHabit, [habitId]: { ...habit, reasons: change(habit.reasons) } }
	});
}

/** `why` with the habit's note set (an empty note removes it). */
export function withNote(why: Why | undefined, habitId: string, note: string): Why | undefined {
	const base: Why = why ?? { general: [], byHabit: {} };
	const habit: HabitWhy = { ...(base.byHabit[habitId] ?? { reasons: [] }) };
	const trimmed = note.trim();
	if (trimmed) habit.note = trimmed;
	else delete habit.note;
	return tidy({ ...base, byHabit: { ...base.byHabit, [habitId]: habit } });
}

/** A new reason with an id no other reason in `reasons` has. */
export function newReason(text: string, reasons: readonly Reason[]): Reason {
	const taken = new Set(reasons.map((r) => r.id));
	let id: string;
	do id = randomId();
	while (taken.has(id));
	return { id, text: text.trim(), starred: false };
}

/** `reasons` with the one at `id` moved by `by` places (clamped to the ends). */
export function moveReason(reasons: readonly Reason[], id: string, by: number): Reason[] {
	const from = reasons.findIndex((r) => r.id === id);
	if (from < 0) return [...reasons];
	const to = Math.max(0, Math.min(reasons.length - 1, from + by));
	const next = [...reasons];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved!);
	return next;
}

/** Starred first, otherwise in your order. */
export const starredFirst = (reasons: readonly Reason[]): Reason[] => [
	...reasons.filter((r) => r.starred),
	...reasons.filter((r) => !r.starred)
];

/**
 * What Urge SOS shows for `habitId` (or a craving with no habit): the habit's reasons, then the
 * general ones, each starred first, and the habit's note.
 */
export function whyForSos(
	why: Why | undefined,
	habitId: string | undefined
): { reasons: Reason[]; note?: string } {
	const habit = habitId ? why?.byHabit[habitId] : undefined;
	const reasons = [...starredFirst(habit?.reasons ?? []), ...starredFirst(why?.general ?? [])];
	return habit?.note ? { reasons, note: habit.note } : { reasons };
}
