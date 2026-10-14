import { describe, expect, it } from 'vitest';
import {
	addInterval,
	agoLabel,
	average,
	daysBetween,
	dueLabel,
	everyLabel,
	fromInputs,
	gaps,
	timeInput,
	median,
	nameProblem,
	parseItems,
	parseLog,
	sortStatuses,
	statusOf,
	usualDays,
	type LastDoneEntry,
	type LastDoneItem
} from './last-done';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const log = (itemId: string, ...dates: Date[]): LastDoneEntry[] =>
	dates.map((date, i) => ({ id: `${itemId}-${i}`, itemId, at: date.toISOString() }));
const item = (id: string, extra: Partial<LastDoneItem> = {}): LastDoneItem => ({
	id,
	name: `Thing ${id}`,
	...extra
});

describe('validators', () => {
	it('drops malformed things and repeated ids, not the whole list', () => {
		expect(parseItems('nope')).toBeUndefined();
		expect(
			parseItems([
				{ id: 'a', name: 'Bathroom', emoji: '🛁', every: { n: 2, unit: 'weeks' }, notes: 'x' },
				{ id: 'a', name: 'Again' },
				{ id: 'b', name: '  padded  ' },
				{ id: 'c', name: 'Bad unit', every: { n: 2, unit: 'years' } },
				{ id: 'd', name: 'Zero', every: { n: 0, unit: 'days' } },
				{ id: 'e', name: '' },
				{ id: 'f', name: 'Dog food' },
				null
			])
		).toEqual([
			{ id: 'a', name: 'Bathroom', emoji: '🛁', every: { n: 2, unit: 'weeks' }, notes: 'x' },
			{ id: 'f', name: 'Dog food' }
		]);
	});

	it('drops log rows without a valid time', () => {
		expect(
			parseLog([
				{ id: '1', itemId: 'a', at: '2026-10-01T12:00:00.000Z' },
				{ id: '1', itemId: 'a', at: '2026-10-02T12:00:00.000Z' },
				{ id: '2', itemId: 'a', at: 'yesterday' },
				{ id: '3', itemId: '', at: '2026-10-02T12:00:00.000Z' }
			])
		).toEqual([{ id: '1', itemId: 'a', at: '2026-10-01T12:00:00.000Z' }]);
	});

	it('checks names', () => {
		expect(nameProblem(' ')).toBe('Give it a name.');
		expect(nameProblem('x'.repeat(41))).toMatch(/40 characters/);
		expect(nameProblem('Vacuum the basement')).toBeUndefined();
	});
});

describe('gaps and the usual interval', () => {
	it('needs at least 2 gaps for a usual interval', () => {
		expect(gaps([])).toEqual([]);
		expect(gaps([at(2026, 10, 1)])).toEqual([]);
		expect(usualDays([at(2026, 10, 1), at(2026, 10, 8)])).toBeUndefined();
		const times = [at(2026, 10, 1), at(2026, 10, 8), at(2026, 10, 18), at(2026, 10, 27)];
		expect(gaps(times)).toEqual([7, 10, 9]);
		expect(usualDays(times)).toBe(9);
	});

	it('takes the median and the average', () => {
		expect(median([])).toBeUndefined();
		expect(median([3])).toBe(3);
		expect(median([10, 2, 4, 6])).toBe(5);
		expect(average([2, 4])).toBe(3);
		expect(average([])).toBeUndefined();
	});
});

