import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	SCHEMA_VERSION,
	VERSION_KEY,
	allEntries,
	entries,
	migrate,
	read,
	remove,
	resetMigrationState,
	write
} from './storage';

class MemoryStorage {
	map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	key = (i: number) => [...this.map.keys()][i] ?? null;
	getItem = (k: string) => this.map.get(k) ?? null;
	setItem = (k: string, v: string) => void this.map.set(k, String(v));
	removeItem = (k: string) => void this.map.delete(k);
	clear = () => this.map.clear();
}

let store: MemoryStorage;

beforeEach(() => {
	store = new MemoryStorage();
	Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
	resetMigrationState();
});

afterEach(() => {
	Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('registry', () => {
	it('prefixes every key with app: and keeps keys unique', () => {
		const keys = allEntries.map((e) => e.key);
		expect(keys.every((k) => k.startsWith('app:'))).toBe(true);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('read / write / remove', () => {
	it('round-trips values and stamps the schema version', () => {
		expect(write(entries.coffeeDuration, 120_000)).toBe(true);
		expect(read(entries.coffeeDuration)).toBe(120_000);
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
		remove(entries.coffeeDuration);
		expect(read(entries.coffeeDuration)).toBeUndefined();
	});

	it('returns undefined for missing, corrupt or invalid data', () => {
		expect(read(entries.liftingWorkout)).toBeUndefined();
		store.setItem(entries.liftingWorkout.key, '{not json');
		expect(read(entries.liftingWorkout)).toBeUndefined();
		store.setItem(entries.liftingWorkout.key, JSON.stringify({ date: 'x' }));
		expect(read(entries.liftingWorkout)).toBeUndefined();
		store.setItem(entries.coffeeDuration.key, '-5');
		expect(read(entries.coffeeDuration)).toBeUndefined();
	});

	it('never throws when storage is unavailable', () => {
		Object.defineProperty(globalThis, 'localStorage', {
			get() {
				throw new Error('SecurityError');
			},
			configurable: true
		});
		expect(read(entries.coffeeDuration)).toBeUndefined();
		expect(write(entries.coffeeDuration, 1)).toBe(false);
		expect(() => remove(entries.coffeeDuration)).not.toThrow();
	});

	it('reports a failed write when storage is full', () => {
		store.setItem = () => {
			throw new Error('QuotaExceededError');
		};
		expect(write(entries.coffeeDuration, 1)).toBe(false);
	});
});

describe('migration v1', () => {
	const rice = {
		id: 1,
		label: 'Rice',
		state: { duration: 60_000, endsAt: null, pausedRemaining: 60_000 }
	};
	const seedLegacy = () => {
		store.setItem('coffee-timer-duration', '120000');
		store.setItem('cooking-timers', JSON.stringify([rice, { id: 'bad' }]));
		store.setItem('lifting-calculator', JSON.stringify({ equipmentId: 'dumbbell' }));
		store.setItem('lifting-workout', JSON.stringify({ date: 'Sat', exercises: [] }));
		store.setItem('lifting-tab', 'workout'); // was stored as a raw string, not JSON
	};

	it('moves every legacy key to its app: key and removes the old one', () => {
		seedLegacy();
		migrate();
		expect(read(entries.coffeeDuration)).toBe(120_000);
		expect(read(entries.cookingTimers)).toEqual([rice]);
		expect(read(entries.liftingCalculator)).toEqual({ equipmentId: 'dumbbell' });
		expect(read(entries.liftingWorkout)).toEqual({ date: 'Sat', exercises: [] });
		expect(read(entries.liftingTab)).toBe('workout');
		expect([...store.map.keys()].filter((k) => !k.startsWith('app:'))).toEqual([]);
		expect(store.getItem(VERSION_KEY)).toBe('1');
	});

	it('drops invalid legacy data instead of migrating it', () => {
		store.setItem('lifting-tab', 'garbage');
		migrate();
		expect(read(entries.liftingTab)).toBeUndefined();
		expect(store.getItem('lifting-tab')).toBeNull();
	});

	it('does not overwrite data already under the new key', () => {
		store.setItem(entries.coffeeDuration.key, '60000');
		store.setItem('coffee-timer-duration', '120000');
		migrate();
		expect(read(entries.coffeeDuration)).toBe(60_000);
	});

	it('runs once and leaves data from a newer schema alone', () => {
		store.setItem(VERSION_KEY, String(SCHEMA_VERSION + 1));
		store.setItem('coffee-timer-duration', '120000');
		migrate();
		expect(store.getItem('coffee-timer-duration')).toBe('120000');
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION + 1));
	});
});

describe('validators', () => {
	it('keeps the valid fields of a saved plate calculator', () => {
		store.setItem(
			entries.liftingCalculator.key,
			JSON.stringify({
				equipmentId: 'kettlebell',
				mode: 'sideways',
				symmetric: false,
				sides: [{ 45: 1 }, { 7: 2 }],
				available: [45, 25]
			})
		);
		expect(read(entries.liftingCalculator)).toEqual({
			equipmentId: 'kettlebell',
			symmetric: false,
			available: [45, 25]
		});
	});

	it('rejects a workout with malformed exercises or sets', () => {
		const ok = {
			date: 'Sat',
			exercises: [{ id: 1, name: 'Squat', sets: [{ id: 2, weight: null, reps: 5 }] }]
		};
		store.setItem(entries.liftingWorkout.key, JSON.stringify(ok));
		expect(read(entries.liftingWorkout)).toEqual(ok);
		ok.exercises[0].sets.push({ id: 3, weight: 'heavy', reps: 1 } as never);
		store.setItem(entries.liftingWorkout.key, JSON.stringify(ok));
		expect(read(entries.liftingWorkout)).toBeUndefined();
	});

	it('keeps valid cooking timers and drops broken ones', () => {
		const good = { id: 1, label: 'Pasta', state: { duration: 1, endsAt: 5, pausedRemaining: 1 } };
		store.setItem(entries.cookingTimers.key, JSON.stringify([good, { id: 2, label: 'x' }, null]));
		expect(read(entries.cookingTimers)).toEqual([good]);
	});
});
