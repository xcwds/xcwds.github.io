import { describe, expect, it } from 'vitest';
import {
	MAX_RECENT,
	emptyShortcuts,
	parseShortcuts,
	withPinMoved,
	withPinToggled,
	withVisit,
	type ShortcutTool
} from './home';

const tools: ShortcutTool[] = [
	{ path: '/utils/a' },
	{ path: '/utils/b' },
	{ path: '/utils/c' },
	{ path: '/utils/d' },
	{ path: '/utils/private', recents: false }
];

describe('withVisit', () => {
	it('keeps the most recent tools first, without duplicates, at most MAX_RECENT', () => {
		let s = emptyShortcuts();
		for (const p of ['/utils/a', '/utils/b', '/utils/a', '/utils/c', '/utils/d'])
			s = withVisit(s, p, tools);
		expect(s.recent).toEqual(['/utils/d', '/utils/c', '/utils/a']);
		expect(s.recent).toHaveLength(MAX_RECENT);
	});

	it('ignores pages that are not tools, and tools that opt out', () => {
		const s = emptyShortcuts();
		expect(withVisit(s, '/recipes/brownies', tools)).toBe(s);
		expect(withVisit(s, '/utils/private', tools)).toBe(s);
	});
});

describe('pins', () => {
	it('toggle and move within bounds', () => {
		let s = withPinToggled(withPinToggled(emptyShortcuts(), '/utils/a'), '/utils/b');
		expect(s.pins).toEqual(['/utils/a', '/utils/b']);
		s = withPinMoved(s, '/utils/b', -1);
		expect(s.pins).toEqual(['/utils/b', '/utils/a']);
		expect(withPinMoved(s, '/utils/b', -1)).toBe(s);
		expect(withPinMoved(s, '/utils/a', 1)).toBe(s);
		expect(withPinToggled(s, '/utils/b').pins).toEqual(['/utils/a']);
	});
});

describe('parseShortcuts', () => {
	it('drops removed tools, private recents, duplicates and junk', () => {
		expect(
			parseShortcuts(
				{
					pins: ['/utils/gone', '/utils/b', '/utils/b', 3, '/utils/private'],
					recent: ['/utils/private', '/utils/gone', '/utils/a', '/utils/b', '/utils/c', '/utils/d']
				},
				tools
			)
		).toEqual({
			pins: ['/utils/b', '/utils/private'],
			recent: ['/utils/a', '/utils/b', '/utils/c']
		});
		expect(parseShortcuts('nope', tools)).toBeUndefined();
		expect(parseShortcuts({}, tools)).toEqual(emptyShortcuts());
	});
});
