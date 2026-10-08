import { doughDefaults, isDoughValue, type DoughInput } from '$lib/utils/dough';
import type { TempUnit } from '$lib/utils/oven';
import type { UnitSystem } from '$lib/recipes/units';
import { parseShortcuts, type HomeShortcuts } from '$lib/home';
import { tools } from '$lib/utils/tools';
import {
	EQUIPMENT_IDS,
	parseEquipmentSetup,
	UNITS,
	type EquipmentId,
	type EquipmentSetups,
	type HistoryEntry,
	type PlateCounts,
	type WeightUnit,
	type Workout
} from '$lib/utils/lifting';

/**
 * The one place the app reads and writes browser storage. Every saved value is registered
 * below with an `app:` key, a validator and (for data saved before this module existed) the
 * legacy key it is migrated from. Reads never throw: missing, corrupt or invalid data, or
 * storage being unavailable (private mode, blocked site data), all return `undefined`.
 */

export type Entry<T> = {
	/** Storage key, always prefixed with `app:`. */
	key: string;
	/** Human-readable description, for settings/export screens. */
	label: string;
	/** Returns the value if `raw` is valid for this entry, otherwise undefined. */
	parse: (raw: unknown) => T | undefined;
	/** Key this value lived under before the storage module (migration v1). */
	legacyKey?: string;
};

export const PREFIX = 'app:';
export const VERSION_KEY = `${PREFIX}version`;
/** Bump when adding a migration below. */
export const SCHEMA_VERSION = 2;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

export type SavedCookingTimer = {
	id: number;
	label: string;
	state: { duration: number; endsAt: number | null; pausedRemaining: number };
};

const isTimerState = (v: unknown): v is SavedCookingTimer['state'] =>
	isRecord(v) &&
	typeof v.duration === 'number' &&
	typeof v.pausedRemaining === 'number' &&
	(v.endsAt === null || typeof v.endsAt === 'number');

const isSavedCookingTimer = (v: unknown): v is SavedCookingTimer =>
	isRecord(v) && typeof v.id === 'number' && typeof v.label === 'string' && isTimerState(v.state);

export type LiftingCalculatorState = {
	/** Unit the plate counts in `sides` are in. */
	unit: WeightUnit;
	equipmentId: EquipmentId;
	mode: 'load' | 'target';
	symmetric: boolean;
	sides: PlateCounts[];
};

const isUnit = (v: unknown): v is WeightUnit => v === 'lb' || v === 'kg';
const isEquipmentId = (v: unknown): v is EquipmentId => EQUIPMENT_IDS.includes(v as EquipmentId);

const isPlateCountsFor = (unit: WeightUnit) => (v: unknown) =>
	isRecord(v) &&
	Object.entries(v).every(
		([plate, n]) => UNITS[unit].plates.includes(Number(plate)) && typeof n === 'number' && n >= 0
	);

/** Fields that fail validation are dropped; the calculator keeps its default for them. */
function parseLiftingCalculator(v: unknown): Partial<LiftingCalculatorState> | undefined {
	if (!isRecord(v)) return undefined;
	const out: Partial<LiftingCalculatorState> = {};
	if (isUnit(v.unit)) out.unit = v.unit;
	if (isEquipmentId(v.equipmentId)) out.equipmentId = v.equipmentId;
	if (v.mode === 'load' || v.mode === 'target') out.mode = v.mode;
	if (typeof v.symmetric === 'boolean') out.symmetric = v.symmetric;
	// Plate counts only mean something in a known unit.
	if (
		out.unit &&
		Array.isArray(v.sides) &&
		v.sides.length === 2 &&
		v.sides.every(isPlateCountsFor(out.unit))
	)
		out.sides = v.sides;
	return out;
}

const isSet = (v: unknown) =>
	isRecord(v) &&
	typeof v.id === 'number' &&
	(v.weight === null || typeof v.weight === 'number') &&
	(v.reps === null || typeof v.reps === 'number');

function parseWorkout(v: unknown): Workout | undefined {
	if (!isRecord(v) || typeof v.date !== 'string' || !Array.isArray(v.exercises)) return undefined;
	if (v.unit !== undefined && !isUnit(v.unit)) return undefined;
	const valid = v.exercises.every(
		(e) =>
			isRecord(e) &&
			typeof e.id === 'number' &&
			typeof e.name === 'string' &&
			Array.isArray(e.sets) &&
			e.sets.every(isSet)
	);
	// Workouts logged before units existed were in lb.
	return valid ? ({ ...v, unit: v.unit ?? 'lb' } as Workout) : undefined;
}

