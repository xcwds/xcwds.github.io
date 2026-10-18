import { describe, expect, it } from 'vitest';
import { calendarFile, escapeText, foldLine, icsDate } from './ics.js';

const NOW = new Date(Date.UTC(2026, 9, 18, 3, 4, 5));
const octets = (s: string) => new TextEncoder().encode(s).length;
/** Unfolds content lines (RFC 5545 3.1) and splits them. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n');

describe('the iCalendar writer', () => {
	it('writes one all-day event with a 9am alert, CRLF throughout', () => {
		const ics = calendarFile(
			{
				uid: 'abc-20261021@xcwds.com',
				day: new Date(2026, 9, 21, 15, 30),
				summary: 'Vacuum the basement',
				description: 'Last done Oct 7, 2026.'
			},
			NOW
		);
		expect(ics.endsWith('\r\n')).toBe(true);
		expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
		expect(unfold(ics)).toEqual([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//xcwds//Last done//EN',
			'CALSCALE:GREGORIAN',
			'METHOD:PUBLISH',
			'BEGIN:VEVENT',
			'UID:abc-20261021@xcwds.com',
			'DTSTAMP:20261018T030405Z',
			'DTSTART;VALUE=DATE:20261021',
			'DTEND;VALUE=DATE:20261022',
			'SUMMARY:Vacuum the basement',
			'DESCRIPTION:Last done Oct 7\\, 2026.',
			'TRANSP:TRANSPARENT',
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			'DESCRIPTION:Vacuum the basement',
			'TRIGGER:PT9H',
			'END:VALARM',
			'END:VEVENT',
			'END:VCALENDAR',
			''
		]);
	});

	it('ends the event the next calendar day, across months and years', () => {
		const ics = calendarFile({ uid: 'x', day: new Date(2026, 11, 31), summary: 'x' }, NOW);
		expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
		expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
		expect(icsDate(new Date(2027, 1, 3, 23, 59))).toBe('20270203');
	});

	it('escapes commas, semicolons, backslashes and newlines', () => {
		expect(escapeText('Salt, pepper; oil\\vinegar\nnext')).toBe(
			'Salt\\, pepper\\; oil\\\\vinegar\\nnext'
		);
		const ics = calendarFile({ uid: 'x', day: NOW, summary: 'Dog food 🐶, big bag; 20 lb' }, NOW);
		expect(unfold(ics)).toContain('SUMMARY:Dog food 🐶\\, big bag\\; 20 lb');
	});

	it('folds long lines at 75 octets without splitting a character', () => {
		const line = 'SUMMARY:' + 'Clean the gutters 🍂 and the downspouts, ü'.repeat(4);
		const folded = foldLine(line);
		const parts = folded.split('\r\n');
		expect(parts.length).toBeGreaterThan(1);
		expect(octets(parts[0]!)).toBeLessThanOrEqual(75);
		for (const part of parts.slice(1)) {
			expect(part.startsWith(' ')).toBe(true);
			expect(octets(part)).toBeLessThanOrEqual(75);
		}
		// No replacement characters: every part is whole UTF-8.
		expect(parts.join('')).not.toContain('�');
		expect(folded.replace(/\r\n /g, '')).toBe(line);
		expect(foldLine('SHORT:line')).toBe('SHORT:line');
	});
});
