import { onMount } from 'svelte';
import { read, remove, write, type Entry } from './storage';

/**
 * Keeps component state in sync with a storage entry: loads it after mount (so prerendered
 * HTML and hydration agree), then saves only when the value actually changes. Just opening a
 * page never writes, so "nothing saved yet" stays meaningful (e.g. for tool defaults).
 * Returning `undefined` from `get` removes the entry. Call during component init.
 *
 *   persist(entries.coffeeDuration, () => custom, (v) => (custom = v));
 */
export function persist<T>(
	entry: Entry<T>,
	get: () => T | undefined,
	set: (value: T) => void
): void {
	let loaded = $state(false);
	/** JSON of the value as last loaded or saved; unchanged values aren't written again. */
	let baseline: string | undefined;

	onMount(() => {
		const saved = read(entry);
		if (saved !== undefined) set(saved);
		baseline = JSON.stringify(get());
		loaded = true;
	});

	$effect(() => {
		// Serializing inside the effect tracks every nested field of the value.
		const json = JSON.stringify(get());
		if (!loaded || json === baseline) return;
		baseline = json;
		if (json === undefined) remove(entry);
		else write(entry, JSON.parse(json) as T);
	});
}