/** Keeps every valid entry, so one damaged workout doesn't lose the whole history. */
function parseHistory(v: unknown): HistoryEntry[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out: HistoryEntry[] = [];
	for (const item of v) {
		if (!isRecord(item) || typeof item.id !== 'number' || typeof item.finishedAt !== 'string')
			continue;
		const workout = parseWorkout(item.workout);
		if (workout) out.push({ id: item.id, finishedAt: item.finishedAt, workout });
	}
	return out;
}

export type Theme = 'system' | 'light' | 'dark';

export type LiftingSettings = {
	/** lb or kg, for the weightlifting calculator only (pizza dough is always grams). */
	unit: WeightUnit;
	/** Equipment selected when the calculator has nothing saved. */
	equipment: EquipmentId;
	/** Plates you have, per unit; target mode only uses these. */
	plates: Record<WeightUnit, number[]>;
	/** Your own bars, handles and their limits, per unit (none: commercial-gym defaults, #71). */
	setups: EquipmentSetups;
};

export type Settings = {
	theme: Theme;
	/** Alarm beeps for the coffee and cooking timers. */
	sound: boolean;
	/** Alarm vibration, where the device supports it. */
	vibration: boolean;
	/** Keep the screen on while a timer runs. */
	keepAwake: boolean;
	/** Coffee timer starting point and "Back to" duration, in seconds. */
	coffeeDefaultSeconds: number;
	/** Cooking timer quick-start buttons, in minutes. */
	cookingPresets: number[];
	/** Pizza dough calculator starting values (grams and baker's percentages). */
	pizzaDefaults: DoughInput;
	lifting: LiftingSettings;
	/** °F or °C, for the oven time converter (and its panel on recipes). */
	ovenUnit: TempUnit;
	/** US or metric for recipe ingredients; null shows each recipe as written. */
	recipeUnits: UnitSystem | null;
};

export const defaultSettings: Settings = {
	theme: 'system',
	sound: true,
	vibration: true,
	keepAwake: true,
	coffeeDefaultSeconds: 90,
	cookingPresets: [1, 3, 5, 10, 15, 20, 30, 45, 60],
	pizzaDefaults: { ...doughDefaults },
	lifting: {
		unit: 'lb',
		equipment: 'barbell',
		plates: { lb: [...UNITS.lb.plates], kg: [...UNITS.kg.plates] },
		setups: { lb: {}, kg: {} }
	},
	ovenUnit: 'F',
	recipeUnits: null
};

export const COFFEE_SECONDS = { min: 5, max: 3600 };
export const COOKING_PRESETS = { max: 12, minMinutes: 0.1, maxMinutes: 24 * 60 };

const isNumberIn = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Valid presets, de-duplicated and sorted, or undefined. Settings uses this to check input too. */
export function parseCookingPresets(v: unknown): number[] | undefined {
	if (!Array.isArray(v) || v.length === 0 || v.length > COOKING_PRESETS.max) return undefined;
	if (!v.every((m) => isNumberIn(m, COOKING_PRESETS.minMinutes, COOKING_PRESETS.maxMinutes)))
		return undefined;
	return [...new Set(v as number[])].sort((a, b) => a - b);
}

function parsePizzaDefaults(v: unknown): DoughInput {
	const out = { ...doughDefaults };
	if (!isRecord(v)) return out;
	for (const key of Object.keys(doughDefaults) as (keyof DoughInput)[]) {
		if (isDoughValue(v[key])) out[key] = v[key];
	}
	return out;
}

function parseLiftingSettings(v: unknown): LiftingSettings {
	const d = defaultSettings.lifting;
	if (!isRecord(v)) return structuredClone(d);
	const plates = isRecord(v.plates) ? v.plates : {};
	const platesFor = (unit: WeightUnit) => {
		const list = plates[unit];
		return Array.isArray(list) && list.every((p) => UNITS[unit].plates.includes(p))
			? UNITS[unit].plates.filter((p) => list.includes(p))
			: [...d.plates[unit]];
	};
	const setups = isRecord(v.setups) ? v.setups : {};
	const setupsFor = (unit: WeightUnit) => {
		const saved = isRecord(setups[unit]) ? setups[unit] : {};
		const out: EquipmentSetups[WeightUnit] = {};
		for (const id of EQUIPMENT_IDS) {
			const setup = parseEquipmentSetup(unit, id, saved[id]);
			if (setup) out[id] = setup;
		}
		return out;
	};
	return {
		unit: isUnit(v.unit) ? v.unit : d.unit,
		equipment: isEquipmentId(v.equipment) ? v.equipment : d.equipment,
		plates: { lb: platesFor('lb'), kg: platesFor('kg') },
		setups: { lb: setupsFor('lb'), kg: setupsFor('kg') }
	};
}

