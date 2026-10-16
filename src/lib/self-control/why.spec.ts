import { buildTestApp } from '@xcwds/testing';
import tools from '@xcwds/plugin-tools';
import { APPS } from '$lib/apps';
import type { App } from '@xcwds/core';
import app from 'xcwds-app';
import selfControl from 'xcwds-app-self-control';
import { describe, expect, it, vi } from 'vitest';
import { entries, read, write } from '../storage';
import { removeHabitData } from './data';
import {
	REASONS_MAX,
	REASON_MAX,
	WHY_NOTE_MAX,
	moveReason,
	newReason,
	noteProblem,
	parseWhy,
	reasonProblem,
	reasonsFor,
	starredFirst,
	whyForSos,
	whyWithout,
	withNote,
	withReasons,
	type Reason,
	type Why
} from './why';
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

const r = (id: string, text = `reason ${id}`, starred = false): Reason => ({ id, text, starred });

describe('parseWhy', () => {
	it('keeps good reasons and notes, dropping bad ones but not the rest', () => {
		expect(parseWhy('nope')).toBeUndefined();
		expect(parseWhy({})).toEqual({ general: [], byHabit: {} });
		expect(
			parseWhy({
				general: [
					r('a'),
					r('a', 'repeated id'),
					null,
					{ id: 'b', text: '', starred: false },
					{ id: 'c', text: ' padded ', starred: false },
					{ id: 'd', text: 'x'.repeat(REASON_MAX + 1), starred: false },
					{ id: 'e', text: 'not a flag', starred: 'yes' },
					r('f', '🍪'.repeat(REASON_MAX), true)
				],
				byHabit: {
					h1: { reasons: [r('g')], note: 'Remember Sunday.' },
					h2: { reasons: [], note: '  ' },
					h3: { reasons: 'nope', note: 'x'.repeat(WHY_NOTE_MAX + 1) },
					'': { reasons: [r('h')] },
					h4: 'nope'
				}
			})
		).toEqual({
			general: [r('a'), r('f', '🍪'.repeat(REASON_MAX), true)],
			byHabit: { h1: { reasons: [r('g')], note: 'Remember Sunday.' } }
		});
	});

	it(`keeps at most ${REASONS_MAX} reasons per list`, () => {
		const many = Array.from({ length: REASONS_MAX + 5 }, (_, i) => r(`r${i}`));
		expect(parseWhy({ general: many })!.general).toHaveLength(REASONS_MAX);
	});
});

describe('reasons', () => {
	it('checks what you type', () => {
		expect(reasonProblem('  ')).toBe('Write a reason first.');
		expect(reasonProblem('x'.repeat(REASON_MAX + 1))).toMatch(/140 characters/);
		expect(reasonProblem(' I want my evenings back ')).toBeUndefined();
		expect(noteProblem('')).toBeUndefined();
		expect(noteProblem('x'.repeat(WHY_NOTE_MAX + 1))).toMatch(/500 characters/);
	});

	it('changes the general list or a habit’s, removing what ends up empty', () => {
		let why: Why | undefined = withReasons(undefined, undefined, () => [r('a')]);
		expect(why).toEqual({ general: [r('a')], byHabit: {} });
		why = withReasons(why, 'h1', (list) => [...list, r('b')]);
		expect(reasonsFor(why, 'h1')).toEqual([r('b')]);
		expect(reasonsFor(why)).toEqual([r('a')]);
		why = withNote(why, 'h1', '  Keep going.  ');
		expect(why!.byHabit.h1!.note).toBe('Keep going.');
		why = withReasons(why, 'h1', () => []);
		expect(why!.byHabit.h1).toEqual({ reasons: [], note: 'Keep going.' });
		why = withNote(why, 'h1', ' ');
		expect(why!.byHabit).toEqual({});
		expect(withReasons(why, undefined, () => [])).toBeUndefined();
	});

	it('makes new reasons with unique ids and moves them within bounds', () => {
		const made = newReason('  Sleep  ', [r('a')]);
		expect(made).toMatchObject({ text: 'Sleep', starred: false });
		expect(made.id).not.toBe('a');
		const list = [r('a'), r('b'), r('c')];
		expect(moveReason(list, 'c', -1).map((x) => x.id)).toEqual(['a', 'c', 'b']);
		expect(moveReason(list, 'a', -1).map((x) => x.id)).toEqual(['a', 'b', 'c']);
		expect(moveReason(list, 'a', 5).map((x) => x.id)).toEqual(['b', 'c', 'a']);
		expect(moveReason(list, 'zzz', 1)).toEqual(list);
	});

	it('puts starred reasons first, otherwise keeping your order', () => {
		const list = [r('a'), r('b', 'b', true), r('c'), r('d', 'd', true)];
		expect(starredFirst(list).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
	});

	it("shows SOS the habit's reasons, then the general ones, each starred first, and the note", () => {
		const why: Why = {
			general: [r('g1'), r('g2', 'g2', true)],
			byHabit: { h1: { reasons: [r('h1'), r('h2', 'h2', true)], note: 'You can do this.' } }
		};
		expect(whyForSos(why, 'h1')).toEqual({
			reasons: [r('h2', 'h2', true), r('h1'), r('g2', 'g2', true), r('g1')],
			note: 'You can do this.'
		});
		expect(whyForSos(why, undefined)).toEqual({ reasons: [r('g2', 'g2', true), r('g1')] });
		expect(whyForSos(why, 'deleted')).toEqual({ reasons: [r('g2', 'g2', true), r('g1')] });
		expect(whyForSos(undefined, 'h1')).toEqual({ reasons: [] });
	});

	it('drops a habit’s reasons when the habit is deleted', () => {
		const why: Why = {
			general: [],
			byHabit: { h1: { reasons: [r('a')] }, h2: { reasons: [r('b')] } }
		};
		expect(whyWithout(why, 'h1')).toEqual({ general: [], byHabit: { h2: { reasons: [r('b')] } } });
		expect(whyWithout(whyWithout(why, 'h1')!, 'h2')).toBeUndefined();
	});
});

describe('saved reasons', () => {
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
		const why: Why = { general: [r('g')], byHabit: { h1: { reasons: [r('a')], note: 'Hi.' } } };
		expect(write(entries.selfControlWhy, why)).toBe(true);
		expect(
			groups()
				.find((g) => g.id === 'self-control')!
				.entries.map((e) => e.key)
		).toContain('app:self-control:why');
		expect(removeHabitData('h1')).toBe(true);
		expect(read(entries.selfControlWhy)).toEqual({ general: [r('g')], byHabit: {} });
	});
});
