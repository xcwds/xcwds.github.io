import { buildTestApp } from '@xcwds/testing';
import tools from '@xcwds/plugin-tools';
import { APPS } from '$lib/apps';
import type { App, Entry } from '@xcwds/core';
import app from 'xcwds-app';
import selfControl from 'xcwds-app-self-control';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { entries, read, registerEntries, write } from '../storage';
import { removeHabitData, type HabitData } from './data';
import {
	DEFAULT_EMOJI,
	activeHabits,
	givingIn,
	habitById,
	nameProblem,
	newHabit,
	parseHabits,
	parsePrefs,
	withFields,
	type Habit
} from './habits';
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

const habit = (fields: Partial<Habit> = {}): Habit => ({
	id: 'a',
	name: 'Snacking',
	emoji: '🍪',
	kind: 'cut-back',
	created: '2026-10-12',
	archived: false,
	...fields
});

describe('parseHabits', () => {
	it('keeps good habits and drops malformed ones, not the whole list', () => {
		const good = habit();
		expect(parseHabits([good])).toEqual([good]);
		expect(parseHabits('nope')).toBeUndefined();
		expect(
			parseHabits([
				good,
				null,
				{ ...good, id: 'b', name: '' },
				{ ...good, id: 'c', name: 'x'.repeat(41) },
				{ ...good, id: 'd', name: ' padded ' },
				{ ...good, id: 'e', kind: 'quit' },
				{ ...good, id: 'f', created: 'yesterday' },
				{ ...good, id: 'g', archived: 'no' },
				{ ...good, id: 'h', emoji: '' },
				{ ...good, id: '' },
				{ ...good, id: 'i', name: 'x'.repeat(40) }
			])
		).toEqual([good, { ...good, id: 'i', name: 'x'.repeat(40) }]);
	});

	it('keeps the first of two habits with the same id', () => {
		expect(parseHabits([habit(), habit({ name: 'Other' })])).toEqual([habit()]);
	});

	it('counts characters, not UTF-16 units, toward the name limit', () => {
		expect(parseHabits([habit({ name: '🍪'.repeat(40) })])).toHaveLength(1);
		expect(nameProblem('🍪'.repeat(41))).toMatch(/40/);
	});
});

describe('habits', () => {
	it('makes new habits with unique ids and tidied fields', () => {
		const made = newHabit(
			{ name: '  Late nights ', emoji: '  ', kind: 'stop' },
			[habit()],
			new Date(2026, 0, 5)
		);
		expect(made).toMatchObject({
			name: 'Late nights',
			emoji: DEFAULT_EMOJI,
			kind: 'stop',
			created: '2026-01-05',
			archived: false
		});
		expect(made.id).not.toBe('a');
		expect(parseHabits([made])).toEqual([made]);
		expect(withFields(made, { name: ' Bed ', emoji: '🛏️', kind: 'start' })).toEqual({
			...made,
			name: 'Bed',
			emoji: '🛏️',
			kind: 'start'
		});
	});

	it('finds habits, lists active ones and words giving in by kind', () => {
		const list = [habit(), habit({ id: 'b', archived: true })];
		expect(habitById(list, 'b')?.archived).toBe(true);
		expect(habitById(list, 'z')).toBeUndefined();
		expect(activeHabits(list).map((h) => h.id)).toEqual(['a']);
		expect(givingIn('start')).toBe('skipping it');
		expect(givingIn('stop')).toBe('giving in');
		expect(givingIn(undefined)).toBe('giving in');
	});

	it('reads the note flag from prefs', () => {
		expect(parsePrefs({ noteSeen: true })).toEqual({ noteSeen: true });
		expect(parsePrefs({ noteSeen: 'yes' })).toEqual({});
		expect(parsePrefs({ noteSeen: true, name: 'Alex' })).toEqual({ noteSeen: true, name: 'Alex' });
		expect(parsePrefs({ name: ' Alex ' })).toEqual({});
		expect(parsePrefs({ name: 'x'.repeat(41) })).toEqual({});
		expect(parsePrefs([])).toBeUndefined();
	});
});

describe('saved data', () => {
	/** A per-habit entry like the tools will add: reasons keyed by habit id. */
	const reasons: Entry<Record<string, string[]>> = {
		key: 'app:self-control:test-reasons',
		label: 'Test reasons',
		namespace: '',
		group: 'self-control',
		backup: true,
		sensitive: false,
		prefix: false,
		parse: (v) =>
			typeof v === 'object' && v !== null ? (v as Record<string, string[]>) : undefined
	};
	const reasonsData: HabitData<Record<string, string[]>> = {
		entry: reasons,
		without: (value, id) => {
			const rest = Object.fromEntries(Object.entries(value).filter(([k]) => k !== id));
			return Object.keys(rest).length ? rest : undefined;
		}
	};

	beforeEach(async () => {
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
		registerEntries(current.storage, [reasons]);
	});

	it('saves habits in their own group, which Settings can clear on its own', () => {
		expect(write(entries.selfControlHabits, [habit()])).toBe(true);
		expect(read(entries.selfControlHabits)).toEqual([habit()]);
		const group = groups().find((g) => g.id === 'self-control')!;
		expect(group.entries.map((e) => e.key)).toEqual(
			expect.arrayContaining(['app:self-control:habits', 'app:self-control:prefs'])
		);
	});

	it("removes a habit's data from every entry that keys data by habit", () => {
		write(reasons, { a: ['health'], b: ['money'] });
		expect(removeHabitData('a', [reasonsData])).toBe(true);
		expect(read(reasons)).toEqual({ b: ['money'] });
		expect(removeHabitData('b', [reasonsData])).toBe(true);
		expect(read(reasons)).toBeUndefined();
		// Nothing saved: nothing to do.
		expect(removeHabitData('b', [reasonsData])).toBe(true);
	});
});
