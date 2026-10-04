import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	BACKUP_APP,
	SCHEMA_VERSION,
	VERSION_KEY,
	allEntries,
	clear,
	defaultSettings,
	entries,
	exportData,
	forgetLiftingEquipment,
	groups,
	importData,
	migrate,
	parseBackup,
	parseCookingPresets,
	read,
	remove,
	resetMigrationState,
	storageWritable,
	update,
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

	it("keeps What's new last-seen ids that are whole numbers", () => {
		const parse = entries.whatsNewSeen.parse;
		expect([3, 0, -1, 1.5, '3', null].map(parse)).toEqual([
			3,
			0,
			undefined,
			undefined,
			undefined,
			undefined
		]);
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
		expect(remove(entries.coffeeDuration)).toBe(false);
		expect(storageWritable()).toBe(false);
	});

	it('reports a failed write when storage is full', () => {
		expect(storageWritable()).toBe(true);
		store.setItem = () => {
			throw new Error('QuotaExceededError');
		};
		expect(write(entries.coffeeDuration, 1)).toBe(false);
		expect(storageWritable()).toBe(false);
	});
});

describe('update', () => {
	const e = { key: 'app:test', label: 'Test', parse: (v: unknown) => v as number[] };
	const push = (n: number) => (latest: number[] | undefined) => [...(latest ?? []), n];

	it('changes the latest saved value, not a stale copy', () => {
		// Another tab saved [1] after this tab last read []; this tab's stale copy is [].
		write(e, [1]);
		expect(update(e, [], push(2))).toEqual({ value: [1, 2], saved: true });
		expect(read(e)).toEqual([1, 2]);
	});

	it('removes the entry when the change returns undefined', () => {
		write(e, [1]);
		expect(update(e, [1], () => undefined)).toEqual({ value: undefined, saved: true });
		expect(store.getItem('app:test')).toBeNull();
	});

	it("changes this tab's copy when storage can't be read, and says it wasn't saved", () => {
		Object.defineProperty(globalThis, 'localStorage', {
			get() {
				throw new Error('SecurityError');
			},
			configurable: true
		});
		expect(update(e, [1], push(2))).toEqual({ value: [1, 2], saved: false });
	});

	it("starts from this tab's copy when it holds changes storage doesn't have", () => {
		write(e, [1]);
		expect(update(e, [1, 5], push(2), { unsaved: true })).toEqual({
			value: [1, 5, 2],
			saved: true
		});
	});

	it('keeps the new value but reports a failed save when storage is full', () => {
		write(e, [1]);
		store.setItem = () => {
			throw new Error('QuotaExceededError');
		};
		expect(update(e, [], push(2))).toEqual({ value: [1, 2], saved: false });
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
		expect(read(entries.liftingCalculator)).toEqual({ unit: 'lb', equipmentId: 'dumbbell' });
		expect(read(entries.liftingWorkout)).toEqual({ date: 'Sat', unit: 'lb', exercises: [] });
		expect(read(entries.liftingTab)).toBe('workout');
		expect([...store.map.keys()].filter((k) => !k.startsWith('app:'))).toEqual([]);
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
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
		store.setItem(VERSION_KEY, String(SCHEMA_VERSION)); // current data: validation only, no migration
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
		// No unit, so the plate counts can't be trusted and are dropped.
		expect(read(entries.liftingCalculator)).toEqual({
			equipmentId: 'kettlebell',
			symmetric: false
		});
		store.setItem(
			entries.liftingCalculator.key,
			JSON.stringify({ unit: 'kg', sides: [{ 20: 1 }, { 20: 1 }] })
		);
		expect(read(entries.liftingCalculator)).toEqual({ unit: 'kg', sides: [{ 20: 1 }, { 20: 1 }] });
	});

	it('rejects a workout with malformed exercises or sets', () => {
		const ok = {
			date: 'Sat',
			exercises: [{ id: 1, name: 'Squat', sets: [{ id: 2, weight: null, reps: 5 }] }]
		};
		store.setItem(entries.liftingWorkout.key, JSON.stringify(ok));
		expect(read(entries.liftingWorkout)).toEqual({ ...ok, unit: 'lb' });
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

describe('home shortcuts entry', () => {
	it('is backed up, and drops tools that no longer exist', () => {
		write(entries.homeShortcuts, { pins: ['/utils/coffee-timer'], recent: [] });
		expect(exportData().data[entries.homeShortcuts.key]).toEqual({
			pins: ['/utils/coffee-timer'],
			recent: []
		});
		store.setItem(
			entries.homeShortcuts.key,
			JSON.stringify({ pins: ['/utils/gone', '/utils/coffee-timer'], recent: ['/utils/gone'] })
		);
		expect(read(entries.homeShortcuts)).toEqual({ pins: ['/utils/coffee-timer'], recent: [] });
	});
});

describe('settings entry', () => {
	it('fills missing or invalid fields with defaults', () => {
		store.setItem(entries.settings.key, JSON.stringify({ theme: 'dark', sound: 'loud' }));
		expect(read(entries.settings)).toEqual({ ...defaultSettings, theme: 'dark' });
		store.setItem(entries.settings.key, JSON.stringify({ theme: 'neon' }));
		expect(read(entries.settings)?.theme).toBe('system');
	});

	it('loads the recipe unit system, defaulting to as written (null)', () => {
		store.setItem(entries.settings.key, JSON.stringify({ theme: 'dark' }));
		expect(read(entries.settings)?.recipeUnits).toBeNull();
		write(entries.settings, { ...defaultSettings, recipeUnits: 'metric' });
		expect(read(entries.settings)?.recipeUnits).toBe('metric');
		store.setItem(entries.settings.key, JSON.stringify({ recipeUnits: 'imperial' }));
		expect(read(entries.settings)?.recipeUnits).toBeNull();
	});

	it('loads the oven unit, defaulting to °F', () => {
		// Saved before the oven converter existed.
		store.setItem(entries.settings.key, JSON.stringify({ theme: 'dark' }));
		expect(read(entries.settings)?.ovenUnit).toBe('F');
		write(entries.settings, { ...defaultSettings, ovenUnit: 'C' });
		expect(read(entries.settings)?.ovenUnit).toBe('C');
		store.setItem(entries.settings.key, JSON.stringify({ ovenUnit: 'K' }));
		expect(read(entries.settings)?.ovenUnit).toBe('F');
	});
});

describe('groups and clear', () => {
	it('groups entries by tool and clears one group at a time', () => {
		expect(groups.map((g) => g.id)).toEqual([
			'coffee-timer',
			'cooking-timer',
			'weightlifting',
			'workout-history',
			'settings',
			'home'
		]);
		write(entries.coffeeDuration, 1000);
		write(entries.liftingTab, 'workout');
		clear(groups.find((g) => g.id === 'weightlifting')!.entries);
		expect(read(entries.liftingTab)).toBeUndefined();
		expect(read(entries.coffeeDuration)).toBe(1000);
		clear();
		expect(read(entries.coffeeDuration)).toBeUndefined();
	});
});

describe('backups', () => {
	const now = new Date('2026-10-04T12:00:00Z');

	it('exports every valid saved value with metadata', () => {
		write(entries.coffeeDuration, 120_000);
		write(entries.settings, { ...defaultSettings, theme: 'dark' });
		store.setItem(entries.liftingTab.key, '"nonsense"');
		expect(exportData(now)).toEqual({
			app: BACKUP_APP,
			schemaVersion: SCHEMA_VERSION,
			exportedAt: '2026-10-04T12:00:00.000Z',
			data: {
				[entries.coffeeDuration.key]: 120_000,
				[entries.settings.key]: { ...defaultSettings, theme: 'dark' }
			}
		});
	});

	it('round-trips through parse and import', () => {
		write(entries.coffeeDuration, 120_000);
		write(entries.liftingTab, 'workout');
		const text = JSON.stringify(exportData(now));
		clear();
		const parsed = parseBackup(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.found.map((e) => e.key).sort()).toEqual(
			[entries.coffeeDuration.key, entries.liftingTab.key].sort()
		);
		importData(parsed.backup, 'merge');
		expect(read(entries.coffeeDuration)).toBe(120_000);
		expect(read(entries.liftingTab)).toBe('workout');
	});

	it('merge keeps data missing from the backup; replace clears it', () => {
		const backup = parseBackup(
			JSON.stringify({
				app: BACKUP_APP,
				schemaVersion: 1,
				data: { [entries.liftingTab.key]: 'plates' }
			})
		);
		if (!backup.ok) throw new Error('expected a valid backup');

		write(entries.coffeeDuration, 5000);
		write(entries.liftingTab, 'workout');
		importData(backup.backup, 'merge');
		expect(read(entries.liftingTab)).toBe('plates');
		expect(read(entries.coffeeDuration)).toBe(5000);

		importData(backup.backup, 'replace');
		expect(read(entries.coffeeDuration)).toBeUndefined();
		expect(read(entries.liftingTab)).toBe('plates');
	});

	it('skips unknown keys and invalid values', () => {
		const parsed = parseBackup(
			JSON.stringify({
				app: BACKUP_APP,
				schemaVersion: 1,
				data: {
					'app:unknown': 1,
					[entries.coffeeDuration.key]: -1,
					[entries.liftingTab.key]: 'plates'
				}
			})
		);
		expect(parsed.ok && parsed.found.map((e) => e.key)).toEqual([entries.liftingTab.key]);
		expect(parsed.ok && parsed.skipped).toEqual(['app:unknown', entries.coffeeDuration.key]);
	});

	it('rejects files that are not usable backups', () => {
		const error = (text: string) => {
			const parsed = parseBackup(text);
			return parsed.ok ? null : parsed.error;
		};
		expect(error('not json')).toMatch(/not valid JSON/);
		expect(error(JSON.stringify({ app: 'other', schemaVersion: 1, data: {} }))).toMatch(
			/isn't a backup/
		);
		expect(error(JSON.stringify({ app: BACKUP_APP, schemaVersion: 'x', data: {} }))).toMatch(
			/unknown format/
		);
		expect(
			error(JSON.stringify({ app: BACKUP_APP, schemaVersion: SCHEMA_VERSION + 1, data: {} }))
		).toMatch(/newer version/);
	});
});

describe('migration v2', () => {
	it('renames equipment, adds the unit, and moves owned plates into settings', () => {
		store.setItem(VERSION_KEY, '1');
		store.setItem(
			entries.liftingCalculator.key,
			JSON.stringify({
				equipmentId: 'barbell-25',
				mode: 'target',
				symmetric: true,
				sides: [{ 45: 1 }, { 45: 1 }],
				available: [45, 25, 10]
			})
		);
		store.setItem(entries.settings.key, JSON.stringify({ theme: 'dark' }));
		migrate();
		expect(read(entries.liftingCalculator)).toEqual({
			unit: 'lb',
			equipmentId: 'barbell-light',
			mode: 'target',
			symmetric: true,
			sides: [{ 45: 1 }, { 45: 1 }]
		});
		const settings = read(entries.settings)!;
		expect(settings.theme).toBe('dark');
		expect(settings.lifting.plates.lb).toEqual([45, 25, 10]);
		expect(settings.lifting.plates.kg).toEqual(defaultSettings.lifting.plates.kg);
		expect(store.getItem(VERSION_KEY)).toBe('2');
	});

	it('upgrades v1 backups on import too', () => {
		const parsed = parseBackup(
			JSON.stringify({
				app: BACKUP_APP,
				schemaVersion: 1,
				data: { [entries.liftingCalculator.key]: { equipmentId: 'barbell-45', available: [45] } }
			})
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.schemaVersion).toBe(SCHEMA_VERSION);
		expect(parsed.backup.data[entries.liftingCalculator.key]).toEqual({
			unit: 'lb',
			equipmentId: 'barbell'
		});
		expect(
			(parsed.backup.data[entries.settings.key] as typeof defaultSettings).lifting.plates.lb
		).toEqual([45]);
	});
});

describe('tool defaults in settings', () => {
	it('validates each default and falls back per field', () => {
		store.setItem(
			entries.settings.key,
			JSON.stringify({
				coffeeDefaultSeconds: 2,
				cookingPresets: [10, 5, 5, 2],
				pizzaDefaults: { balls: 6, hydration: 'wet' },
				lifting: { unit: 'kg', equipment: 'dumbbells', plates: { kg: [20, 10], lb: [7] } }
			})
		);
		const s = read(entries.settings)!;
		expect(s.coffeeDefaultSeconds).toBe(90);
		expect(s.cookingPresets).toEqual([2, 5, 10]);
		expect(s.pizzaDefaults).toEqual({ ...defaultSettings.pizzaDefaults, balls: 6 });
		expect(s.lifting).toEqual({
			unit: 'kg',
			equipment: 'dumbbells',
			plates: { lb: defaultSettings.lifting.plates.lb, kg: [20, 10] }
		});
	});
});

describe('review fixes', () => {
	it('keeps a workout in the unit it was logged in, and rejects unknown units', () => {
		store.setItem(VERSION_KEY, String(SCHEMA_VERSION));
		const kgWorkout = { date: 'Sun', unit: 'kg', exercises: [] };
		store.setItem(entries.liftingWorkout.key, JSON.stringify(kgWorkout));
		expect(read(entries.liftingWorkout)).toEqual(kgWorkout);
		store.setItem(entries.liftingWorkout.key, JSON.stringify({ ...kgWorkout, unit: 'stone' }));
		expect(read(entries.liftingWorkout)).toBeUndefined();
	});

	it('v2 labels an existing workout as lb', () => {
		store.setItem(VERSION_KEY, '1');
		store.setItem(entries.liftingWorkout.key, JSON.stringify({ date: 'Sat', exercises: [] }));
		migrate();
		expect(JSON.parse(store.getItem(entries.liftingWorkout.key)!).unit).toBe('lb');
	});

	it('forgetLiftingEquipment drops only the remembered equipment', () => {
		write(entries.liftingCalculator, { unit: 'lb', equipmentId: 'dumbbells', mode: 'target' });
		forgetLiftingEquipment();
		expect(read(entries.liftingCalculator)).toEqual({ unit: 'lb', mode: 'target' });
		expect(() => forgetLiftingEquipment()).not.toThrow();
	});

	it('the shared preset check accepts exactly what storage keeps', () => {
		expect(parseCookingPresets([0.05, 5, 10])).toBeUndefined();
		expect(parseCookingPresets([10, 5, 5, 0.5])).toEqual([0.5, 5, 10]);
		expect(parseCookingPresets([])).toBeUndefined();
	});
});

describe('workout history', () => {
	const workout = {
		date: 'Sat',
		unit: 'lb' as const,
		exercises: [{ id: 1, name: 'Squat', sets: [{ id: 2, weight: 225, reps: 5 }] }]
	};

	it('round-trips and keeps valid entries when one is damaged', () => {
		const good = { id: 1, finishedAt: '2026-10-04T12:00:00.000Z', workout };
		write(entries.workoutHistory, [good]);
		expect(read(entries.workoutHistory)).toEqual([good]);
		store.setItem(
			entries.workoutHistory.key,
			JSON.stringify([good, { id: 2, finishedAt: 'x', workout: { date: 1 } }, { id: 'bad' }])
		);
		expect(read(entries.workoutHistory)).toEqual([good]);
	});

	it('is its own group, so clearing the calculator keeps it', () => {
		write(entries.workoutHistory, [{ id: 1, finishedAt: 'x', workout }]);
		write(entries.liftingTab, 'history');
		clear(groups.find((g) => g.id === 'weightlifting')!.entries);
		expect(read(entries.liftingTab)).toBeUndefined();
		expect(read(entries.workoutHistory)).toHaveLength(1);
		expect(groups.find((g) => g.id === 'workout-history')!.label).toBe('Workout History');
	});
});
