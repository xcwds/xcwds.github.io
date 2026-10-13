import { describe, expect, it } from 'vitest';
import { localeWeekStart, shiftWeek, startOfWeek, weekKey, weekStartDay } from './week';

const at = (y: number, mo: number, d: number, h = 12, mi = 0) =>
	new Date(y, mo - 1, d, h, mi).getTime();

describe('weeks', () => {
	it('start on the day you pick, at local midnight', () => {
		// Wednesday 2026-10-14.
		const wed = at(2026, 10, 14, 15);
		expect(weekKey(startOfWeek(wed, 1))).toBe('2026-10-12');
		expect(weekKey(startOfWeek(wed, 7))).toBe('2026-10-11');
		expect(weekKey(startOfWeek(wed, 6))).toBe('2026-10-10');
		expect(startOfWeek(wed, 1)).toBe(at(2026, 10, 12, 0));
		// The first day itself, and just before midnight at the end of the week.
		expect(weekKey(startOfWeek(at(2026, 10, 12, 0, 0), 1))).toBe('2026-10-12');
		expect(weekKey(startOfWeek(at(2026, 10, 18, 23, 59), 1))).toBe('2026-10-12');
		expect(weekKey(startOfWeek(at(2026, 10, 19, 0, 0), 1))).toBe('2026-10-19');
	});

	it('shift by calendar weeks, across a DST change', () => {
		// US DST starts 2026-03-08 and ends 2026-11-01; calendar days keep the edges at midnight.
		const start = startOfWeek(at(2026, 3, 4), 1); // Monday 2026-03-02
		expect(weekKey(shiftWeek(start, 1))).toBe('2026-03-09');
		expect(new Date(shiftWeek(start, 1)).getHours()).toBe(0);
		expect(weekKey(shiftWeek(startOfWeek(at(2026, 11, 4), 7), -1))).toBe('2026-10-25');
		expect(weekKey(startOfWeek(at(2026, 3, 8, 3, 30), 7))).toBe('2026-03-08');
	});

	it("follow the setting, or the locale's first day", () => {
		expect(weekStartDay(6, 'en-US')).toBe(6);
		const us = localeWeekStart('en-US');
		// Node without week info falls back to Monday; with it, the US starts on Sunday.
		expect([1, 7]).toContain(us);
		expect(weekStartDay(null, 'en-US')).toBe(us);
		expect(localeWeekStart('de-DE')).toBe(1);
		expect(localeWeekStart('not a locale!')).toBe(1);
	});
});
