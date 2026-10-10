import { doughDefaults, isDoughValue, type DoughInput } from '$lib/utils/dough';
import type { TempUnit } from '$lib/utils/oven';
import type { UnitSystem } from '$lib/recipes/units';
import type { Entry as KernelEntry, Migration, StorageScope } from '@xcwds/core';
import { getApp } from '@xcwds/sveltekit';
import {
	COMMERCIAL_GYM,
	SETUP_LIMITS,
	UNITS,
	WEIGHT_UNITS,
	barName,
	parseBar,
	parseEquipmentSet,
	type Bar,
	type BarType,
	type EquipmentSet,
	type HistoryEntry,
	type LiftingSetup,
	type PlateCounts,
	type WeightUnit,
	type Workout
} from '$lib/utils/lifting';

/**
 * The app's saved data: every value it saves, registered with the @xcwds kernel (`app.storage`)
 * under the keys it had before the move onto @xcwds, with a validator and, for data saved before
 * the storage module existed, the legacy key it is migrated from. The app's own plugins
 * (`src/plugins/`) register these entries and the migrations below in the app's namespace (`''`,
 * versioned as `app:version`). Reads never throw: missing, corrupt or invalid data, or storage
 * being unavailable (private mode, blocked site data), all return `undefined`.
 */

export type Entry<T> = KernelEntry<T> & {
	/** Key this value lived under before the storage module (migration v1). */
	readonly legacyKey?: string;
};

export const PREFIX = 'app:';
/** The app's schema version (`app:version`): the newest migration below. */
export const SCHEMA_VERSION = 4;

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
	/** The station last picked in each equipment set (set id → station id, #82). */
	stations: Record<string, string>;
	mode: 'load' | 'target';
	symmetric: boolean;
	sides: PlateCounts[];
};

const isUnit = (v: unknown): v is WeightUnit => v === 'lb' || v === 'kg';
const isId = (v: unknown): v is string =>
	typeof v === 'string' && v.length > 0 && v.length <= 2 * SETUP_LIMITS.maxName;

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
	if (isRecord(v.stations)) {
		const picked = Object.entries(v.stations).filter(([set, id]) => isId(set) && isId(id));
		out.stations = Object.fromEntries(picked) as Record<string, string>;
	}
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
/** Main navigation on tablets and computers: header links ("bar") or a left sidebar. */
export type NavStyle = 'bar' | 'sidebar';

/** Equipment sets and the active one (#82); the unit is the commercial gym's lb or kg. */
export type LiftingSettings = LiftingSetup;

/** How a finished timer gets your attention (`@xcwds/plugin-timers`' `alarm` field). */
export type Alarm = {
	/** Alarm beeps for the coffee and cooking timers. */
	sound: boolean;
	/** Alarm vibration, where the device supports it. */
	vibration: boolean;
	/** Keep the screen on while a timer runs. */
	keepAwake: boolean;
};

/**
 * Every settings field the app uses (`app:settings`): the theme, navigation and alarm come from
 * @xcwds plugins, the rest from the app's own plugins.
 */
export type Settings = {
	theme: Theme;
	alarm: Alarm;
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
	/** Navigation style per orientation; phones always keep the tab bar (see app.css). */
	nav: { portrait: NavStyle; landscape: NavStyle };
};