/** Invalid or missing fields fall back to their defaults, so new settings need no migration. */
function parseSettings(v: unknown): Settings | undefined {
	if (!isRecord(v)) return undefined;
	const bool = (key: 'sound' | 'vibration' | 'keepAwake') =>
		typeof v[key] === 'boolean' ? (v[key] as boolean) : defaultSettings[key];
	return {
		theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
		sound: bool('sound'),
		vibration: bool('vibration'),
		keepAwake: bool('keepAwake'),
		coffeeDefaultSeconds: isNumberIn(v.coffeeDefaultSeconds, COFFEE_SECONDS.min, COFFEE_SECONDS.max)
			? Math.round(v.coffeeDefaultSeconds)
			: defaultSettings.coffeeDefaultSeconds,
		cookingPresets: parseCookingPresets(v.cookingPresets) ?? [...defaultSettings.cookingPresets],
		pizzaDefaults: parsePizzaDefaults(v.pizzaDefaults),
		lifting: parseLiftingSettings(v.lifting),
		ovenUnit: v.ovenUnit === 'C' ? 'C' : 'F',
		recipeUnits: v.recipeUnits === 'us' || v.recipeUnits === 'metric' ? v.recipeUnits : null
	};
}

function entry<T>(
	key: string,
	label: string,
	parse: Entry<T>['parse'],
	legacyKey?: string
): Entry<T> {
	return { key: `${PREFIX}${key}`, label, parse, legacyKey };
}

export const entries = {
	coffeeDuration: entry<number>(
		'coffee-timer:duration',
		'Coffee timer duration',
		(v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined),
		'coffee-timer-duration'
	),
	// A brew in progress (from Start until it's reset), so leaving the page doesn't lose it.
	coffeeBrew: entry<SavedCookingTimer['state']>(
		'coffee-timer:brew',
		'Coffee timer countdown',
		(v) => (isTimerState(v) ? v : undefined)
	),
	cookingTimers: entry<SavedCookingTimer[]>(
		'cooking-timer:timers',
		'Cooking timers',
		// Keep the valid timers rather than dropping the whole list over one bad item.
		(v) => (Array.isArray(v) ? v.filter(isSavedCookingTimer) : undefined),
		'cooking-timers'
	),
	liftingCalculator: entry<Partial<LiftingCalculatorState>>(
		'weightlifting:calculator',
		'Weightlifting plate calculator',
		parseLiftingCalculator,
		'lifting-calculator'
	),
	liftingWorkout: entry<Workout>(
		'weightlifting:workout',
		'Weightlifting workout',
		parseWorkout,
		'lifting-workout'
	),
	liftingTab: entry<'plates' | 'workout' | 'history'>(
		'weightlifting:tab',
		'Weightlifting last tab',
		(v) => (v === 'plates' || v === 'workout' || v === 'history' ? v : undefined),
		'lifting-tab'
	),
	// Its own group, so clearing the calculator's data in Settings never wipes past workouts.
	workoutHistory: entry<HistoryEntry[]>('workout-history', 'Workout history', parseHistory),
	settings: entry<Settings>('settings', 'Settings', parseSettings),
	// Tools pinned to Home and the recently opened ones; unknown or private tools are dropped.
	homeShortcuts: entry<HomeShortcuts>('home:shortcuts', 'Home shortcuts', (v) =>
		parseShortcuts(v, tools)
	),
	// Newest changelog entry seen in Settings → What's new. Only written after an update, so a
	// fresh install stores nothing (and sees no "New" badges).
	whatsNewSeen: entry<number>('settings:whats-new-seen', "What's new last seen", (v) =>
		Number.isInteger(v) && (v as number) >= 0 ? (v as number) : undefined
	)
} satisfies Record<string, Entry<unknown>>;

export const allEntries: Entry<unknown>[] = Object.values(entries);

/** Entries are grouped by the first segment of their key (`app:<group>:...`). */
const GROUP_LABELS: Record<string, string> = {
	'coffee-timer': 'Coffee Timer',
	'cooking-timer': 'Cooking Timer',
	weightlifting: 'Weightlifting Calculator',
	'workout-history': 'Workout History',
	home: 'Home shortcuts',
	settings: 'Settings'
};

export type Group = { id: string; label: string; entries: Entry<unknown>[] };

