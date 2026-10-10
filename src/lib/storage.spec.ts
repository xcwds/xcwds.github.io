import { buildTestApp } from '@xcwds/testing';
import timers from '@xcwds/plugin-timers';
import tools from '@xcwds/plugin-tools';
import type { App, StorageAdapter } from '@xcwds/core';
import app from 'xcwds-app';
import coffeeTimer from 'xcwds-app-coffee-timer';
import cookingTimer from 'xcwds-app-cooking-timer';
import weightlifting from 'xcwds-app-weightlifting';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	KEYS,
	SCHEMA_VERSION,
	clear,
	defaultSettings,
	entries,
	exportData,
	groups as savedGroups,
	importData,
	parseBackup,
	parseCookingPresets,
	parseSettings,
	read,
	remove,
	storageWritable,
	update,
	upgradeData,
	write,
	type Settings
} from './storage';
import { unlimitedPlates as unlimited } from './utils/lifting';

let current: App | undefined;
vi.mock('@xcwds/sveltekit', () => ({
	getApp: () => {
		if (!current) throw new Error('No app; call open() first.');
		return current;
	}
}));

/** The name backups made before @xcwds carry. */
const BACKUP_APP = 'xcwds.com';
/** The app's schema version, in its own namespace. */
const VERSION_KEY = 'app:version';

/** The home gym from #82, as a saved set. */
const HOME = {
	id: 'home',
	name: 'Home gym',
	unit: 'lb',
	bars: [{ id: 'bar', name: 'Barbell (35 lb)', type: 'barbell', weight: 35, count: 1 }],
	plates: { 45: 2, 35: 0, 25: 2, 10: 8, 5: 4, 2.5: 4, 1.25: 4 }
};

/** localStorage as the app sees it: can be made unavailable or full. */
class MemoryStorage implements StorageAdapter {
	map = new Map<string, string>();
	unavailable = false;
	full = false;
	private check() {
		if (this.unavailable) throw new Error('SecurityError');
	}
	get(k: string) {
		this.check();
		return this.map.get(k) ?? null;
	}
	set(k: string, v: string) {
		this.check();
		if (this.full) throw new Error('QuotaExceededError');
		this.map.set(k, String(v));
	}
	remove(k: string) {
		this.check();
		this.map.delete(k);
	}
	keys() {
		this.check();
		return [...this.map.keys()];
	}
	getItem = (k: string) => this.map.get(k) ?? null;
	setItem = (k: string, v: string) => void this.map.set(k, v);
	clear = () => this.map.clear();
}

let store: MemoryStorage;

/**
 * Opens the app (its own plugins and the @xcwds plugins that now own some of its keys) on
 * `store`, which tests seed first: opening it runs the migrations.
 */
async function open(): Promise<App> {
	current = await buildTestApp(
		{
			brand: { name: 'xcwds' },
			storage: { appName: BACKUP_APP },
			plugins: [
				app(),
				tools({ path: '/utils', title: 'Utils', storageKey: KEYS.homeShortcuts }),
				timers({ page: '/utils/cooking-timer', storageKey: KEYS.cookingTimers }),
				coffeeTimer(),
				cookingTimer(),
				weightlifting()
			]
		},
		{ storage: store, import: (id) => import(/* @vite-ignore */ id), logLevel: 'silent' }
	);
	return current;
}

/** The app's settings as saved, parsed like the settings page reads them. */
const savedSettings = (): Settings | undefined => {
	const raw = store.getItem(KEYS.settings);
	return raw === null ? undefined : parseSettings(JSON.parse(raw));
};

const groups = () => savedGroups();

/** An entry an @xcwds plugin registers under one of the app's keys. */
const entryFor = (key: string) => {
	const found = current!.storage.entries().find((e) => e.key === key);
	if (!found) throw new Error(`Nothing registers ${key}`);
	return found;
};

beforeEach(() => {
	store = new MemoryStorage();
	current = undefined;
});