export const defaultSettings: Settings = {
	theme: 'system',
	alarm: { sound: true, vibration: true, keepAwake: true },
	coffeeDefaultSeconds: 90,
	cookingPresets: [1, 3, 5, 10, 15, 20, 30, 45, 60],
	pizzaDefaults: { ...doughDefaults },
	lifting: { unit: 'lb', activeSet: COMMERCIAL_GYM, sets: [] },
	ovenUnit: 'F',
	recipeUnits: null,
	nav: { portrait: 'bar', landscape: 'sidebar' }
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

export function parsePizzaDefaults(v: unknown): DoughInput {
	const out = { ...doughDefaults };
	if (!isRecord(v)) return out;
	for (const key of Object.keys(doughDefaults) as (keyof DoughInput)[]) {
		if (isDoughValue(v[key])) out[key] = v[key];
	}
	return out;
}

export function parseLiftingSettings(v: unknown): LiftingSettings {
	const d = defaultSettings.lifting;
	if (!isRecord(v)) return structuredClone(d);
	const sets: EquipmentSet[] = [];
	for (const item of Array.isArray(v.sets) ? v.sets.slice(0, SETUP_LIMITS.maxSets) : []) {
		const set = parseEquipmentSet(item);
		if (set && !sets.some((s) => s.id === set.id)) sets.push(set);
	}
	return {
		unit: isUnit(v.unit) ? v.unit : d.unit,
		activeSet: sets.some((s) => s.id === v.activeSet) ? (v.activeSet as string) : COMMERCIAL_GYM,
		sets
	};
}

export const parseCoffeeSeconds = (v: unknown) =>
	isNumberIn(v, COFFEE_SECONDS.min, COFFEE_SECONDS.max) ? Math.round(v) : undefined;
export const parseOvenUnit = (v: unknown): TempUnit | undefined =>
	v === 'C' || v === 'F' ? v : undefined;
export const parseRecipeUnits = (v: unknown): UnitSystem | null | undefined =>
	v === 'us' || v === 'metric' || v === null ? v : undefined;

/**
 * The app's settings as the kernel reads them: each field parsed on its own, a missing or invalid
 * one back to its default, so new settings need no migration. For tests and the settings page;
 * the plugins register the same parsers.
 */
export function parseSettings(v: unknown): Settings | undefined {
	if (!isRecord(v)) return undefined;
	const alarm = isRecord(v.alarm) ? v.alarm : {};
	const bool = (key: keyof Alarm) =>
		typeof alarm[key] === 'boolean' ? (alarm[key] as boolean) : defaultSettings.alarm[key];
	const nav = isRecord(v.nav) ? v.nav : {};
	const navStyle = (key: 'portrait' | 'landscape') =>
		nav[key] === 'bar' || nav[key] === 'sidebar' ? nav[key] : defaultSettings.nav[key];
	return {
		theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
		alarm: { sound: bool('sound'), vibration: bool('vibration'), keepAwake: bool('keepAwake') },
		coffeeDefaultSeconds:
			parseCoffeeSeconds(v.coffeeDefaultSeconds) ?? defaultSettings.coffeeDefaultSeconds,
		cookingPresets: parseCookingPresets(v.cookingPresets) ?? [...defaultSettings.cookingPresets],
		pizzaDefaults: parsePizzaDefaults(v.pizzaDefaults),
		lifting: parseLiftingSettings(v.lifting),
		ovenUnit: parseOvenUnit(v.ovenUnit) ?? 'F',
		recipeUnits: parseRecipeUnits(v.recipeUnits) ?? null,
		nav: { portrait: navStyle('portrait'), landscape: navStyle('landscape') }
	};
}

function entry<T>(
	key: string,
	label: string,
	parse: Entry<T>['parse'],
	legacyKey?: string
): Entry<T> {
	const full = `${PREFIX}${key}`;
	return {
		key: full,
		label,
		parse,
		// Entries are grouped by the first segment of their key (`app:<group>:...`).
		group: key.split(':')[0]!,
		namespace: '',
		...(legacyKey ? { legacyKey } : {})
	};
}

/** What the app's own plugins save (each registers its own with `registerEntries`). */
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
	workoutHistory: entry<HistoryEntry[]>('workout-history', 'Workout history', parseHistory)
} satisfies Record<string, Entry<unknown>>;

/**
 * Keys the app's data lives under that @xcwds plugins own now: the settings (the kernel), the
 * cooking timers (`@xcwds/plugin-timers`), Home's shortcuts (`@xcwds/plugin-tools`) and What's
 * new (`@xcwds/plugin-changelog`). Their saved shapes didn't change.
 */