export function groupOf(e: Entry<unknown>): string {
	return e.key.slice(PREFIX.length).split(':')[0];
}

export const groups: Group[] = [...new Set(allEntries.map(groupOf))].map((id) => ({
	id,
	label: GROUP_LABELS[id] ?? id,
	entries: allEntries.filter((e) => groupOf(e) === id)
}));

function storage(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

/** Values written before this module were JSON, except a few raw strings (e.g. `workout`). */
function decode(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

const RENAMED_EQUIPMENT: Record<string, EquipmentId> = {
	'barbell-45': 'barbell',
	'barbell-25': 'barbell-light'
};

/**
 * Upgrades saved values (keyed by storage key) from schema version `from` to the current one,
 * in place. Used for this device's storage and for importing older backups.
 */
export function upgradeData(data: Record<string, unknown>, from: number): void {
	if (from < 2) {
		// v2: the calculator gains a unit, equipment ids stop naming lb weights, and the plates you
		// have move from the calculator into settings (per unit).
		const workoutKey = entries.liftingWorkout.key;
		if (isRecord(data[workoutKey]) && !('unit' in (data[workoutKey] as object)))
			data[workoutKey] = { ...(data[workoutKey] as object), unit: 'lb' };
		const calcKey = entries.liftingCalculator.key;
		const settingsKey = entries.settings.key;
		const calc = data[calcKey];
		if (isRecord(calc)) {
			const next: Record<string, unknown> = { ...calc, unit: 'lb' };
			if (typeof calc.equipmentId === 'string')
				next.equipmentId = RENAMED_EQUIPMENT[calc.equipmentId] ?? calc.equipmentId;
			delete next.available;
			data[calcKey] = next;
			if (Array.isArray(calc.available)) {
				const settings = isRecord(data[settingsKey]) ? data[settingsKey] : {};
				const lifting = isRecord(settings.lifting) ? settings.lifting : {};
				const plates = isRecord(lifting.plates) ? lifting.plates : {};
				data[settingsKey] = {
					...settings,
					lifting: { ...lifting, plates: { ...plates, lb: calc.available } }
				};
			}
		}
	}
}

type Migration = { to: number; run: (store: Storage) => void };

const migrations: Migration[] = [
	{
		// v1: move pre-storage-module keys to `app:` keys.
		to: 1,
		run(store) {
			for (const e of allEntries) {
				if (!e.legacyKey) continue;
				const legacy = store.getItem(e.legacyKey);
				if (legacy === null) continue;
				const value = e.parse(decode(legacy));
				if (value !== undefined && store.getItem(e.key) === null) {
					store.setItem(e.key, JSON.stringify(value));
				}
				store.removeItem(e.legacyKey);
			}
		}
	},
	{
		to: 2,
		run(store) {
			const data: Record<string, unknown> = {};
			const keys = [
				entries.liftingCalculator.key,
				entries.settings.key,
				entries.liftingWorkout.key
			];
			for (const key of keys) {
				const text = store.getItem(key);
				if (text !== null) data[key] = decode(text);
			}
			upgradeData(data, 1);
			for (const [key, value] of Object.entries(data)) store.setItem(key, JSON.stringify(value));
		}
	}
];

let migrated = false;

/** Runs pending migrations once per page load. Data from a newer schema is left untouched. */
export function migrate(): void {
	if (migrated) return;
	const store = storage();
	if (!store) return;
	try {
		const current = Number(store.getItem(VERSION_KEY) ?? 0) || 0;
		if (current < SCHEMA_VERSION) {
			for (const m of migrations) if (m.to > current) m.run(store);
			store.setItem(VERSION_KEY, String(SCHEMA_VERSION));
		}
		migrated = true;
	} catch {
		// Storage full or blocked; try again next time.
	}
}

export function read<T>(e: Entry<T>): T | undefined {
	migrate();
	try {
		const text = storage()?.getItem(e.key);
		return text == null ? undefined : e.parse(decode(text));
	} catch {
		return undefined;
	}
}

/** Saves a value; returns false if it couldn't be stored (unavailable, full). */
export function write<T>(e: Entry<T>, value: T): boolean {
	migrate();
	try {
		const store = storage();
		if (!store) return false;
		store.setItem(e.key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

/** Removes a value; returns false if storage is unavailable. */
export function remove(e: Entry<unknown>): boolean {
	try {
		const store = storage();
		if (!store) return false;
		store.removeItem(e.key);
		return true;
	} catch {
		return false;
	}
}

/** The value `update()` starts from: what's saved, or `current` when storage can't be used. */
export function latest<T>(
	e: Entry<T>,
	current: T | undefined,
	{ unsaved = false }: { unsaved?: boolean } = {}
): T | undefined {
	return storage() && !unsaved ? read(e) : current;
}

/**
 * Applies `change` to the latest saved value and saves the result, so a change made in one tab
 * never overwrites what another tab saved meanwhile. `current` (this tab's copy) is changed
 * instead when storage can't be read, or when `unsaved` says this tab holds changes storage
 * doesn't have (its last write failed), which starting from storage would lose. `undefined`
 * removes the entry. Returns the new value and whether it was saved.
 */
export function update<T>(
	e: Entry<T>,
	current: T | undefined,
	change: (latest: T | undefined) => T | undefined,
	{ unsaved = false }: { unsaved?: boolean } = {}
): { value: T | undefined; saved: boolean } {
	const value = change(latest(e, current, { unsaved }));
	const saved = value === undefined ? remove(e) : write(e, value);
	return { value, saved };
}

const PROBE_KEY = `${PREFIX}probe`;

/** Whether this browser lets the app save at all (false in blocked or full storage). */
export function storageWritable(): boolean {
	try {
		const store = storage();
		if (!store) return false;
		store.setItem(PROBE_KEY, '1');
		store.removeItem(PROBE_KEY);
		return true;
	} catch {
		return false;
	}
}

/**
 * Forgets the equipment last picked in the weightlifting calculator, so it opens with the
 * default from Settings again. Called when that default changes.
 */
export function forgetLiftingEquipment(): void {
	const calc = read(entries.liftingCalculator);
	if (calc?.equipmentId === undefined) return;
	const rest = { ...calc };
	delete rest.equipmentId;
	write(entries.liftingCalculator, rest);
}

/** Removes the given entries (default: everything the app saves). */
export function clear(list: Entry<unknown>[] = allEntries): void {
	for (const e of list) remove(e);
}

// --- Backups -----------------------------------------------------------------------------

export const BACKUP_APP = 'xcwds.com';

export type Backup = {
	app: typeof BACKUP_APP;
	schemaVersion: number;
	exportedAt: string;
	/** Saved values keyed by storage key. */
	data: Record<string, unknown>;
};

/** Everything currently saved, as a backup object. Invalid values are left out. */
export function exportData(now = new Date()): Backup {
	const data: Record<string, unknown> = {};
	for (const e of allEntries) {
		const value = read(e);
		if (value !== undefined) data[e.key] = value;
	}
	return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export type ParsedBackup =
	| {
			ok: true;
			backup: Backup;
			/** Entries the backup has valid data for. */
			found: Entry<unknown>[];
			/** Keys in the backup that are unknown or failed validation; they won't be imported. */
			skipped: string[];
	  }
	| { ok: false; error: string };

export function parseBackup(text: string): ParsedBackup {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: "This file isn't a backup (it's not valid JSON)." };
	}
	if (!isRecord(raw) || raw.app !== BACKUP_APP || !isRecord(raw.data)) {
		return { ok: false, error: "This file isn't a backup from this site." };
	}
	const version = raw.schemaVersion;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
		return { ok: false, error: 'This backup has an unknown format version.' };
	}
	if (version > SCHEMA_VERSION) {
		return {
			ok: false,
			error: 'This backup is from a newer version of the app. Update the app and try again.'
		};
	}
	const upgraded = structuredClone(raw.data);
	upgradeData(upgraded, version);
	const data: Record<string, unknown> = {};
	const found: Entry<unknown>[] = [];
	const skipped: string[] = [];
	for (const [key, value] of Object.entries(upgraded)) {
		const e = allEntries.find((x) => x.key === key);
		const parsed = e?.parse(value);
		if (e && parsed !== undefined) {
			data[key] = parsed;
			found.push(e);
		} else {
			skipped.push(key);
		}
	}
	const backup: Backup = {
		app: BACKUP_APP,
		schemaVersion: SCHEMA_VERSION,
		exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
		data
	};
	return { ok: true, backup, found, skipped };
}

/**
 * Applies a parsed backup. `replace` clears everything first; `merge` only overwrites the
 * entries the backup contains and keeps the rest. Returns false if anything failed to save.
 */
export function importData(backup: Backup, mode: 'replace' | 'merge'): boolean {
	if (mode === 'replace') clear();
	let ok = true;
	for (const e of allEntries) {
		if (e.key in backup.data) ok = write(e, backup.data[e.key]) && ok;
	}
	return ok;
}

/** For tests: forget that migrations already ran. */
export function resetMigrationState(): void {
	migrated = false;
}
