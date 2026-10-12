import { describe, expect, it } from 'vitest';
import {
	LOG_MAX,
	NOTE_MAX,
	SURF_PROMPTS,
	appendEntry,
	finish,
	logWithout,
	parseLog,
	parseSession,
	rate,
	startSurf,
	surfPrompt,
	type UrgeEntry
} from './sos';

const entry = (fields: Partial<UrgeEntry> = {}): UrgeEntry => ({
	id: 'e1',
	at: 1_700_000_000_000,
	start: 6,
	technique: 'surf',
	outcome: 'rode-out',
	...fields
});

describe('the urge log', () => {
	it('keeps valid entries and drops malformed ones', () => {
		const good = entry({ habit: 'h1', peak: 8, end: 2, note: 'Go for a walk' });
		expect(
			parseLog([
				good,
				{ ...good, id: 'e2', start: 11 },
				{ ...good, id: 'e3', technique: 'yelling' },
				{ ...good, id: 'e4', outcome: 'maybe' },
				{ ...good, id: 'e5', at: 'yesterday' },
				'junk'
			])
		).toEqual([good]);
		expect(parseLog({})).toBeUndefined();
		// Bad optional fields are dropped, not the entry.
		expect(parseLog([{ ...entry(), peak: 2.5, end: -1, habit: '', note: ' ' }])).toEqual([entry()]);
		expect(parseLog([{ ...entry(), note: 'x'.repeat(NOTE_MAX + 1) }])).toEqual([entry()]);
	});

	it('appends and keeps the newest entries', () => {
		const full = Array.from({ length: LOG_MAX }, (_, i) => entry({ id: `e${i}` }));
		const next = appendEntry(full, entry({ id: 'new' }));
		expect(next).toHaveLength(LOG_MAX);
		expect(next[0]!.id).toBe('e1');
		expect(next.at(-1)!.id).toBe('new');
		expect(parseLog([...full, entry({ id: 'new' })])).toEqual(next);
	});

	it("drops a habit's entries", () => {
		const log = [entry({ id: 'a', habit: 'h1' }), entry({ id: 'b' })];
		expect(logWithout(log, 'h1')).toEqual([entry({ id: 'b' })]);
		expect(logWithout([entry({ habit: 'h1' })], 'h1')).toBeUndefined();
	});
});

describe('a surfing session', () => {
	it('ends at a wall-clock time and tracks the peak and last rating', () => {
		const s = startSurf({ habit: 'h1', intensity: 6, minutes: 10 }, 1000);
		expect(s).toEqual({
			step: 'surf',
			technique: 'surf',
			habit: 'h1',
			start: 6,
			peak: 6,
			last: 6,
			startedAt: 1000,
			endsAt: 1000 + 600_000
		});
		const rated = rate(rate(s, 9), 3);
		expect(rated).toMatchObject({ start: 6, peak: 9, last: 3 });
		expect(finish(rated, 'partly', 'id1')).toEqual({
			id: 'id1',
			at: 1000,
			habit: 'h1',
			start: 6,
			peak: 9,
			end: 3,
			technique: 'surf',
			outcome: 'partly'
		});
		expect(finish(rated, 'gave-in', 'id2', '  Charge the phone in the kitchen ').note).toBe(
			'Charge the phone in the kitchen'
		);
		expect(finish(rated, 'gave-in', 'id3', '   ')).not.toHaveProperty('note');
		// The closing rating counts toward the peak only once it's saved.
		expect(finish({ ...rated, last: 10 }, 'gave-in', 'id4')).toMatchObject({ peak: 10, end: 10 });
		// A habit deleted since the session began isn't logged against.
		expect(finish(rated, 'rode-out', 'id5', undefined, () => false)).not.toHaveProperty('habit');
		expect(startSurf({ intensity: 2, minutes: 5 }, 1000)).not.toHaveProperty('habit');
	});

	it('round-trips through storage and refuses broken ones', () => {
		const s = startSurf({ intensity: 4, minutes: 5 }, 5000);
		expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
		expect(parseSession({ ...s, step: 'sprint' })).toBeUndefined();
		expect(parseSession({ ...s, peak: 12 })).toBeUndefined();
		expect(parseSession({ ...s, endsAt: 10 })).toBeUndefined();
		expect(parseSession(null)).toBeUndefined();
	});

	it('changes its prompt about once a minute', () => {
		expect(surfPrompt(0)).toBe(SURF_PROMPTS[0]);
		expect(surfPrompt(59_999)).toBe(SURF_PROMPTS[0]);
		expect(surfPrompt(60_000)).toBe(SURF_PROMPTS[1]);
		expect(surfPrompt(SURF_PROMPTS.length * 60_000)).toBe(SURF_PROMPTS[0]);
		expect(surfPrompt(-5)).toBe(SURF_PROMPTS[0]);
	});
});
