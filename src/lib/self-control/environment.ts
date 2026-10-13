/**
 * Self-Control's Environment Designer (#152): per habit, a checklist of changes that hide the
 * cue, add friction and make the better option easy, and if-then plans ("If [cue], then I will
 * [action]") that connect the Cue Audit (#147) to Urge SOS (#149). Pure types, data, validators
 * and helpers; the page saves through `update()`.
 */
import { randomId } from './habits';

export const GROUPS = ['hide', 'friction', 'easy', 'phone'] as const;
export type Group = (typeof GROUPS)[number];

export const GROUP_LABELS: Record<Group, string> = {
	hide: 'Hide the cue',
	friction: 'Add friction',
	easy: 'Make the better option easy',
	phone: "Use your phone's own tools"
};

/** A built-in checklist item. `tags` are Cue Audit chips it helps with (case doesn't matter). */
export type StarterItem = { id: string; group: Group; text: string; tags: readonly string[] };
export type CustomItem = { id: string; group: Group; text: string };
export type Plan = { id: string; cue: string; action: string; starred: boolean };
export type HabitPlan = { done: string[]; hidden: string[]; custom: CustomItem[]; plans: Plan[] };
export type Environment = Record<string, HabitPlan>;

export const TEXT_MAX = 100;
export const CUSTOM_MAX = 30;
export const PLANS_MAX = 10;

const PHONE: StarterItem[] = [
	{
		id: 'phone-screen-time',
		group: 'phone',
		text: 'Set an app limit with Screen Time or Digital Wellbeing',
		tags: ['Scrolling', 'Bored', 'Waiting']
	},
	{
		id: 'phone-focus',
		group: 'phone',
		text: 'Turn on a Focus or Do Not Disturb mode at the risky times',
		tags: ['A notification', 'Time of day', 'Working']
	},
	{
		id: 'phone-downtime',
		group: 'phone',
		text: 'Schedule Downtime or Bedtime mode for the evening',
		tags: ['Bed', 'Tired', 'Time of day']
	}
];

/** Checklists for the starter habits (#148), by the starter's name. */
export const STARTER_ITEMS: Record<string, readonly StarterItem[]> = {
	Doomscrolling: [
		{
			id: 'scroll-notifications',
			group: 'hide',
			text: 'Turn off non-essential notifications',
			tags: ['A notification']
		},
		{
			id: 'scroll-home-screen',
			group: 'hide',
			text: 'Move the apps off your home screen',
			tags: ['Saw it', 'Scrolling']
		},
		{ id: 'scroll-grayscale', group: 'hide', text: 'Turn on grayscale', tags: ['Scrolling'] },
		{
			id: 'scroll-log-out',
			group: 'friction',
			text: 'Log out of the apps after each use',
			tags: ['Scrolling', 'Bored']
		},
		{
			id: 'scroll-browser',
			group: 'friction',
			text: 'Delete the app and use the browser instead',
			tags: ['Scrolling']
		},
		{
			id: 'scroll-charge-outside',
			group: 'friction',
			text: 'Charge the phone outside the bedroom',
			tags: ['Bed', 'Tired']
		},
		{
			id: 'scroll-book',
			group: 'easy',
			text: 'Keep a book on your pillow or by the sofa',
			tags: ['Bed', 'Bored', 'TV']
		},
		...PHONE
	],
	Snacking: [
		{
			id: 'snack-out-of-sight',
			group: 'hide',
			text: 'Keep snacks out of sight, not on the counter',
			tags: ['Saw it', 'Kitchen']
		},
		{
			id: 'snack-skip-aisle',
			group: 'hide',
			text: 'Skip the snack aisle when shopping',
			tags: ['Saw it']
		},
		{
			id: 'snack-single-portions',
			group: 'friction',
			text: 'Buy single portions, not family packs',
			tags: ['Kitchen', 'TV']
		},
		{
			id: 'snack-high-cupboard',
			group: 'friction',
			text: 'Keep snacks in a high cupboard',
			tags: ['Kitchen', 'Bored']
		},
		{
			id: 'snack-fruit',
			group: 'easy',
			text: 'Put fruit on the counter',
			tags: ['Kitchen', 'Hungry']
		},
		{
			id: 'snack-water',
			group: 'easy',
			text: 'Keep a water bottle at your desk',
			tags: ['Working', 'Hungry', 'Tired']
		}
	],
	'Late nights': [
		{
			id: 'night-dim-lights',
			group: 'hide',
			text: 'Dim the lights an hour before bed',
			tags: ['Time of day', 'Home']
		},
		{
			id: 'night-autoplay',
			group: 'friction',
			text: 'Turn off autoplay on streaming apps',
			tags: ['TV']
		},
		{
			id: 'night-charge-outside',
			group: 'friction',
			text: 'Charge devices outside the bedroom',
			tags: ['Bed', 'Scrolling']
		},
		{
			id: 'night-alarm',
			group: 'easy',
			text: 'Set a "wind down" alarm for bedtime',
			tags: ['Time of day', 'TV']
		},
		{
			id: 'night-bed-ready',
			group: 'easy',
			text: 'Get the bed ready early: pajamas out, book on the pillow',
			tags: ['Bed', 'Tired']
		},
		...PHONE
	],
	'Impulse buying': [
		{
			id: 'buy-unsubscribe',
			group: 'hide',
			text: 'Unsubscribe from shop emails and turn off shop notifications',
			tags: ['A notification', 'Saw it']
		},
		{
			id: 'buy-shop-apps',
			group: 'hide',
			text: 'Delete shopping apps from your phone',
			tags: ['Scrolling', 'Saw it']
		},
		{
			id: 'buy-saved-cards',
			group: 'friction',
			text: 'Remove saved cards from shops and browsers',
			tags: ['Scrolling', 'Bored']
		},
		{
			id: 'buy-log-out',
			group: 'friction',
			text: 'Log out of shopping sites',
			tags: ['Scrolling']
		},
		{
			id: 'buy-wait-list',
			group: 'easy',
			text: 'Keep a 24-hour wait list: add it there, buy tomorrow if you still want it',
			tags: ['Saw it', 'Stressed', 'Happy']
		}
	]
};

