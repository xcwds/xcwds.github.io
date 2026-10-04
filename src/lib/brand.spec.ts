import { describe, expect, it } from 'vitest';
import { ACRONYM, BRAND, SECRET_ACRONYM, acronymParts, initials } from './brand';

describe('acronyms', () => {
	it('both spell the brand', () => {
		expect(initials(ACRONYM)).toBe(BRAND.toUpperCase());
		expect(initials(SECRET_ACRONYM)).toBe(BRAND.toUpperCase());
	});

	it('splits words around the highlighted capital and keeps all text', () => {
		const parts = acronymParts('eXecutes Client-side');
		expect(parts).toEqual([
			{ text: 'e', letter: false },
			{ text: 'X', letter: true },
			{ text: 'ecutes', letter: false },
			{ text: ' ', letter: false },
			{ text: 'C', letter: true },
			{ text: 'lient-side', letter: false }
		]);
		expect(
			acronymParts(ACRONYM)
				.map((p) => p.text)
				.join('')
		).toBe(ACRONYM);
	});
});
