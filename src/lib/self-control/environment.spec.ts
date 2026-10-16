import { buildTestApp } from '@xcwds/testing';
import tools from '@xcwds/plugin-tools';
import { APPS } from '$lib/apps';
import type { App } from '@xcwds/core';
import app from 'xcwds-app';
import selfControl from 'xcwds-app-self-control';
import { describe, expect, it, vi } from 'vitest';
import { entries, read, write } from '../storage';
import { CUE_CHIPS } from './cues';
import { removeHabitData } from './data';
import {
	CUSTOM_MAX,
	GENERIC_ITEMS,
	PLANS_MAX,
	STARTER_ITEMS,
	environmentWithout,
	matchesCue,
	newCustomItem,
	newPlan,
	parseEnvironment,
	planFor,
	plansForSos,
	starterItems,
	textProblem,
	toggled,
	withPlan,
	withoutCustom,
	type HabitPlan
} from './environment';
import { STARTERS } from './habits';
import { getApp } from '@xcwds/sveltekit';

/** Settings → Your data's groups. */
const groups = () => getApp().storage.groups();

let current: App | undefined;
vi.mock('@xcwds/sveltekit', () => ({
	getApp: () => {
		if (!current) throw new Error('No app; call open() first.');
		return current;
	}
}));

const empty = (): HabitPlan => ({ done: [], hidden: [], custom: [], plans: [] });

describe('starter checklists', () => {
	const all = [...Object.values(STARTER_ITEMS).flat(), ...GENERIC_ITEMS];
	const chips = new Set(
		Object.values(CUE_CHIPS)
			.flat()
			.map((c) => c.toLowerCase())
	);

	it('cover every starter habit, with stable unique ids and tags that are Cue Audit chips', () => {
		for (const starter of STARTERS) expect(STARTER_ITEMS[starter.name]?.length).toBeGreaterThan(3);
		// The same item may appear in two lists (the phone tools), but an id always means one item.
		const byId = new Map<string, string>();
		for (const item of all) {
			const seen = byId.get(item.id);
			if (seen) expect(seen).toBe(JSON.stringify(item));
			byId.set(item.id, JSON.stringify(item));
			expect(textProblem(item.text)).toBeUndefined();
			expect(item.tags.length).toBeGreaterThan(0);
			for (const tag of item.tags) expect(chips).toContain(tag.toLowerCase());
		}
		for (const list of [...Object.values(STARTER_ITEMS), GENERIC_ITEMS])
			expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
	});

	it("gives a habit its starter's items, then the generic ones", () => {
		expect(starterItems(' snacking ').map((i) => i.id)).toEqual(
			[...STARTER_ITEMS.Snacking!, ...GENERIC_ITEMS].map((i) => i.id)
		);
		expect(starterItems('Guitar practice')).toEqual(GENERIC_ITEMS);
	});

	it('matches items to a cue, ignoring case', () => {
		const fruit = STARTER_ITEMS.Snacking!.find((i) => i.id === 'snack-fruit')!;
		expect(matchesCue(fruit, 'kitchen')).toBe(true);
		expect(matchesCue(fruit, 'Bed')).toBe(false);
		expect(matchesCue(fruit, undefined)).toBe(false);
	});
});