export const KEYS = {
	settings: `${PREFIX}settings`,
	cookingTimers: `${PREFIX}cooking-timer:timers`,
	homeShortcuts: `${PREFIX}home:shortcuts`,
	whatsNewSeen: `${PREFIX}settings:whats-new-seen`
} as const;

/** The cooking timers as migration v1 found them under their legacy key. */
const legacyCookingTimers = entry<SavedCookingTimer[]>(
	'cooking-timer:timers',
	'Cooking timers',
	// Keep the valid timers rather than dropping the whole list over one bad item.
	(v) => (Array.isArray(v) ? v.filter(isSavedCookingTimer) : undefined),
	'cooking-timers'
);

/** Registers entries with the kernel, under the keys they always had. */
export function registerEntries(storage: StorageScope, list: Entry<unknown>[]): void {
	for (const e of list)
		storage.entry(e.key.slice(PREFIX.length), {
			key: e.key,
			label: e.label,
			parse: e.parse,
			group: e.group
		});
}

/** Labels for the groups Settings → Your data clears one at a time, in the order it lists them. */
const GROUP_LABELS: Record<string, string> = {
	'coffee-timer': 'Coffee Timer',
	'cooking-timer': 'Cooking Timer',
	weightlifting: 'Weightlifting Calculator',
	'workout-history': 'Workout History',
	settings: 'Settings',
	home: 'Home shortcuts'
};

export type Group = { id: string; label: string; entries: KernelEntry<unknown>[] };

export function groupOf(e: KernelEntry<unknown>): string {
	return e.key.slice(PREFIX.length).split(':')[0]!;
}

/** Everything the app saves, grouped by the first segment of the key (`app:<group>:...`). */
export function groups(): Group[] {
	const all = getApp().storage.entries();
	const ids = [...new Set(all.map(groupOf))].sort((a, b) => {
		const order = Object.keys(GROUP_LABELS);
		const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
		return rank(a) - rank(b);
	});
	return ids.map((id) => ({
		id,
		label: GROUP_LABELS[id] ?? id,
		entries: all.filter((e) => groupOf(e) === id)
	}));
}

const RENAMED_EQUIPMENT: Record<string, string> = {
	'barbell-45': 'barbell',
	'barbell-25': 'barbell-light'
};

/**
 * Upgrades saved values (keyed by storage key) from schema version `from` to the current one,
 * in place. Used for this device's storage and for importing older backups.
 */
