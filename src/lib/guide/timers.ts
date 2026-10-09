import { formatMinutes } from '$lib/utils/oven';

/** "a" or "an" before a number as said aloud: an 8, an 11, an 18, an 80…, otherwise a. */
export const article = (text: string) => (/^(8|11\b|18\b)/.test(text) ? 'an' : 'a');

/** The toast for a started timer: "Started an 8 min timer: Jammy eggs." */
export function startedMessage(minutes: number, label: string): string {
	const time = formatMinutes(minutes);
	return `Started ${article(time)} ${time} timer: ${label}.`;
}
