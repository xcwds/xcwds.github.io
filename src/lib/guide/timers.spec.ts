import { describe, expect, it } from 'vitest';
import { article, startedMessage } from './timers';

describe('startedMessage', () => {
	it('uses "an" where the number starts with a vowel sound', () => {
		expect(startedMessage(8, 'Jammy eggs')).toBe('Started an 8 min timer: Jammy eggs.');
		expect(startedMessage(11, 'x')).toBe('Started an 11 min timer: x.');
		expect(startedMessage(18, 'x')).toBe('Started an 18 min timer: x.');
		expect(startedMessage(6, 'Runny eggs')).toBe('Started a 6 min timer: Runny eggs.');
		expect(startedMessage(12, 'x')).toBe('Started a 12 min timer: x.');
		expect(startedMessage(110, 'x')).toBe('Started a 1 h 50 min timer: x.');
	});

	it('only treats whole numbers as eleven and eighteen', () => {
		expect(article('1 h')).toBe('a');
		expect(article('110 min')).toBe('a');
		expect(article('85 min')).toBe('an');
	});
});
