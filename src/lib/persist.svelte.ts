import { onMount } from 'svelte';
import { read, write, type Entry } from './storage';

/**
 * Keeps component state in sync with a storage entry: loads it after mount (so prerendered
 * HTML and hydration agree) and saves on every change after that. Call during component init.
 *
 *   persist(entries.coffeeDuration, () => base, (v) => (base = v));
 */
export function persist<T>(entry: Entry<T>, get: () => T, set: (value: T) => void): void {
	let loaded = $state(false);
	onMount(() => {
		const saved = read(entry);
		if (saved !== undefined) set(saved);
		loaded = true;
	});
	$effect(() => {
		// Serializing inside the effect tracks every nested field of the value.
		const value = JSON.parse(JSON.stringify(get())) as T;
		if (loaded) write(entry, value);
	});
}
