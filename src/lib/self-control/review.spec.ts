import { describe, expect, it } from 'vitest';
import {
	REFLECTIONS_KEPT,
	byTechnique,
	encouragement,
	hardWeek,
	parseReflections,
	rodeOutShare,
	summarize,
	weeks,
	withReflection
} from './review';
import type { Outcome, Technique, UrgeEntry } from './sos';

const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();
let n = 0;
const urge = (
	when: number,
	outcome: Outcome,
	extra: Partial<UrgeEntry> & { technique?: Technique } = {}
): UrgeEntry => ({ id: `u${n++}`, at: when, start: 4, outcome, ...extra });

describe('weekly review', () => {
	it('sums a week up, empty included', () => {
		expect(summarize([])).toEqual({ urges: 0, rodeOut: 0, partly: 0, gaveIn: 0 });
		const s = summarize([
			urge(1, 'rode-out', { peak: 7 }),
			urge(1, 'partly'),
			urge(1, 'gave-in', { peak: 6 })
		]);
		expect(s).toEqual({ urges: 3, rodeOut: 1, partly: 1, gaveIn: 1, avgPeak: 5.7 });
		expect(rodeOutShare(s)).toBeCloseTo(1 / 3);
		expect(rodeOutShare(summarize([]))).toBeUndefined();
	});

	it('buckets urges into calendar weeks, oldest first, across DST', () => {
		const log = [
			urge(at(2026, 10, 25, 23), 'rode-out'), // Sunday before the change
			urge(at(2026, 11, 1, 1), 'gave-in'), // Sunday, US DST ends at 2am
			urge(at(2026, 11, 2, 0), 'rode-out'), // Monday just after midnight
			urge(at(2026, 9, 1), 'rode-out') // too old to show
		];
		const monday = weeks(log, 1, at(2026, 11, 4), 3);
		expect(monday.map((w) => [w.key, w.log.length])).toEqual([
			['2026-10-19', 1],
			['2026-10-26', 1],
			['2026-11-02', 1]
		]);
		const sunday = weeks(log, 7, at(2026, 11, 4), 3);
		expect(sunday.map((w) => [w.key, w.log.length])).toEqual([
			['2026-10-18', 0],
			['2026-10-25', 1],
			['2026-11-01', 2]
		]);
	});

	it('shows which techniques help, best share first', () => {
		const log = [
			urge(1, 'rode-out', { technique: 'surf' }),
			urge(1, 'gave-in', { technique: 'surf' }),
			urge(1, 'rode-out', { technique: 'sprint' }),
			urge(1, 'rode-out', { technique: 'sprint' }),
			urge(1, 'rode-out') // logged by hand
		];
		expect(byTechnique(log)).toEqual([
			{ technique: 'sprint', urges: 2, rodeOut: 2 },
			{ technique: 'surf', urges: 2, rodeOut: 1 }
		]);
		expect(byTechnique([])).toEqual([]);
	});

	it('encourages, and is gentle about hard weeks', () => {
		const s = (rodeOut: number, partly: number, gaveIn: number) =>
			summarize([
				...Array.from({ length: rodeOut }, () => urge(1, 'rode-out')),
				...Array.from({ length: partly }, () => urge(1, 'partly')),
				...Array.from({ length: gaveIn }, () => urge(1, 'gave-in'))
			]);
		expect(encouragement(s(0, 0, 0))).toBe('No urges logged this week.');
		expect(encouragement(s(3, 0, 0))).toBe('You noticed 3 urges and rode out every one.');
		expect(encouragement(s(9, 1, 2))).toBe('You rode out 9 of 12 urges.');
		expect(encouragement(s(0, 1, 0))).toBe('You noticed 1 urge and held some of it off.');
		expect(encouragement(s(0, 0, 2))).toBe('You noticed 2 urges. Noticing is where change starts.');
		expect(hardWeek(s(1, 0, 2))).toBe(true);
		expect(hardWeek(s(0, 0, 2))).toBe(false);
		expect(hardWeek(s(2, 0, 2))).toBe(false);
	});

	it('keeps reflections per week, dropping bad ones and the oldest', () => {
		expect(
			parseReflections({
				'2026-10-12': { well: 'Walks', change: 'Fruit out', extra: 1 },
				'2026-10-05': { well: ' padded ' },
				nope: { well: 'x' }
			})
		).toEqual({ '2026-10-12': { well: 'Walks', change: 'Fruit out' } });
		expect(parseReflections([])).toBeUndefined();
		const many = Object.fromEntries(
			Array.from({ length: REFLECTIONS_KEPT + 5 }, (_, i) => [
				new Date(2020, 0, 6 + i * 7).toISOString().slice(0, 10),
				{ well: `w${i}` }
			])
		);
		const kept = parseReflections(many)!;
		expect(Object.keys(kept)).toHaveLength(REFLECTIONS_KEPT);
		expect(Object.values(kept)).not.toContainEqual({ well: 'w0' });

		const one = withReflection(undefined, '2026-10-12', { well: ' Walks ', change: ' ' });
		expect(one).toEqual({ '2026-10-12': { well: 'Walks' } });
		expect(withReflection(one, '2026-10-12', { well: '', change: '' })).toBeUndefined();
	});
});
