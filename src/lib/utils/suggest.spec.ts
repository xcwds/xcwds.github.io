import { describe, expect, it } from 'vitest';
import { MAX_SUGGESTIONS, suggest } from './suggest';

const LIST = [
	'Bench Press',
	'Squat',
	'Front Squat',
	'Goblet Squat',
	'Deadlift',
	'Romanian Deadlift'
];

describe('suggest', () => {
	it('matches anywhere in the name, ignoring case, in list order', () => {
		expect(suggest('squ', LIST)).toEqual(['Squat', 'Front Squat', 'Goblet Squat']);
		expect(suggest('LIFT', LIST)).toEqual(['Deadlift', 'Romanian Deadlift']);
		expect(suggest('  squ ', LIST)).toEqual(['Squat', 'Front Squat', 'Goblet Squat']);
	});

	it('shows nothing for an empty field, no match or an exact match', () => {
		expect(suggest('', LIST)).toEqual([]);
		expect(suggest('   ', LIST)).toEqual([]);
		expect(suggest('curl', LIST)).toEqual([]);
		expect(suggest('squat', LIST)).toEqual([]);
	});

	it('shows at most the limit', () => {
		const many = Array.from({ length: 9 }, (_, i) => `Press ${i}`);
		expect(suggest('press', many)).toHaveLength(MAX_SUGGESTIONS);
		expect(suggest('press', many, 2)).toEqual(['Press 0', 'Press 1']);
		expect(suggest('press', many, 0)).toEqual([]);
	});
});