export function upgradeData(
	data: Record<string, unknown>,
	from: number,
	to = SCHEMA_VERSION
): void {
	if (from < 2 && to >= 2) {
		// v2: the calculator gains a unit, equipment ids stop naming lb weights, and the plates you
		// have move from the calculator into settings (per unit).
		const workoutKey = entries.liftingWorkout.key;
		if (isRecord(data[workoutKey]) && !('unit' in (data[workoutKey] as object)))
			data[workoutKey] = { ...(data[workoutKey] as object), unit: 'lb' };
		const calcKey = entries.liftingCalculator.key;
		const settingsKey = KEYS.settings;
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
	if (from < 3 && to >= 3) upgradeToEquipmentSets(data);
	if (from < 4 && to >= 4) upgradeToAlarm(data);
}

/**
 * v4: the move onto @xcwds. The alarm settings become `@xcwds/plugin-timers`' `alarm` field;
 * everything else kept its key and shape.
 */
function upgradeToAlarm(data: Record<string, unknown>): void {
	const settings = data[KEYS.settings];
	if (!isRecord(settings)) return;
	const { sound, vibration, keepAwake, ...rest } = settings;
	if (sound === undefined && vibration === undefined && keepAwake === undefined) return;
	const alarm = isRecord(rest.alarm) ? rest.alarm : {};
	data[KEYS.settings] = {
		...rest,
		alarm: {
			...(typeof sound === 'boolean' ? { sound } : {}),
			...(typeof vibration === 'boolean' ? { vibration } : {}),
			...(typeof keepAwake === 'boolean' ? { keepAwake } : {}),
			...alarm
		}
	};
}

/** v2's five stations: their bar weights per unit, and their station ids in a v3 set. */
const V2_BARS: Record<WeightUnit, Record<string, number>> = {
	lb: { barbell: 45, 'barbell-light': 25, dumbbell: 7.5, kettlebell: 5 },
	kg: { barbell: 20, 'barbell-light': 15, dumbbell: 2.5, kettlebell: 2.5 }
};
const V2_STATIONS: Record<string, string> = {
	barbell: 'barbell',
	'barbell-light': 'barbell-light',
	dumbbell: 'dumbbell',
	dumbbells: 'dumbbell:pair',
	kettlebell: 'kettlebell'
};

/**
 * v3 (#82): owned plates, #71's station setups and the default equipment become equipment
 * sets. Anyone who customized a unit's equipment, or used a station the commercial gym no longer
 * has, gets a "My equipment" set with v2's five stations as they had them (owned sizes
 * unlimited, others none), active when it's in the unit they used. The calculator's equipment
 * becomes the station it remembers for the active set.
 */
function upgradeToEquipmentSets(data: Record<string, unknown>): void {
	const settingsKey = KEYS.settings;
	const calcKey = entries.liftingCalculator.key;
	const settings = isRecord(data[settingsKey]) ? data[settingsKey] : undefined;
	const lifting = isRecord(settings?.lifting) ? settings.lifting : {};
	// Already sets (e.g. a backup made by this version but labeled older): nothing to do.
	if (Array.isArray(lifting.sets)) return;
	const calc = isRecord(data[calcKey]) ? data[calcKey] : undefined;
	const unit: WeightUnit = isUnit(lifting.unit) ? lifting.unit : 'lb';
	const plates = isRecord(lifting.plates) ? lifting.plates : {};
	const setups = isRecord(lifting.setups) ? lifting.setups : {};
	const picked = [lifting.equipment, calc?.equipmentId].filter(
		(id): id is string => typeof id === 'string' && id in V2_STATIONS
	);

	const sets: EquipmentSet[] = [];
	for (const u of WEIGHT_UNITS) {
		const sizes = UNITS[u].plates;
		const ownedSizes = Array.isArray(plates[u])
			? sizes.filter((p) => (plates[u] as unknown[]).includes(p))
			: sizes;
		const unitSetups = isRecord(setups[u]) ? setups[u] : {};
		const setup = (id: string) => (isRecord(unitSetups[id]) ? unitSetups[id] : {});
		const customized =
			ownedSizes.length < sizes.length ||
			Object.keys(unitSetups).some((id) => Object.keys(setup(id)).length > 0) ||
			(u === unit && picked.some((id) => id !== 'barbell'));
		if (!customized) continue;
		const bar = (id: string, type: BarType, count: number, saved: Record<string, unknown>) => {
			const weight = V2_BARS[u][id];
			const fields = { ...saved, id, type, count, weight: saved.bar ?? weight };
			const name = (w: number) => barName(type, w, u);
			const parsed = parseBar(u, fields) ?? parseBar(u, { ...fields, weight });
			return { ...parsed!, name: name(parsed!.weight) };
		};
		const bars: Bar[] = [
			bar('barbell', 'barbell', 1, setup('barbell')),
			bar('barbell-light', 'barbell', 1, setup('barbell-light')),
			// v2 had a single dumbbell and a pair; v3 has one handle you own two of.
			bar('dumbbell', 'dumbbell', 2, { ...setup('dumbbells'), ...setup('dumbbell') }),
			bar('kettlebell', 'kettlebell', 1, setup('kettlebell'))
		];
		sets.push({
			id: `my-${u}`,
			name: 'My equipment',
			unit: u,
			bars,
			plates: Object.fromEntries(sizes.map((p) => [p, ownedSizes.includes(p) ? null : 0]))
		});
	}
	if (sets.length > 1) for (const set of sets) set.name = `My equipment (${set.unit})`;
	const active = sets.find((s) => s.unit === unit)?.id ?? COMMERCIAL_GYM;

	if (settings || sets.length)
		data[settingsKey] = { ...settings, lifting: { unit, activeSet: active, sets } };
	if (calc) {
		const next: Record<string, unknown> = { ...calc };
		const station =
			typeof calc.equipmentId === 'string' ? V2_STATIONS[calc.equipmentId] : undefined;
		delete next.equipmentId;
		if (station && (active !== COMMERCIAL_GYM || station === 'barbell'))
			next.stations = { [active]: station };
		data[calcKey] = next;
	}
}

/** Entries saved before the storage module existed, under their legacy keys (v1). */
const LEGACY: Entry<unknown>[] = [
	entries.coffeeDuration,
	legacyCookingTimers,
	entries.liftingCalculator,
	entries.liftingWorkout,
	entries.liftingTab
];

/**
 * The app's migrations, in its namespace (`''`, versioned as `app:version`). They upgrade this
 * device's data and older backups alike. The app's plugin registers them before anything reads.
 */
export const migrations: Migration[] = [
	{
		// v1: move pre-storage-module keys to `app:` keys.
		to: 1,
		keys: LEGACY.flatMap((e) => [e.legacyKey!, e.key]),
		run(data) {
			for (const e of LEGACY) {
				const legacy = e.legacyKey!;
				if (!(legacy in data)) continue;
				const value = e.parse(data[legacy]);
				if (value !== undefined && data[e.key] === undefined) data[e.key] = value;
				delete data[legacy];
			}
		}
	},
	{ to: 2, run: (data) => upgradeData(data, 1, 2) },
	{ to: 3, run: (data) => upgradeData(data, 2, 3) },
	{ to: 4, run: (data) => upgradeData(data, 3, 4) }
];

const storage = () => getApp().storage;

export const read = <T>(e: KernelEntry<T>): T | undefined => storage().read(e);

/** Saves a value; returns false if it couldn't be stored (unavailable, full). */
export const write = <T>(e: KernelEntry<T>, value: T): boolean => storage().write(e, value);

/** Removes a value; returns false if storage is unavailable. */
export const remove = (e: KernelEntry<unknown>): boolean => storage().remove(e);

/**
 * Applies `change` to the latest saved value and saves the result, so a change made in one tab
 * never overwrites what another tab saved meanwhile (see `app.storage.update`).
 */
export function update<T>(
	e: KernelEntry<T>,
	current: T | undefined,
	change: (latest: T | undefined) => T | undefined,
	options: { unsaved?: boolean } = {}
): { value: T | undefined; saved: boolean } {
	return storage().update(e, current, change, options);
}

/** Whether this browser lets the app save at all (false in blocked or full storage). */
export const storageWritable = (): boolean => storage().writable();

/** Removes the given entries (default: everything the app saves). */
export const clear = (list?: KernelEntry<unknown>[]): void => storage().clear(list);

// --- Backups -----------------------------------------------------------------------------

export type { Backup, ParsedBackup } from '@xcwds/core';

/** Everything currently saved, as a backup object. Invalid values are left out. */
export const exportData = (now = new Date()) => storage().exportData(now);

/** Checks a backup file and upgrades its data, including backups from before @xcwds. */
export function parseBackup(text: string): import('@xcwds/core').ParsedBackup {
	const parsed = storage().parseBackup(text);
	// Keep the app's own wording for a file from somewhere else.
	if (!parsed.ok && parsed.error === "This file isn't a backup from this app.")
		return { ok: false, error: "This file isn't a backup from this site." };
	return parsed;
}

/**
 * Applies a parsed backup. `replace` clears everything first; `merge` only overwrites the
 * entries the backup contains and keeps the rest. Returns false if anything failed to save.
 */
export const importData = (backup: import('@xcwds/core').Backup, mode: 'replace' | 'merge') =>
	storage().importData(backup, mode);