describe('registry', () => {
	it('prefixes every key with app: and keeps keys unique', async () => {
		const keys = (await open()).storage.entries().map((e) => e.key);
		expect(keys.every((k) => k.startsWith('app:'))).toBe(true);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('read / write / remove', () => {
	it('round-trips values and stamps the schema version', async () => {
		await open();
		expect(write(entries.coffeeDuration, 120_000)).toBe(true);
		expect(read(entries.coffeeDuration)).toBe(120_000);
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
		remove(entries.coffeeDuration);
		expect(read(entries.coffeeDuration)).toBeUndefined();
	});

	it('returns undefined for missing, corrupt or invalid data', async () => {
		await open();
		expect(read(entries.liftingWorkout)).toBeUndefined();
		store.setItem(entries.liftingWorkout.key, '{not json');
		expect(read(entries.liftingWorkout)).toBeUndefined();
		store.setItem(entries.liftingWorkout.key, JSON.stringify({ date: 'x' }));
		expect(read(entries.liftingWorkout)).toBeUndefined();
		store.setItem(entries.coffeeDuration.key, '-5');
		expect(read(entries.coffeeDuration)).toBeUndefined();
	});

	it('never throws when storage is unavailable', async () => {
		await open();
		store.unavailable = true;
		expect(read(entries.coffeeDuration)).toBeUndefined();
		expect(write(entries.coffeeDuration, 1)).toBe(false);
		expect(remove(entries.coffeeDuration)).toBe(false);
		expect(storageWritable()).toBe(false);
	});

	it('reports a failed write when storage is full', async () => {
		await open();
		expect(storageWritable()).toBe(true);
		store.full = true;
		expect(write(entries.coffeeDuration, 1)).toBe(false);
		expect(storageWritable()).toBe(false);
	});
});

describe('update', () => {
	const e = {
		key: 'app:test',
		label: 'Test',
		group: 'test',
		namespace: '',
		parse: (v: unknown) => v as number[]
	};
	const push = (n: number) => (latest: number[] | undefined) => [...(latest ?? []), n];

	it('changes the latest saved value, not a stale copy', async () => {
		await open();
		// Another tab saved [1] after this tab last read []; this tab's stale copy is [].
		write(e, [1]);
		expect(update(e, [], push(2))).toEqual({ value: [1, 2], saved: true });
		expect(read(e)).toEqual([1, 2]);
	});

	it('removes the entry when the change returns undefined', async () => {
		await open();
		write(e, [1]);
		expect(update(e, [1], () => undefined)).toEqual({ value: undefined, saved: true });
		expect(store.getItem('app:test')).toBeNull();
	});

	it("changes this tab's copy when storage can't be read, and says it wasn't saved", async () => {
		await open();
		store.unavailable = true;
		expect(update(e, [1], push(2))).toEqual({ value: [1, 2], saved: false });
	});

	it("starts from this tab's copy when it holds changes storage doesn't have", async () => {
		await open();
		write(e, [1]);
		expect(update(e, [1, 5], push(2), { unsaved: true })).toEqual({
			value: [1, 5, 2],
			saved: true
		});
	});

	it('keeps the new value but reports a failed save when storage is full', async () => {
		await open();
		write(e, [1]);
		store.full = true;
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

	it('moves every legacy key to its app: key and removes the old one', async () => {
		seedLegacy();
		await open();
		expect(read(entries.coffeeDuration)).toBe(120_000);
		expect(read(entryFor(KEYS.cookingTimers))).toEqual([rice]);
		// v1 validates legacy keys with today's shape, which no longer has `equipmentId`.
		expect(read(entries.liftingCalculator)).toEqual({ unit: 'lb' });
		expect(read(entries.liftingWorkout)).toEqual({ date: 'Sat', unit: 'lb', exercises: [] });
		expect(read(entries.liftingTab)).toBe('workout');
		expect([...store.map.keys()].filter((k) => !k.startsWith('app:'))).toEqual([]);
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
	});

	it('drops invalid legacy data instead of migrating it', async () => {
		store.setItem('lifting-tab', 'garbage');
		await open();
		expect(read(entries.liftingTab)).toBeUndefined();
		expect(store.getItem('lifting-tab')).toBeNull();
	});

	it('does not overwrite data already under the new key', async () => {
		store.setItem(entries.coffeeDuration.key, '60000');
		store.setItem('coffee-timer-duration', '120000');
		await open();
		expect(read(entries.coffeeDuration)).toBe(60_000);
	});

	it('runs once and leaves data from a newer schema alone', async () => {
		store.setItem(VERSION_KEY, String(SCHEMA_VERSION + 1));
		store.setItem('coffee-timer-duration', '120000');
		await open();
		expect(store.getItem('coffee-timer-duration')).toBe('120000');
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION + 1));
	});
});

describe('validators', () => {
	it('keeps the valid fields of a saved plate calculator', async () => {
		await open();
		store.setItem(VERSION_KEY, String(SCHEMA_VERSION)); // current data: validation only, no migration
		store.setItem(
			entries.liftingCalculator.key,
			JSON.stringify({
				stations: { home: 'bar', '': 'x', gym: 5 },
				mode: 'sideways',
				symmetric: false,
				sides: [{ 45: 1 }, { 7: 2 }],
				available: [45, 25]
			})
		);
		// No unit, so the plate counts can't be trusted and are dropped.
		expect(read(entries.liftingCalculator)).toEqual({
			stations: { home: 'bar' },
			symmetric: false
		});
		store.setItem(
			entries.liftingCalculator.key,
			JSON.stringify({ unit: 'kg', sides: [{ 20: 1 }, { 20: 1 }] })
		);
		expect(read(entries.liftingCalculator)).toEqual({ unit: 'kg', sides: [{ 20: 1 }, { 20: 1 }] });
	});

	it('rejects a workout with malformed exercises or sets', async () => {
		await open();
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

	it('keeps valid cooking timers and drops broken ones', async () => {
		await open();
		const good = { id: 1, label: 'Pasta', state: { duration: 1, endsAt: 5, pausedRemaining: 1 } };
		store.setItem(
			entryFor(KEYS.cookingTimers).key,
			JSON.stringify([good, { id: 2, label: 'x' }, null])
		);
		expect(read(entryFor(KEYS.cookingTimers))).toEqual([good]);
	});
});

describe('home shortcuts entry', () => {
	it('is backed up, and drops tools that no longer exist', async () => {
		await open();
		write(entryFor(KEYS.homeShortcuts), { pins: ['/utils/coffee-timer'], recent: [] });
		expect(exportData().data[entryFor(KEYS.homeShortcuts).key]).toEqual({
			pins: ['/utils/coffee-timer'],
			recent: []
		});
		store.setItem(
			entryFor(KEYS.homeShortcuts).key,
			JSON.stringify({ pins: ['/utils/gone', '/utils/coffee-timer'], recent: ['/utils/gone'] })
		);
		expect(read(entryFor(KEYS.homeShortcuts))).toEqual({
			pins: ['/utils/coffee-timer'],
			recent: []
		});
	});
});

describe('settings entry', () => {
	it('fills missing or invalid fields with defaults', async () => {
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'dark', sound: 'loud' }));
		expect(savedSettings()).toEqual({ ...defaultSettings, theme: 'dark' });
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'neon' }));
		expect(savedSettings()?.theme).toBe('system');
	});

	it('loads the recipe unit system, defaulting to as written (null)', async () => {
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'dark' }));
		expect(savedSettings()?.recipeUnits).toBeNull();
		store.setItem(KEYS.settings, JSON.stringify({ ...defaultSettings, recipeUnits: 'metric' }));
		expect(savedSettings()?.recipeUnits).toBe('metric');
		store.setItem(KEYS.settings, JSON.stringify({ recipeUnits: 'imperial' }));
		expect(savedSettings()?.recipeUnits).toBeNull();
	});

	it('loads the oven unit, defaulting to °F', async () => {
		// Saved before the oven converter existed.
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'dark' }));
		expect(savedSettings()?.ovenUnit).toBe('F');
		store.setItem(KEYS.settings, JSON.stringify({ ...defaultSettings, ovenUnit: 'C' }));
		expect(savedSettings()?.ovenUnit).toBe('C');
		store.setItem(KEYS.settings, JSON.stringify({ ovenUnit: 'K' }));
		expect(savedSettings()?.ovenUnit).toBe('F');
	});

	it('loads the navigation style per orientation, defaulting each one on its own', async () => {
		// Saved before the setting existed.
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'dark' }));
		expect(savedSettings()?.nav).toEqual({ portrait: 'bar', landscape: 'sidebar' });
		store.setItem(
			KEYS.settings,
			JSON.stringify({ ...defaultSettings, nav: { portrait: 'sidebar', landscape: 'bar' } })
		);
		expect(savedSettings()?.nav).toEqual({ portrait: 'sidebar', landscape: 'bar' });
		store.setItem(
			KEYS.settings,
			JSON.stringify({ nav: { portrait: 'sidebar', landscape: 'rail' } })
		);
		expect(savedSettings()?.nav).toEqual({ portrait: 'sidebar', landscape: 'sidebar' });
		store.setItem(KEYS.settings, JSON.stringify({ nav: 'sidebar' }));
		expect(savedSettings()?.nav).toEqual({ portrait: 'bar', landscape: 'sidebar' });
	});
});

