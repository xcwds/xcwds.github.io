/**
 * Self-Control's Decision Seesaw (#151): per habit, what giving in gets you now and costs you
 * later, and what holding off costs you now and gets you later, each weighed 1–3. It's the
 * decisional-balance exercise from motivational interviewing: a prompt for reflection, not a
 * verdict. Pure types, validators and helpers; the page saves through `update()`.
 */
import { randomId } from './habits';

export const SIDES = ['give-now', 'give-later', 'hold-now', 'hold-later'] as const;
export type Side = (typeof SIDES)[number];
export type Weight = 1 | 2 | 3;
export type SeesawItem = { id: string; side: Side; text: string; weight: Weight };
export type HabitSeesaw = { items: SeesawItem[] };
export type Seesaw = Record<string, HabitSeesaw>;

export const ITEM_MAX = 100;
/** Per side: enough to be honest, few enough to read at a glance. */
export const ITEMS_PER_SIDE = 20;

export const SIDE_LABELS: Record<Side, string> = {
	'give-now': 'What it gets me now',
	'give-later': 'What it costs me later',
	'hold-now': 'What it costs me now',
	'hold-later': 'What it gets me later'
};

export const SIDE_EXAMPLES: Record<Side, string> = {
	'give-now': 'a break, comfort',
	'give-later': 'lost sleep, feeling worse',
	'hold-now': 'boredom, feeling left out',
	'hold-later': 'energy, time for the guitar'
};

export const WEIGHTS: readonly { value: Weight; label: string }[] = [
	{ value: 1, label: 'A little' },
	{ value: 2, label: 'A lot' },
	{ value: 3, label: 'Hugely' }
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isSide = (v: unknown): v is Side => SIDES.includes(v as Side);
const isWeight = (v: unknown): v is Weight => v === 1 || v === 2 || v === 3;

/** Why `text` can't be an item, or undefined if it can. */
export function itemProblem(text: string): string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return 'Write something first.';
	if ([...trimmed].length > ITEM_MAX) return `Keep it to ${ITEM_MAX} characters.`;
	return undefined;
}

function parseItems(v: unknown): SeesawItem[] {
	if (!Array.isArray(v)) return [];
	const seen = new Set<string>();
	const perSide = new Map<Side, number>();
	const items: SeesawItem[] = [];
	for (const item of v) {
		if (!isRecord(item)) continue;
		const { id, side, text, weight } = item;
		if (!isId(id) || seen.has(id) || !isSide(side) || !isWeight(weight)) continue;
		if (typeof text !== 'string' || itemProblem(text) || text !== text.trim()) continue;
		const count = perSide.get(side) ?? 0;
		if (count >= ITEMS_PER_SIDE) continue;
		perSide.set(side, count + 1);
		seen.add(id);
		items.push({ id, side, text, weight });
	}
	return items;
}

/**
 * Saved seesaws: bad items are dropped, not the whole seesaw, and empty seesaws are dropped.
 * Habit ids are checked for shape only: a seesaw for a habit that no longer exists is ignored
 * by the page and removed with the habit (`data.ts`).
 */
export function parseSeesaw(v: unknown): Seesaw | undefined {
	if (!isRecord(v)) return undefined;
	const seesaw: Seesaw = {};
	for (const [id, value] of Object.entries(v)) {
		if (!isId(id) || !isRecord(value)) continue;
		const items = parseItems(value.items);
		if (items.length) seesaw[id] = { items };
	}
	return seesaw;
}

/** `seesaw`, or undefined when it holds nothing (so the saved entry is removed). */
export function tidy(seesaw: Seesaw): Seesaw | undefined {
	const kept = Object.entries(seesaw).filter(([, s]) => s.items.length);
	return kept.length ? Object.fromEntries(kept) : undefined;
}

/** `seesaw` without a habit's (for deleting the habit). */
export const seesawWithout = (seesaw: Seesaw, habitId: string): Seesaw | undefined =>
	tidy(Object.fromEntries(Object.entries(seesaw).filter(([id]) => id !== habitId)));

export const itemsFor = (seesaw: Seesaw | undefined, habitId: string): SeesawItem[] =>
	seesaw?.[habitId]?.items ?? [];

/** `seesaw` with a habit's items changed. */
export const withItems = (
	seesaw: Seesaw | undefined,
	habitId: string,
	change: (items: SeesawItem[]) => SeesawItem[]
): Seesaw | undefined =>
	tidy({ ...seesaw, [habitId]: { items: change(itemsFor(seesaw, habitId)) } });

/** A new item with an id no other item in `items` has. */
export function newItem(
	fields: { side: Side; text: string; weight: Weight },
	items: readonly SeesawItem[]
): SeesawItem {
	const taken = new Set(items.map((i) => i.id));
	let id: string;
	do id = randomId();
	while (taken.has(id));
	return { id, side: fields.side, text: fields.text.trim(), weight: fields.weight };
}

export type Tilt = {
	/** Holding off's later gains plus giving in's later costs. */
	holding: number;
	/** Giving in's gains now plus holding off's costs now. */
	giving: number;
	lean: 'holding' | 'giving' | 'even';
	/** Degrees the beam turns: negative lifts the giving-in end (it's lighter). */
	angle: number;
};

/** The most the beam turns, however lopsided the weights. */
export const MAX_ANGLE = 12;

/** Which way the seesaw leans: the long-term side against the short-term one. */
export function tilt(items: readonly SeesawItem[]): Tilt {
	let holding = 0;
	let giving = 0;
	for (const item of items)
		if (item.side === 'hold-later' || item.side === 'give-later') holding += item.weight;
		else giving += item.weight;
	const total = holding + giving;
	const lean = holding > giving ? 'holding' : giving > holding ? 'giving' : 'even';
	// The heavier end goes down: holding off sits on the right.
	const angle = total ? Math.round(((holding - giving) / total) * MAX_ANGLE * 10) / 10 : 0;
	return { holding, giving, lean, angle };
}

/** The tilt in words, for screen readers and reduced motion. */
export const leanText = (t: Tilt): string =>
	t.lean === 'holding'
		? 'Leans toward holding off'
		: t.lean === 'giving'
			? 'Leans toward giving in'
			: t.holding
				? 'Balanced'
				: 'Empty: add a few things to each side';

/** The heaviest items on `side` (ties keep your order). */
export const heaviest = (items: readonly SeesawItem[], side: Side, count = 2): SeesawItem[] =>
	items
		.filter((i) => i.side === side)
		.map((item, index) => ({ item, index }))
		.sort((a, b) => b.item.weight - a.item.weight || a.index - b.index)
		.slice(0, count)
		.map(({ item }) => item);

/** What Urge SOS shows for a habit: the top costs of giving in and gains of holding off. */
export const seesawForSos = (
	seesaw: Seesaw | undefined,
	habitId: string | undefined
): { costs: SeesawItem[]; gains: SeesawItem[] } => {
	const items = habitId ? itemsFor(seesaw, habitId) : [];
	return { costs: heaviest(items, 'give-later'), gains: heaviest(items, 'hold-later') };
};
