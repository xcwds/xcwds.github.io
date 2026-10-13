import { describe, expect, it } from 'vitest';
import {
	CUE_CHIPS,
	CUE_FIELDS,
	CUSTOM_MAX,
	byHourBlock,
	byWeekday,
	chipsFor,
	cueProblem,
	editEntry,
	fromLocalInput,
	logEntry,
	matchChip,
	parseCues,
	riskiest,
	toLocalInput,
	topCues,
	withCustomChips,
	type Cues
} from './cues';
import { parsePrefs } from './habits';
import { parseLog, type Outcome, type UrgeEntry } from './sos';

const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
	new Date(y, mo - 1, d, h, mi).getTime();

let n = 0;
const urge = (outcome: Outcome, cues?: Cues, when = at(2026, 1, 5, 12)): UrgeEntry => ({
	id: `u${n++}`,
	at: when,
	start: 5,
	outcome,
	...(cues ? { cues } : {})
});

describe('cues', () => {
	it('checks a cue', () => {
		expect(cueProblem('  ')).toBe('Write a cue first.');
		expect(cueProblem('x'.repeat(41))).toBe('Keep it to 40 characters.');
		expect(cueProblem(' Bored ')).toBeUndefined();
	});

	it('parses saved cues, dropping bad ones, repeats and empty fields', () => {
		expect(parseCues([])).toBeUndefined();
		expect(parseCues({ where: [] })).toBeUndefined();
		expect(
			parseCues({
				where: ['Home', 'home', ' Bed', '', 3, 'x'.repeat(41)],
				feeling: 'Bored',
				nope: ['x']
			})
		).toEqual({ where: ['Home'] });
		expect(parseCues({ where: ['a', 'b', 'c'] }, 2)).toEqual({ where: ['a', 'b'] });
	});

	it('has unique built-in chips that are valid cues', () => {
		for (const field of CUE_FIELDS) {
			const chips = CUE_CHIPS[field];
			expect(new Set(chips.map((c) => c.toLowerCase())).size).toBe(chips.length);
			for (const chip of chips) expect(cueProblem(chip)).toBeUndefined();
		}
	});

	it('offers your own chips first and matches typed ones ignoring case', () => {
		const custom = { where: ['Gym', 'kitchen'] };
		expect(chipsFor('where', custom)).toEqual([
			'Gym',
			'kitchen',
			'Home',
			'Bed',
			'Work',
			'Car',
			'Out'
		]);
		expect(matchChip('where', ' home ', custom)).toBe('Home');
		expect(matchChip('where', 'gym', custom)).toBe('Gym');
		expect(matchChip('where', ' Office ', custom)).toBe('Office');
	});

	it('remembers your own chips, newest first, never the built-in ones', () => {
		expect(withCustomChips(undefined, { where: ['Home'] })).toBeUndefined();
		expect(withCustomChips({ where: ['Gym'] }, { where: ['Home', 'Office', 'gym'] })).toEqual({
			where: ['Office', 'gym']
		});
		const many = Array.from({ length: CUSTOM_MAX }, (_, i) => `Place ${i}`);
		expect(withCustomChips({ where: many }, { where: ['New'] })!.where).toEqual([
			'New',
			...many.slice(0, CUSTOM_MAX - 1)
		]);
	});

	it('keeps your own chips in the preferences', () => {
		expect(parsePrefs({ name: 'Alex', cues: { feeling: ['Restless'] } })).toEqual({
			name: 'Alex',
			cues: { feeling: ['Restless'] }
		});
		expect(parsePrefs({ cues: { feeling: [1] } })).toEqual({});
	});
});

