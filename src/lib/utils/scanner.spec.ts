import { describe, expect, it } from 'vitest';
import { localPaper } from './scanner';

describe('localPaper', () => {
	it('starts on Letter where the region uses it', () => {
		expect(localPaper(['en-US'])).toBe('letter');
		expect(localPaper(['fr-CA', 'en-CA'])).toBe('letter');
		expect(localPaper(['es-MX'])).toBe('letter');
		expect(localPaper(['fil-PH'])).toBe('letter');
	});

	it('starts on A4 everywhere else', () => {
		expect(localPaper(['en-GB'])).toBe('a4');
		expect(localPaper(['de-DE'])).toBe('a4');
		expect(localPaper(['es-ES'])).toBe('a4');
		expect(localPaper(['en-AU'])).toBe('a4');
	});

	it('goes by the first language only', () => {
		expect(localPaper(['en-GB', 'en-US'])).toBe('a4');
		expect(localPaper(['en-US', 'en-GB'])).toBe('letter');
	});

	it('reads a language without a region as its most likely one', () => {
		expect(localPaper(['en'])).toBe('letter');
		expect(localPaper(['fr'])).toBe('a4');
		expect(localPaper(['ja'])).toBe('a4');
	});

	it('falls back to A4 with no language or one it can’t read', () => {
		expect(localPaper([])).toBe('a4');
		expect(localPaper([''])).toBe('a4');
		expect(localPaper(['not a locale!'])).toBe('a4');
	});
});