describe('groups and clear', () => {
	it('groups entries by tool and clears one group at a time', async () => {
		await open();
		expect(groups().map((g) => g.id)).toEqual([
			'coffee-timer',
			'cooking-timer',
			'weightlifting',
			'workout-history',
			'settings',
			'home'
		]);
		write(entries.coffeeDuration, 1000);
		write(entries.liftingTab, 'workout');
		clear(groups().find((g) => g.id === 'weightlifting')!.entries);
		expect(read(entries.liftingTab)).toBeUndefined();
		expect(read(entries.coffeeDuration)).toBe(1000);
		clear();
		expect(read(entries.coffeeDuration)).toBeUndefined();
	});
});

describe('backups', () => {
	const now = new Date('2026-10-04T12:00:00Z');

	it('exports every valid saved value with metadata', async () => {
		await open();
		write(entries.coffeeDuration, 120_000);
		store.setItem(KEYS.settings, JSON.stringify({ ...defaultSettings, theme: 'dark' }));
		store.setItem(entries.liftingTab.key, '"nonsense"');
		expect(exportData(now)).toEqual({
			app: BACKUP_APP,
			format: 2,
			exportedAt: '2026-10-04T12:00:00.000Z',
			// The app's own version, and those of the @xcwds plugins that hold some of its data.
			versions: { '': SCHEMA_VERSION, tools: 0, timers: 0 },
			data: {
				[entries.coffeeDuration.key]: 120_000,
				[KEYS.settings]: { ...defaultSettings, theme: 'dark' }
			},
			unclaimed: {}
		});
	});

	it('round-trips through parse and import', async () => {
		await open();
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

	it('merge keeps data missing from the backup; replace clears it', async () => {
		await open();
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

	it('skips unknown keys and invalid values', async () => {
		await open();
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
		expect(parsed.ok && parsed.skipped).toEqual([entries.coffeeDuration.key]);
		// Kept aside, in case it belongs to a tool a later version brings back.
		expect(parsed.ok && parsed.backup.unclaimed).toEqual({ 'app:unknown': 1 });
	});

	it('rejects files that are not usable backups', async () => {
		await open();
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
	it('renames equipment, adds the unit, and moves owned plates into settings', async () => {
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
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'dark' }));
		await open();
		// v2 then v3: the owned plates make it "My equipment", remembering the light barbell.
		expect(read(entries.liftingCalculator)).toEqual({
			unit: 'lb',
			stations: { 'my-lb': 'barbell-light' },
			mode: 'target',
			symmetric: true,
			sides: [{ 45: 1 }, { 45: 1 }]
		});
		const settings = savedSettings()!;
		expect(settings.theme).toBe('dark');
		expect(settings.lifting.sets.map((s) => [s.id, s.plates])).toEqual([
			['my-lb', { 45: null, 35: 0, 25: null, 10: null, 5: 0, 2.5: 0, 1.25: 0 }]
		]);
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
	});

	it('upgrades v1 backups on import too', async () => {
		await open();
		const parsed = parseBackup(
			JSON.stringify({
				app: BACKUP_APP,
				schemaVersion: 1,
				data: { [entries.liftingCalculator.key]: { equipmentId: 'barbell-45', available: [45] } }
			})
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.versions['']).toBe(SCHEMA_VERSION);
		expect(parsed.backup.data[entries.liftingCalculator.key]).toEqual({
			unit: 'lb',
			stations: { 'my-lb': 'barbell' }
		});
		const lifting = (parsed.backup.data[KEYS.settings] as typeof defaultSettings).lifting;
		expect(lifting.activeSet).toBe('my-lb');
		expect(lifting.sets[0].plates).toEqual({
			45: null,
			35: 0,
			25: 0,
			10: 0,
			5: 0,
			2.5: 0,
			1.25: 0
		});
	});
});

describe('tool defaults in settings', () => {
	it('validates each default and falls back per field', async () => {
		store.setItem(
			KEYS.settings,
			JSON.stringify({
				coffeeDefaultSeconds: 2,
				cookingPresets: [10, 5, 5, 2],
				pizzaDefaults: { balls: 6, hydration: 'wet' },
				lifting: {
					unit: 'kg',
					activeSet: 'gone',
					sets: [HOME, { ...HOME, name: 'Copy' }, { ...HOME, id: 'commercial' }, { id: 'x' }]
				}
			})
		);
		const s = savedSettings()!;
		expect(s.coffeeDefaultSeconds).toBe(90);
		expect(s.cookingPresets).toEqual([2, 5, 10]);
		expect(s.pizzaDefaults).toEqual({ ...defaultSettings.pizzaDefaults, balls: 6 });
		// Repeated and unusable sets are dropped; an unknown active set is the commercial gym.
		expect(s.lifting).toEqual({ unit: 'kg', activeSet: 'commercial', sets: [HOME] });
	});

	it('keeps an active set that exists', async () => {
		store.setItem(KEYS.settings, JSON.stringify({ lifting: { activeSet: 'home', sets: [HOME] } }));
		expect(savedSettings()!.lifting).toEqual({
			unit: 'lb',
			activeSet: 'home',
			sets: [HOME]
		});
	});
});

describe('migration v3: equipment sets (#82)', () => {
	const v2 = async (settings: object | undefined, calc?: object) => {
		store.setItem(VERSION_KEY, '2');
		if (settings) store.setItem(KEYS.settings, JSON.stringify(settings));
		if (calc) store.setItem(entries.liftingCalculator.key, JSON.stringify(calc));
		await open();
		return { settings: savedSettings(), calc: read(entries.liftingCalculator) };
	};

	it('leaves an untouched commercial-gym setup as the commercial gym', async () => {
		const { settings, calc } = await v2(
			{ theme: 'dark', lifting: { unit: 'kg', equipment: 'barbell' } },
			{ unit: 'kg', equipmentId: 'barbell', mode: 'load' }
		);
		expect(settings!.theme).toBe('dark');
		expect(settings!.lifting).toEqual({ unit: 'kg', activeSet: 'commercial', sets: [] });
		expect(calc).toEqual({ unit: 'kg', stations: { commercial: 'barbell' }, mode: 'load' });
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
	});

	it('writes nothing for someone who never saved settings', async () => {
		await v2(undefined);
		expect(store.getItem(KEYS.settings)).toBeNull();
	});

	it('turns owned plates and #71 setups into "My equipment", with each bar as it was', async () => {
		const { settings, calc } = await v2(
			{
				lifting: {
					unit: 'lb',
					equipment: 'barbell',
					plates: { lb: [45, 25, 10, 5, 2.5, 1.25], kg: [25, 20, 15, 10, 5, 2.5, 1.25] },
					setups: {
						lb: {
							barbell: { bar: 35, maxLoad: 300 },
							dumbbells: { maxPlatesPerSide: 3, bar: 4 },
							dumbbell: { bar: 5, plates: [10, 5] },
							kettlebell: { bar: -3, plates: [10], maxPlatesPerSide: 4 }
						},
						kg: {}
					}
				}
			},
			{ unit: 'lb', equipmentId: 'dumbbells' }
		);
		expect(settings!.lifting.activeSet).toBe('my-lb');
		expect(settings!.lifting.sets).toEqual([
			{
				id: 'my-lb',
				name: 'My equipment',
				unit: 'lb',
				bars: [
					{
						id: 'barbell',
						name: 'Barbell (35 lb)',
						type: 'barbell',
						weight: 35,
						count: 1,
						maxLoad: 300
					},
					{ id: 'barbell-light', name: 'Barbell (25 lb)', type: 'barbell', weight: 25, count: 1 },
					// The single dumbbell's setup wins; the pair's fills in what it leaves out.
					{
						id: 'dumbbell',
						name: 'Dumbbell',
						type: 'dumbbell',
						weight: 5,
						count: 2,
						maxPlatesPerSide: 3,
						plates: [10, 5]
					},
					// An invalid bar weight keeps v2's built-in one.
					{
						id: 'kettlebell',
						name: 'Kettlebell',
						type: 'kettlebell',
						weight: 5,
						count: 1,
						maxPlatesPerSide: 4,
						plates: [10]
					}
				],
				plates: { 45: null, 35: 0, 25: null, 10: null, 5: null, 2.5: null, 1.25: null }
			}
		]);
		expect(calc).toEqual({ unit: 'lb', stations: { 'my-lb': 'dumbbell:pair' } });
	});

	it('keeps a station the commercial gym no longer has', async () => {
		const { settings, calc } = await v2({ lifting: { unit: 'kg', equipment: 'kettlebell' } });
		expect(settings!.lifting.activeSet).toBe('my-kg');
		expect(settings!.lifting.sets[0].bars.map((b) => b.weight)).toEqual([20, 15, 2.5, 2.5]);
		expect(settings!.lifting.sets[0].plates).toEqual(unlimited('kg'));
		expect(calc).toBeUndefined();
	});

	it('makes one set per customized unit, active in the unit you used', async () => {
		const { settings, calc } = await v2(
			{ lifting: { unit: 'lb', plates: { lb: [45, 10], kg: [20] } } },
			{ equipmentId: 'kettlebell' }
		);
		expect(settings!.lifting.sets.map((s) => [s.id, s.name])).toEqual([
			['my-lb', 'My equipment (lb)'],
			['my-kg', 'My equipment (kg)']
		]);
		expect(settings!.lifting.activeSet).toBe('my-lb');
		expect(calc).toEqual({ stations: { 'my-lb': 'kettlebell' } });

		// Only the other unit customized: that set is made, but the commercial gym stays active.
		store.clear();
		const other = await v2(
			{ lifting: { unit: 'lb', plates: { kg: [20] } } },
			{ equipmentId: 'barbell' }
		);
		expect(other.settings!.lifting.sets.map((s) => s.id)).toEqual(['my-kg']);
		expect(other.settings!.lifting.activeSet).toBe('commercial');
		expect(other.calc).toEqual({ stations: { commercial: 'barbell' } });
	});

	it('leaves data that already has sets alone', async () => {
		const settings = { lifting: { unit: 'lb', activeSet: 'home', sets: [HOME] } };
		const data: Record<string, unknown> = { [KEYS.settings]: structuredClone(settings) };
		upgradeData(data, 2);
		expect(data[KEYS.settings]).toEqual(settings);
	});
});

describe('review fixes', () => {
	it('keeps a workout in the unit it was logged in, and rejects unknown units', async () => {
		await open();
		store.setItem(VERSION_KEY, String(SCHEMA_VERSION));
		const kgWorkout = { date: 'Sun', unit: 'kg', exercises: [] };
		store.setItem(entries.liftingWorkout.key, JSON.stringify(kgWorkout));
		expect(read(entries.liftingWorkout)).toEqual(kgWorkout);
		store.setItem(entries.liftingWorkout.key, JSON.stringify({ ...kgWorkout, unit: 'stone' }));
		expect(read(entries.liftingWorkout)).toBeUndefined();
	});

	it('v2 labels an existing workout as lb', async () => {
		store.setItem(VERSION_KEY, '1');
		store.setItem(entries.liftingWorkout.key, JSON.stringify({ date: 'Sat', exercises: [] }));
		await open();
		expect(JSON.parse(store.getItem(entries.liftingWorkout.key)!).unit).toBe('lb');
	});

	it('the shared preset check accepts exactly what storage keeps', async () => {
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

	it('round-trips and keeps valid entries when one is damaged', async () => {
		await open();
		const good = { id: 1, finishedAt: '2026-10-04T12:00:00.000Z', workout };
		write(entries.workoutHistory, [good]);
		expect(read(entries.workoutHistory)).toEqual([good]);
		store.setItem(
			entries.workoutHistory.key,
			JSON.stringify([good, { id: 2, finishedAt: 'x', workout: { date: 1 } }, { id: 'bad' }])
		);
		expect(read(entries.workoutHistory)).toEqual([good]);
	});

	it('is its own group, so clearing the calculator keeps it', async () => {
		await open();
		write(entries.workoutHistory, [{ id: 1, finishedAt: 'x', workout }]);
		write(entries.liftingTab, 'history');
		clear(groups().find((g) => g.id === 'weightlifting')!.entries);
		expect(read(entries.liftingTab)).toBeUndefined();
		expect(read(entries.workoutHistory)).toHaveLength(1);
		expect(groups().find((g) => g.id === 'workout-history')!.label).toBe('Workout History');
	});
});

describe('migration v4: the move onto @xcwds', () => {
	it('moves the alarm settings into the timers plugin alarm field', async () => {
		store.setItem(VERSION_KEY, '3');
		store.setItem(
			KEYS.settings,
			JSON.stringify({ theme: 'dark', sound: false, vibration: true, keepAwake: false })
		);
		await open();
		expect(JSON.parse(store.getItem(KEYS.settings)!)).toEqual({
			theme: 'dark',
			alarm: { sound: false, vibration: true, keepAwake: false }
		});
		expect(current!.settings.get().alarm).toEqual({
			sound: false,
			vibration: true,
			keepAwake: false
		});
		expect(store.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
	});

	it('leaves settings without alarm fields as they were', async () => {
		store.setItem(VERSION_KEY, '3');
		store.setItem(KEYS.settings, JSON.stringify({ theme: 'dark' }));
		await open();
		expect(JSON.parse(store.getItem(KEYS.settings)!)).toEqual({ theme: 'dark' });
	});

	it('imports a backup the app made before @xcwds', async () => {
		await open();
		const parsed = parseBackup(
			JSON.stringify({
				app: BACKUP_APP,
				schemaVersion: 3,
				exportedAt: '2026-10-04T12:00:00.000Z',
				data: {
					[KEYS.settings]: { theme: 'dark', sound: false },
					[KEYS.cookingTimers]: [
						{ id: 1, label: 'Rice', state: { duration: 1, endsAt: null, pausedRemaining: 1 } }
					],
					[KEYS.homeShortcuts]: { pins: ['/utils/coffee-timer'], recent: [] },
					[entries.coffeeDuration.key]: 120_000
				}
			})
		);
		if (!parsed.ok) throw new Error(parsed.error);
		expect(parsed.skipped).toEqual([]);
		expect(importData(parsed.backup, 'replace')).toBe(true);
		const app = await open();
		expect(app.settings.get().alarm.sound).toBe(false);
		expect(savedSettings()?.theme).toBe('dark');
		expect(read(entryFor(KEYS.cookingTimers))).toHaveLength(1);
		expect(read(entryFor(KEYS.homeShortcuts))).toEqual({
			pins: ['/utils/coffee-timer'],
			recent: []
		});
		expect(read(entries.coffeeDuration)).toBe(120_000);
	});
});