describe('saved plans', () => {
	it('drop unknown ids, bad items and empty habits, not the whole habit', () => {
		const custom = { id: 'c1', group: 'easy', text: 'Tea on the desk' };
		const plan = { id: 'p1', cue: 'Bored', action: 'Make tea', starred: true };
		expect(
			parseEnvironment({
				h1: {
					done: ['snack-fruit', 'c1', 'nope', 'snack-fruit', 3],
					hidden: ['any-tell-someone', 'gone'],
					custom: [
						custom,
						{ ...custom }, // repeated id
						{ id: 'snack-fruit', group: 'easy', text: 'Clash' }, // a built-in id
						{ id: 'c2', group: 'nope', text: 'Bad group' },
						{ id: 'c3', group: 'hide', text: ' untrimmed ' }
					],
					plans: [plan, { ...plan, id: 'p2', starred: 'yes' }, { ...plan, id: 'p3', cue: '' }]
				},
				h2: { done: ['nope'] },
				h3: 'nope'
			})
		).toEqual({
			h1: {
				done: ['snack-fruit', 'c1'],
				hidden: ['any-tell-someone'],
				custom: [custom],
				plans: [plan]
			}
		});
		expect(parseEnvironment([])).toBeUndefined();
	});

	it('cap custom items and plans', () => {
		const custom = Array.from({ length: CUSTOM_MAX + 2 }, (_, i) => ({
			id: `c${i}`,
			group: 'hide',
			text: `Item ${i}`
		}));
		const plans = Array.from({ length: PLANS_MAX + 2 }, (_, i) => ({
			id: `p${i}`,
			cue: 'Bored',
			action: `Action ${i}`,
			starred: false
		}));
		const env = parseEnvironment({ h1: { custom, plans } })!;
		expect(env.h1!.custom).toHaveLength(CUSTOM_MAX);
		expect(env.h1!.plans).toHaveLength(PLANS_MAX);
	});

	it('change per habit, removing empty ones', () => {
		let env = withPlan(undefined, 'h1', (p) => ({
			...p,
			done: toggled(p.done, 'snack-fruit', true)
		}));
		expect(env).toEqual({ h1: { ...empty(), done: ['snack-fruit'] } });
		env = withPlan(env, 'h1', (p) => ({ ...p, done: toggled(p.done, 'snack-fruit', true) }));
		expect(planFor(env, 'h1').done).toEqual(['snack-fruit']);
		env = withPlan(env, 'h1', (p) => ({ ...p, done: toggled(p.done, 'snack-fruit', false) }));
		expect(env).toBeUndefined();
	});

	it('make custom items and plans with fresh ids, and remove a custom item with its tick', () => {
		const plan = empty();
		const item = newCustomItem('easy', ' Tea on the desk ', plan);
		expect(item).toMatchObject({ group: 'easy', text: 'Tea on the desk' });
		const withItem: HabitPlan = { ...plan, custom: [item], done: [item.id], hidden: [] };
		expect(withoutCustom(withItem, item.id)).toEqual(empty());
		expect(newPlan(' Bored ', ' Make tea ', plan)).toMatchObject({
			cue: 'Bored',
			action: 'Make tea',
			starred: false
		});
	});

	it('show the starred plans in Urge SOS', () => {
		const a = { id: 'a', cue: 'Bored', action: 'Walk', starred: true };
		const b = { id: 'b', cue: 'Tired', action: 'Nap', starred: false };
		const env = { h1: { ...empty(), plans: [a, b] } };
		expect(plansForSos(env, 'h1')).toEqual([a]);
		expect(plansForSos(env, undefined)).toEqual([]);
		expect(plansForSos(undefined, 'h1')).toEqual([]);
	});

	it('save in the Self-Control group and go when their habit is deleted', async () => {
		current = await buildTestApp(
			{
				brand: { name: 'xcwds' },
				storage: { appName: 'xcwds.com' },
				plugins: [
					app(),
					tools({ path: '/utils', title: 'Utils', storageKey: 'app:home:shortcuts', apps: APPS }),
					selfControl()
				]
			},
			{ import: (id) => import(/* @vite-ignore */ id), logLevel: 'silent' }
		);
		const env = {
			h1: { ...empty(), done: ['snack-fruit'] },
			h2: { ...empty(), hidden: ['snack-water'] }
		};
		expect(write(entries.selfControlPlan, env)).toBe(true);
		expect(
			groups()
				.find((g) => g.id === 'self-control')!
				.entries.map((e) => e.key)
		).toContain('app:self-control:plan');
		expect(removeHabitData('h1')).toBe(true);
		expect(read(entries.selfControlPlan)).toEqual({ h2: env.h2 });
		expect(environmentWithout(env, 'h2')).toEqual({ h1: env.h1 });
	});
});
