import { describe, expect, it } from 'vitest';
import {
	EXERCISE_SUGGESTIONS,
	exerciseKey,
	lastTrained,
	musclesFor,
	parseMuscles,
	type Exercise,
	type HistoryEntry
} from './lifting';

let nextId = 1;
const exercise = (name: string, reps: number | null = 5): Exercise => ({
	id: nextId++,
	name,
	sets: [{ id: nextId++, weight: 100, reps }]
});
const entry = (finishedAt: string, ...exercises: Exercise[]): HistoryEntry => ({
	id: nextId++,
	finishedAt,
	workout: { date: finishedAt.slice(0, 10), unit: 'lb', exercises }
});

describe('musclesFor', () => {
	it('knows every suggested exercise', () => {
		for (const name of EXERCISE_SUGGESTIONS) expect(musclesFor(name, {})).toBeDefined();
	});

	it('ignores case and extra spaces', () => {
		expect(musclesFor('  bench   PRESS ', {})).toEqual(['chest', 'shoulders', 'arms']);
		expect(exerciseKey('  Cable   Fly ')).toBe('cable fly');
	});

	it('counts an exercise for more than one group', () => {
		expect(musclesFor('Deadlift', {})).toEqual(['back', 'legs']);
	});

	it('uses your own groups for your own exercises', () => {
		expect(musclesFor('Cable fly', {})).toBeUndefined();
		expect(musclesFor('Cable Fly', { 'cable fly': ['chest'] })).toEqual(['chest']);
		// Names that are also Object.prototype keys aren't grouped by accident.
		expect(musclesFor('constructor', {})).toBeUndefined();
	});
});

describe('parseMuscles', () => {
	it('keeps valid rows and drops bad ones', () => {
		expect(
			parseMuscles({
				'cable fly': ['chest'],
				'Cable Fly': ['chest'],
				curl: [],
				dips: ['chest', 'chest'],
				plank: ['abs'],
				'face pull': ['shoulders', 'back']
			})
		).toEqual({ 'cable fly': ['chest'], 'face pull': ['shoulders', 'back'] });
	});

	it('keeps names that are Object.prototype keys as plain rows', () => {
		const parsed = parseMuscles(JSON.parse('{"__proto__":["core"],"constructor":["arms"]}'))!;
		expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
		expect(musclesFor('__proto__', parsed)).toEqual(['core']);
		expect(musclesFor('Constructor', parsed)).toEqual(['arms']);
	});

	it('rejects what is not a map', () => {
		expect(parseMuscles([])).toBeUndefined();
		expect(parseMuscles(null)).toBeUndefined();
		expect(parseMuscles('x')).toBeUndefined();
	});
});

describe('lastTrained', () => {
	const history = [
		entry('2026-10-15T18:00:00.000Z', exercise('Squat'), exercise('Cable fly')),
		entry('2026-10-10T18:00:00.000Z', exercise('Deadlift'), exercise('Bench press', null)),
		entry('2026-10-12T18:00:00.000Z', exercise('Pull-ups'), exercise('  cable  FLY'))
	];

	it('finds the newest workout per group, never-trained and longest ago first', () => {
		const { groups } = lastTrained(history, {});
		expect(groups.map((g) => g.group)).toEqual([
			'chest',
			'shoulders',
			'core',
			'back',
			'arms',
			'legs'
		]);
		const by = Object.fromEntries(groups.map((g) => [g.group, g]));
		expect(by.chest!.last).toBeUndefined();
		expect(by.back!.last?.toISOString()).toBe('2026-10-12T18:00:00.000Z');
		expect(by.legs!.last?.toISOString()).toBe('2026-10-15T18:00:00.000Z');
		// Newest first, with the exercises that counted.
		expect(by.legs!.workouts.map((w) => w.exercises)).toEqual([['Squat'], ['Deadlift']]);
	});

	it('ignores exercises without reps', () => {
		const { groups } = lastTrained(history, {});
		expect(groups.find((g) => g.group === 'chest')!.workouts).toEqual([]);
	});

	it('lists your own exercises once, as last written', () => {
		expect(lastTrained(history, {}).ungrouped).toEqual(['Cable fly']);
	});

	it('counts your own exercises once they are grouped', () => {
		const { groups, ungrouped } = lastTrained(history, { 'cable fly': ['chest'] });
		expect(ungrouped).toEqual([]);
		const chest = groups.find((g) => g.group === 'chest')!;
		expect(chest.last?.toISOString()).toBe('2026-10-15T18:00:00.000Z');
		expect(chest.workouts.map((w) => w.exercises)).toEqual([['Cable fly'], ['cable FLY']]);
	});

	it('skips workouts with an unreadable finish time', () => {
		const { groups } = lastTrained([entry('not a date', exercise('Squat'))], {});
		expect(groups.every((g) => !g.last)).toBe(true);
	});
});
