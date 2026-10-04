export const BRAND = 'xcwds';
export const TAGLINE = 'Everyday tools that stay on your device.';
/** What xcwds stands for. */
export const ACRONYM = 'eXecutes Client-side, Without Data Servers';
/** Easter egg on Settings → About (tap the acronym three times). */
export const SECRET_ACRONYM = 'eXtra Crispy Waffles, Deadlifts & Sanitizers';

export type AcronymPart = { text: string; letter: boolean };

/** Splits a phrase so the first capital of each word can be highlighted (spelling XCWDS). */
export function acronymParts(phrase: string): AcronymPart[] {
	const parts: AcronymPart[] = [];
	for (const token of phrase.split(/(\s+)/)) {
		const i = token.search(/[A-Z]/);
		if (i === -1) {
			parts.push({ text: token, letter: false });
			continue;
		}
		if (i > 0) parts.push({ text: token.slice(0, i), letter: false });
		parts.push({ text: token[i], letter: true });
		if (i + 1 < token.length) parts.push({ text: token.slice(i + 1), letter: false });
	}
	return parts.filter((p) => p.text !== '');
}

/** The highlighted letters of a phrase, e.g. "XCWDS". */
export const initials = (phrase: string) =>
	acronymParts(phrase)
		.filter((p) => p.letter)
		.map((p) => p.text)
		.join('');