/** For any habit. */
export const GENERIC_ITEMS: readonly StarterItem[] = [
	{
		id: 'any-remove-cue',
		group: 'hide',
		text: 'Remove or cover what reminds you of it where it happens most',
		tags: ['Saw it', 'Home', 'Work']
	},
	{
		id: 'any-avoid-place',
		group: 'hide',
		text: 'Change your route or seat to skip the spot where it starts',
		tags: ['Out', 'Commuting', 'Work']
	},
	{
		id: 'any-twenty-seconds',
		group: 'friction',
		text: 'Add a 20-second hurdle: put it away, unplug it, lock it up',
		tags: ['Bored', 'Waiting']
	},
	{
		id: 'any-tell-someone',
		group: 'friction',
		text: 'Tell someone you live or work with what you are cutting back on',
		tags: ['Partner', 'Family', 'Friends', 'Coworkers', 'Someone offered']
	},
	{
		id: 'any-better-option',
		group: 'easy',
		text: 'Set out the better option where you will see it first',
		tags: ['Bored', 'Tired', 'Stressed']
	},
	{
		id: 'any-plan-break',
		group: 'easy',
		text: 'Plan a short walk or stretch for the time it usually hits',
		tags: ['Time of day', 'Working', 'Stressed', 'Tired']
	}
];

/** A habit's built-in items: its starter's (matched by name, ignoring case), then the generic ones. */
export function starterItems(habitName: string): StarterItem[] {
	const key = Object.keys(STARTER_ITEMS).find(
		(k) => k.toLowerCase() === habitName.trim().toLowerCase()
	);
	return [...(key ? STARTER_ITEMS[key]! : []), ...GENERIC_ITEMS];
}

/** Every built-in item id (they're stable, so ticks survive copy edits). */
const BUILT_IN = new Set(
	[...Object.values(STARTER_ITEMS).flat(), ...GENERIC_ITEMS].map((item) => item.id)
);

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isGroup = (v: unknown): v is Group => GROUPS.includes(v as Group);
const isText = (v: unknown): v is string =>
	typeof v === 'string' && !textProblem(v) && v === v.trim();

/** Why `text` can't be an item, cue or action, or undefined if it can. */
export function textProblem(text: string): string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return 'Write something first.';
	if ([...trimmed].length > TEXT_MAX) return `Keep it to ${TEXT_MAX} characters.`;
	return undefined;
}

