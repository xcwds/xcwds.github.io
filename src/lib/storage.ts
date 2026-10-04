import { EQUIPMENT, PLATES, type Plate, type PlateCounts, type Workout } from '$lib/utils/lifting';

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
export const SCHEMA_VERSION = 1;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

export type SavedCookingTimer = {
	id: number;
	label: string;
	state: { duration: number; endsAt: number | null; pausedRemaining: number };
};

const isSavedCookingTimer = (v: unknown): v is SavedCookingTimer =>
	isRecord(v) &&
	typeof v.id === 'number' &&
	typeof v.label === 'string' &&
	isRecord(v.state) &&
	typeof v.state.duration === 'number' &&
	typeof v.state.pausedRemaining === 'number' &&
	(v.state.endsAt === null || typeof v.state.endsAt === 'number');

export type LiftingCalculatorState = {
	equipmentId: string;
	mode: 'load' | 'target';
	symmetric: boolean;
	sides: PlateCounts[];
	available: Plate[];
};

const isPlateCounts = (v: unknown): v is PlateCounts =>
	isRecord(v) &&
	Object.entries(v).every(
		([plate, n]) => PLATES.includes(Number(plate) as Plate) && typeof n === 'number' && n >= 0
	);

/** Fields that fail validation are dropped; the calculator keeps its default for them. */
function parseLiftingCalculator(v: unknown): Partial<LiftingCalculatorState> | undefined {
	if (!isRecord(v)) return undefined;
	const out: Partial<LiftingCalculatorState> = {};
	if (EQUIPMENT.some((e) => e.id === v.equipmentId)) out.equipmentId = v.equipmentId as string;
	if (v.mode === 'load' || v.mode === 'target') out.mode = v.mode;
	if (typeof v.symmetric === 'boolean') out.symmetric = v.symmetric;
	if (Array.isArray(v.sides) && v.sides.length === 2 && v.sides.every(isPlateCounts))
		out.sides = v.sides;
	if (Array.isArray(v.available) && v.available.every((p) => PLATES.includes(p)))
		out.available = v.available;
	return out;
}

const isSet = (v: unknown) =>
	isRecord(v) &&
	typeof v.id === 'number' &&
	(v.weight === null || typeof v.weight === 'number') &&
	(v.reps === null || typeof v.reps === 'number');

function parseWorkout(v: unknown): Workout | undefined {
	if (!isRecord(v) || typeof v.date !== 'string' || !Array.isArray(v.exercises)) return undefined;
	const valid = v.exercises.every(
		(e) =>
			isRecord(e) &&
			typeof e.id === 'number' &&
			typeof e.name === 'string' &&
			Array.isArray(e.sets) &&
			e.sets.every(isSet)
	);
	return valid ? (v as Workout) : undefined;
}

export type Theme = 'system' | 'light' | 'dark';

export type Settings = {
	theme: Theme;
	/** Alarm beeps for the coffee and cooking timers. */
	sound: boolean;
	/** Alarm vibration, where the device supports it. */
	vibration: boolean;
	/** Keep the screen on while a timer runs. */
	keepAwake: boolean;
};

export const defaultSettings: Settings = {
	theme: 'system',
	sound: true,
	vibration: true,
	keepAwake: true
};

/** Invalid or missing fields fall back to their defaults, so new settings need no migration. */
function parseSettings(v: unknown): Settings | undefined {
	if (!isRecord(v)) return undefined;
	const bool = (key: 'sound' | 'vibration' | 'keepAwake') =>
		typeof v[key] === 'boolean' ? (v[key] as boolean) : defaultSettings[key];
	return {
		theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
		sound: bool('sound'),
		vibration: bool('vibration'),
		keepAwake: bool('keepAwake')
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
	liftingTab: entry<'plates' | 'workout'>(
		'weightlifting:tab',
		'Weightlifting last tab',
		(v) => (v === 'plates' || v === 'workout' ? v : undefined),
		'lifting-tab'
	),
	settings: entry<Settings>('settings', 'Settings', parseSettings)
} satisfies Record<string, Entry<unknown>>;

export const allEntries: Entry<unknown>[] = Object.values(entries);

/** Entries are grouped by the first segment of their key (`app:<group>:...`). */
const GROUP_LABELS: Record<string, string> = {
	'coffee-timer': 'Coffee Timer',
	'cooking-timer': 'Cooking Timer',
	weightlifting: 'Weightlifting Calculator',
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

export function remove(e: Entry<unknown>): void {
	try {
		storage()?.removeItem(e.key);
	} catch {
		// Nothing to do.
	}
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
	const data: Record<string, unknown> = {};
	const found: Entry<unknown>[] = [];
	const skipped: string[] = [];
	for (const [key, value] of Object.entries(raw.data)) {
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
		schemaVersion: version,
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