describe('dates', () => {
	it('counts calendar days in the local time zone', () => {
		expect(daysBetween(at(2026, 10, 13, 23), at(2026, 10, 14, 1))).toBe(1);
		expect(daysBetween(at(2026, 10, 14, 1), at(2026, 10, 14, 23))).toBe(0);
		// Across the end of daylight saving time (a 25-hour day where it applies).
		expect(daysBetween(at(2026, 10, 31, 12), at(2026, 11, 2, 12))).toBe(2);
		expect(daysBetween(at(2026, 3, 7, 12), at(2026, 3, 9, 12))).toBe(2);
	});

	it('adds months by the calendar', () => {
		expect(addInterval(at(2026, 1, 31), { n: 1, unit: 'months' })).toEqual(at(2026, 2, 28));
		expect(addInterval(at(2028, 1, 31), { n: 1, unit: 'months' })).toEqual(at(2028, 2, 29));
		expect(addInterval(at(2026, 11, 15), { n: 3, unit: 'months' })).toEqual(at(2027, 2, 15));
		expect(addInterval(at(2026, 10, 30), { n: 1, unit: 'weeks' })).toEqual(at(2026, 11, 6));
		expect(addInterval(at(2026, 10, 1), { n: 9, unit: 'days' })).toEqual(at(2026, 10, 10));
	});

	it('labels how long ago, by calendar day', () => {
		const now = at(2026, 10, 14, 9);
		expect(agoLabel(at(2026, 10, 14, 1), now)).toBe('today');
		expect(agoLabel(at(2026, 10, 13, 23), now)).toBe('yesterday');
		expect(agoLabel(at(2026, 10, 2), now)).toBe('12 days ago');
		expect(agoLabel(at(2026, 9, 16), now)).toBe('4 weeks ago');
		expect(agoLabel(at(2026, 6, 1), now)).toBe('4 months ago');
		expect(agoLabel(at(2023, 6, 1), now)).toBe('3 years ago');
	});

	it('labels intervals and due dates', () => {
		expect(everyLabel({ n: 1, unit: 'weeks' })).toBe('every week');
		expect(everyLabel({ n: 9, unit: 'days' })).toBe('every 9 days');
		const now = at(2026, 10, 14);
		expect(dueLabel(at(2026, 10, 14), now)).toBe('today');
		expect(dueLabel(at(2026, 10, 15), now)).toBe('tomorrow');
		expect(dueLabel(at(2026, 10, 18), now)).toBe('in 4 days');
		expect(dueLabel(at(2026, 10, 13), now)).toBe('yesterday');
		expect(dueLabel(at(2026, 10, 10), now)).toBe('4 days ago');
	});

	it('reads a date and optional time from inputs', () => {
		expect(fromInputs('2026-10-03', '')).toEqual(at(2026, 10, 3, 12));
		expect(fromInputs('2026-10-03', '07:30')).toEqual(at(2026, 10, 3, 7, 30));
		expect(fromInputs('2026-02-30', '')).toBeUndefined();
		expect(fromInputs('', '')).toBeUndefined();
		expect(timeInput(at(2026, 10, 3, 7, 5))).toBe('07:05');
	});
});

describe('status and order', () => {
	const now = at(2026, 10, 14);

	it('is due from the target when there is one, else from the usual interval', () => {
		const times = log('a', at(2026, 9, 1), at(2026, 9, 11), at(2026, 9, 21));
		const usual = statusOf(item('a'), times, now);
		expect(usual.usual).toBe(10);
		expect(usual.due).toEqual(at(2026, 10, 1));
		expect(usual.overdue).toBe(true);
		expect(usual.daysOver).toBe(13);
		const target = statusOf(item('a', { every: { n: 1, unit: 'months' } }), times, now);
		expect(target.due).toEqual(at(2026, 10, 21));
		expect(target.overdue).toBe(false);
	});

	it('has no due date without a target or 2 gaps, and none before it was ever done', () => {
		expect(statusOf(item('a'), log('a', at(2026, 10, 1)), now).due).toBeUndefined();
		const never = statusOf(item('a', { every: { n: 1, unit: 'weeks' } }), [], now);
		expect([never.last, never.due, never.overdue]).toEqual([undefined, undefined, false]);
	});

	it('puts the most overdue first, then the longest since, then things never done', () => {
		const entries = [
			...log('late', at(2026, 10, 1)),
			...log('later', at(2026, 9, 1)),
			...log('recent', at(2026, 10, 13)),
			...log('old', at(2026, 8, 1))
		];
		const items = [
			item('never'),
			item('recent'),
			item('old'),
			item('late', { every: { n: 1, unit: 'weeks' } }),
			item('later', { every: { n: 2, unit: 'weeks' } })
		];
		const order = sortStatuses(
			items.map((i) => statusOf(i, entries, now)),
			now
		).map((s) => s.item.id);
		expect(order).toEqual(['later', 'late', 'old', 'recent', 'never']);
	});
});