function parseHabitPlan(v: unknown): HabitPlan {
	const plan: HabitPlan = { done: [], hidden: [], custom: [], plans: [] };
	if (!isRecord(v)) return plan;
	const ids = new Set<string>();
	if (Array.isArray(v.custom))
		for (const item of v.custom) {
			if (!isRecord(item) || plan.custom.length >= CUSTOM_MAX) continue;
			const { id, group, text } = item;
			if (!isId(id) || ids.has(id) || BUILT_IN.has(id) || !isGroup(group) || !isText(text))
				continue;
			ids.add(id);
			plan.custom.push({ id, group, text });
		}
	// Ticks and hidden items name a built-in or custom item; unknown ids are dropped.
	const known = (id: unknown): id is string => isId(id) && (BUILT_IN.has(id) || ids.has(id));
	for (const key of ['done', 'hidden'] as const) {
		const list = v[key];
		if (Array.isArray(list)) plan[key] = [...new Set(list.filter(known))];
	}
	if (Array.isArray(v.plans)) {
		const seen = new Set<string>();
		for (const item of v.plans) {
			if (!isRecord(item) || plan.plans.length >= PLANS_MAX) continue;
			const { id, cue, action, starred } = item;
			if (!isId(id) || seen.has(id) || !isText(cue) || !isText(action)) continue;
			if (typeof starred !== 'boolean') continue;
			seen.add(id);
			plan.plans.push({ id, cue, action, starred });
		}
	}
	return plan;
}

const isEmpty = (p: HabitPlan) =>
	!p.done.length && !p.hidden.length && !p.custom.length && !p.plans.length;

/** Saved plans: bad parts are dropped, not the whole habit's, and empty habits are dropped. */
export function parseEnvironment(v: unknown): Environment | undefined {
	if (!isRecord(v)) return undefined;
	const env: Environment = {};
	for (const [id, value] of Object.entries(v)) {
		if (!isId(id)) continue;
		const plan = parseHabitPlan(value);
		if (!isEmpty(plan)) env[id] = plan;
	}
	return env;
}

/** `env`, or undefined when it holds nothing (so the saved entry is removed). */
export function tidy(env: Environment): Environment | undefined {
	const kept = Object.entries(env).filter(([, p]) => !isEmpty(p));
	return kept.length ? Object.fromEntries(kept) : undefined;
}

/** `env` without a habit's (for deleting the habit). */
export const environmentWithout = (env: Environment, habitId: string): Environment | undefined =>
	tidy(Object.fromEntries(Object.entries(env).filter(([id]) => id !== habitId)));

export const planFor = (env: Environment | undefined, habitId: string): HabitPlan =>
	env?.[habitId] ?? { done: [], hidden: [], custom: [], plans: [] };

/** `env` with a habit's plan changed. */
export const withPlan = (
	env: Environment | undefined,
	habitId: string,
	change: (plan: HabitPlan) => HabitPlan
): Environment | undefined => tidy({ ...env, [habitId]: change(planFor(env, habitId)) });

/** `list` with `id` in it or not. */
export const toggled = (list: readonly string[], id: string, on: boolean): string[] =>
	on ? [...new Set([...list, id])] : list.filter((x) => x !== id);

const freshId = (taken: Iterable<string>): string => {
	const used = new Set(taken);
	let id: string;
	do id = randomId();
	while (used.has(id) || BUILT_IN.has(id));
	return id;
};

/** A custom item with an id no other item has. */
export const newCustomItem = (group: Group, text: string, plan: HabitPlan): CustomItem => ({
	id: freshId(plan.custom.map((i) => i.id)),
	group,
	text: text.trim()
});

/** A new if-then plan with an id no other plan has. */
export const newPlan = (cue: string, action: string, plan: HabitPlan): Plan => ({
	id: freshId(plan.plans.map((p) => p.id)),
	cue: cue.trim(),
	action: action.trim(),
	starred: false
});

/** `plan` without a custom item, and its tick. */
export const withoutCustom = (plan: HabitPlan, id: string): HabitPlan => ({
	...plan,
	custom: plan.custom.filter((i) => i.id !== id),
	done: plan.done.filter((x) => x !== id),
	hidden: plan.hidden.filter((x) => x !== id)
});

/** Whether a built-in item helps with `cue` (Cue Audit chips, ignoring case). */
export const matchesCue = (item: StarterItem, cue: string | undefined): boolean =>
	!!cue && item.tags.some((t) => t.toLowerCase() === cue.trim().toLowerCase());

/** The if-then plans Urge SOS shows for a habit: the starred ones. */
export const plansForSos = (env: Environment | undefined, habitId: string | undefined): Plan[] =>
	habitId ? planFor(env, habitId).plans.filter((p) => p.starred) : [];
