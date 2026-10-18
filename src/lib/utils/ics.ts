/**
 * A tiny iCalendar (RFC 5545) writer for one all-day event with a reminder (#219): Last done
 * hands it to the calendar app you already use, since the app can't remind you itself.
 */

export type CalendarEvent = {
	/** Stable for the same thing and day, so calendars that honour UIDs update, not duplicate. */
	uid: string;
	/** The event's day, in the local calendar (the time is ignored). */
	day: Date;
	summary: string;
	description?: string;
	/** When the reminder goes off, in hours from the start of the day. Defaults to 9 (9am). */
	alarmHour?: number;
};

/** `date`'s local calendar day as `YYYYMMDD`. */
export const icsDate = (date: Date): string =>
	[date.getFullYear(), date.getMonth() + 1, date.getDate()]
		.map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
		.join('');

/** A UTC timestamp as `YYYYMMDDTHHMMSSZ`. */
const icsStamp = (date: Date): string =>
	date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

/** TEXT values: backslash, `;`, `,` and newlines escaped. */
export const escapeText = (text: string): string =>
	text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const encoder = new TextEncoder();

/**
 * Folds a content line at 75 octets: each continuation starts with a space (which counts), and
 * no character (UTF-8 sequence, or emoji surrogate pair) is split.
 */
export function foldLine(line: string): string {
	const parts: string[] = [];
	let part = '';
	let size = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = parts.length ? 74 : 75;
		if (size + bytes > limit) {
			parts.push(part);
			part = '';
			size = 0;
		}
		part += char;
		size += bytes;
	}
	parts.push(part);
	return parts.join('\r\n ');
}

/** The whole `.ics` file: one VCALENDAR with one VEVENT, CRLF line endings. */
export function calendarFile(event: CalendarEvent, now = new Date()): string {
	const start = new Date(event.day.getFullYear(), event.day.getMonth(), event.day.getDate());
	const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//xcwds//Last done//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${event.uid}`,
		`DTSTAMP:${icsStamp(now)}`,
		`DTSTART;VALUE=DATE:${icsDate(start)}`,
		`DTEND;VALUE=DATE:${icsDate(end)}`,
		`SUMMARY:${escapeText(event.summary)}`,
		...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
		'TRANSP:TRANSPARENT',
		'BEGIN:VALARM',
		'ACTION:DISPLAY',
		`DESCRIPTION:${escapeText(event.summary)}`,
		`TRIGGER:PT${event.alarmHour ?? 9}H`,
		'END:VALARM',
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return lines.map(foldLine).join('\r\n') + '\r\n';
}