describe('logging by hand', () => {
	it('makes and changes entries the log keeps', () => {
		const entry = logEntry(
			{
				habit: 'h1',
				at: at(2026, 1, 5, 9),
				intensity: 7,
				outcome: 'partly',
				cues: { where: ['Home'], feeling: [] },
				note: ' Tea helped '
			},
			'id1'
		);
		expect(entry).toEqual({
			id: 'id1',
			habit: 'h1',
			at: at(2026, 1, 5, 9),
			start: 7,
			outcome: 'partly',
			cues: { where: ['Home'] },
			note: 'Tea helped'
		});
		// Entries without a technique (logged by hand) and with cues survive a reload.
		expect(parseLog([entry])).toEqual([entry]);

		const fromSos: UrgeEntry = {
			id: 'id2',
			at: 1,
			habit: 'h1',
			start: 3,
			peak: 6,
			end: 1,
			technique: 'surf',
			outcome: 'rode-out',
			note: 'old'
		};
		expect(
			editEntry(fromSos, { at: 2, intensity: 8, outcome: 'gave-in', cues: { with: ['Alone'] } })
		).toEqual({
			id: 'id2',
			at: 2,
			start: 8,
			peak: 8,
			end: 1,
			technique: 'surf',
			outcome: 'gave-in',
			cues: { with: ['Alone'] }
		});
	});

	it('drops entries with an unknown technique but keeps ones with none', () => {
		const base = { id: 'a', at: 1, start: 2, outcome: 'partly' };
		expect(parseLog([base, { ...base, id: 'b', technique: 'nope' }])).toEqual([base]);
	});

	it('round-trips the time input in local time', () => {
		const when = at(2026, 3, 8, 1, 30);
		expect(toLocalInput(when)).toBe('2026-03-08T01:30');
		expect(fromLocalInput('2026-03-08T01:30')).toBe(when);
		expect(fromLocalInput('')).toBeUndefined();
		expect(fromLocalInput('2026-03-08')).toBeUndefined();
	});
});

describe('patterns', () => {
	it('groups by local time of day and weekday, across midnight and a DST change', () => {
		const log = [
			urge('partly', undefined, at(2026, 3, 8, 1, 30)), // a DST Sunday in the US, before the change
			urge('partly', undefined, at(2026, 3, 8, 23, 59)),
			urge('partly', undefined, at(2026, 3, 9, 0, 0)), // Monday, just after midnight
			urge('partly', undefined, at(2026, 3, 9, 12, 0))
		];
		expect(byHourBlock(log)).toEqual([2, 0, 0, 1, 0, 1]);
		expect(byWeekday(log)).toEqual([2, 0, 0, 0, 0, 0, 2]);
	});

	it('finds the top cues with their give-ins', () => {
		const log = [
			urge('gave-in', { feeling: ['Bored'] }),
			urge('rode-out', { feeling: ['Bored', 'Tired'] }),
			urge('gave-in', { feeling: ['Tired'] }),
			urge('gave-in', { feeling: ['Tired'] }),
			urge('partly', { feeling: ['Stressed'] }),
			urge('partly', { where: ['Home'] })
		];
		expect(topCues(log, 'feeling')).toEqual([
			{ field: 'feeling', cue: 'Tired', urges: 3, gaveIn: 2 },
			{ field: 'feeling', cue: 'Bored', urges: 2, gaveIn: 1 },
			{ field: 'feeling', cue: 'Stressed', urges: 1, gaveIn: 0 }
		]);
		expect(topCues(log, 'with')).toEqual([]);
	});

	it('finds the riskiest combinations of cues from different fields', () => {
		const risky = { where: ['Kitchen'], feeling: ['Bored', 'Tired'] };
		const log = [
			urge('gave-in', risky),
			urge('gave-in', risky),
			urge('gave-in', { where: ['Kitchen'], feeling: ['Tired'] }),
			urge('rode-out', risky),
			urge('gave-in', { where: ['Bed'], feeling: ['Bored'] })
		];
		expect(riskiest(log)).toEqual([
			{
				cues: [
					{ field: 'where', cue: 'Kitchen' },
					{ field: 'feeling', cue: 'Tired' }
				],
				gaveIn: 3
			},
			{
				cues: [
					{ field: 'where', cue: 'Kitchen' },
					{ field: 'feeling', cue: 'Bored' }
				],
				gaveIn: 2
			}
		]);
		expect(riskiest([urge('gave-in', risky)])).toEqual([]);
	});
});
