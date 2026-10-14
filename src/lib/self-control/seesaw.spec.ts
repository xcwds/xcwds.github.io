import { buildTestApp } from '@xcwds/testing';
import tools from '@xcwds/plugin-tools';
import type { App } from '@xcwds/core';
import app from 'xcwds-app';
import selfControl from 'xcwds-app-self-control';
import { describe, expect, it, vi } from 'vitest';
import { entries, read, write } from '../storage';
import { removeHabitData } from './data';
import {
	ITEMS_PER_SIDE,
	ITEM_MAX,
	MAX_ANGLE,
	heaviest,
	itemProblem,
	itemsFor,
	leanText,
	newItem,
	parseSeesaw,
	seesawForSos,
	seesawWithout,
	tilt,
	withItems,
	type SeesawItem,
	type Side,
	type Weight
} from './seesaw';
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

const item = (id: string, side: Side, weight: Weight = 2, text = `item ${id}`): SeesawItem => ({
	id,
	side,
	text,
	weight
});

describe('parseSeesaw', () => {
	it('keeps good items, dropping bad ones and empty seesaws', () => {
		expect(parseSeesaw('nope')).toBeUndefined();
		expect(
			parseSeesaw({
				h1: {
					items: [
						item('a', 'give-now'),
						item('a', 'hold-now'),
						{ ...item('b', 'give-now'), side: 'sideways' },
						{ ...item('c', 'give-now'), weight: 4 },
						{ ...item('d', 'give-now'), text: ' padded ' },
						{ ...item('e', 'give-now'), text: 'x'.repeat(ITEM_MAX + 1) },
						null,
						item('f', 'hold-later', 3, '🎸'.repeat(ITEM_MAX))
					]
				},
				h2: { items: [] },
				h3: 'nope',
				'': { items: [item('g', 'give-now')] }
			})
		).toEqual({
			h1: { items: [item('a', 'give-now'), item('f', 'hold-later', 3, '🎸'.repeat(ITEM_MAX))] }
		});
	});

	it(`keeps at most ${ITEMS_PER_SIDE} items per side`, () => {
		const many = Array.from({ length: ITEMS_PER_SIDE + 3 }, (_, i) => item(`n${i}`, 'give-now'));
		const parsed = parseSeesaw({ h1: { items: [...many, item('x', 'hold-now')] } })!;
		expect(parsed.h1!.items).toHaveLength(ITEMS_PER_SIDE + 1);
		expect(parsed.h1!.items.at(-1)).toEqual(item('x', 'hold-now'));
	});
});

describe('the seesaw', () => {
	it('checks what you type', () => {
		expect(itemProblem(' ')).toBe('Write something first.');
		expect(itemProblem('x'.repeat(ITEM_MAX + 1))).toMatch(/100 characters/);
		expect(itemProblem('a break')).toBeUndefined();
	});

	it('changes one habit’s items, removing what ends up empty', () => {
		let seesaw = withItems(undefined, 'h1', () => [item('a', 'give-now')]);
		seesaw = withItems(seesaw, 'h2', () => [item('b', 'hold-later')]);
		expect(itemsFor(seesaw, 'h1')).toEqual([item('a', 'give-now')]);
		seesaw = withItems(seesaw, 'h1', () => []);
		expect(seesaw).toEqual({ h2: { items: [item('b', 'hold-later')] } });
		expect(seesawWithout(seesaw!, 'h2')).toBeUndefined();
		const made = newItem({ side: 'give-later', text: ' sleep ', weight: 3 }, [
			item('a', 'give-now')
		]);
		expect(made).toMatchObject({ side: 'give-later', text: 'sleep', weight: 3 });
		expect(made.id).not.toBe('a');
	});

	it('tilts toward the heavier side: the later costs and gains against the now', () => {
		expect(tilt([])).toEqual({ holding: 0, giving: 0, lean: 'even', angle: 0 });
		expect(leanText(tilt([]))).toMatch(/^Empty/);
		const even = tilt([item('a', 'give-now', 2), item('b', 'hold-later', 2)]);
		expect(even).toMatchObject({ lean: 'even', angle: 0 });
		expect(leanText(even)).toBe('Balanced');
		// Giving in's later costs count for holding off.
		const holding = tilt([
			item('a', 'give-now', 1),
			item('b', 'hold-now', 1),
			item('c', 'give-later', 3),
			item('d', 'hold-later', 3)
		]);
		expect(holding).toMatchObject({ holding: 6, giving: 2, lean: 'holding' });
		expect(holding.angle).toBe(6);
		expect(leanText(holding)).toBe('Leans toward holding off');
		const giving = tilt([item('a', 'give-now', 3)]);
		expect(giving).toMatchObject({ lean: 'giving', angle: -MAX_ANGLE });
		expect(leanText(giving)).toBe('Leans toward giving in');
	});

	it('shows SOS the heaviest costs later and gains later for the habit', () => {
		const seesaw = {
			h1: {
				items: [
					item('a', 'give-later', 1),
					item('b', 'give-later', 3),
					item('c', 'give-later', 3),
					item('d', 'hold-later', 2),
					item('e', 'give-now', 3)
				]
			}
		};
		expect(heaviest(seesaw.h1.items, 'give-later').map((i) => i.id)).toEqual(['b', 'c']);
		expect(seesawForSos(seesaw, 'h1')).toEqual({
			costs: [item('b', 'give-later', 3), item('c', 'give-later', 3)],
			gains: [item('d', 'hold-later', 2)]
		});
		expect(seesawForSos(seesaw, undefined)).toEqual({ costs: [], gains: [] });
		expect(seesawForSos(undefined, 'h1')).toEqual({ costs: [], gains: [] });
	});
});

describe('saved seesaws', () => {
	it('save in the Self-Control group and go when their habit is deleted', async () => {
		current = await buildTestApp(
			{
				brand: { name: 'xcwds' },
				storage: { appName: 'xcwds.com' },
				plugins: [
					app(),
					tools({ path: '/utils', title: 'Utils', storageKey: 'app:home:shortcuts' }),
					selfControl()
				]
			},
			{ import: (id) => import(/* @vite-ignore */ id), logLevel: 'silent' }
		);
		const seesaw = {
			h1: { items: [item('a', 'give-now')] },
			h2: { items: [item('b', 'hold-now')] }
		};
		expect(write(entries.selfControlSeesaw, seesaw)).toBe(true);
		expect(
			groups()
				.find((g) => g.id === 'self-control')!
				.entries.map((e) => e.key)
		).toContain('app:self-control:seesaw');
		expect(removeHabitData('h1')).toBe(true);
		expect(read(entries.selfControlSeesaw)).toEqual({ h2: { items: [item('b', 'hold-now')] } });
	});
});
