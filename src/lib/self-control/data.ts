/**
 * Self-Control's saved data per habit (#148). Each tool that keys data by habit (reasons, the
 * seesaw, plans, the urge log) adds itself to `habitData`, so deleting a habit deletes all of it.
 */
import type { Entry } from '@xcwds/core';
import { update } from '#lib/storage.js';

/** An entry holding data for several habits, and how to drop one habit's part of it. */
export type HabitData<T> = {
	entry: Entry<T>;
	/**
	 * `value` without the habit's data, or undefined when nothing is left. (A method, so any
	 * entry's `HabitData` fits in the one list.)
	 */
	without(value: T, habitId: string): T | undefined;
};

/** Every entry that keys data by habit. The tools add theirs as they land (#147, #149–#152). */
export const habitData: HabitData<unknown>[] = [];

/** Adds an entry to the ones a habit's deletion clears. */
export const addHabitData = <T>(data: HabitData<T>): void => void habitData.push(data);

/**
 * Deletes everything saved for `habitId` (not the habit itself), starting from the latest saved
 * values so another tab's changes aren't lost. Returns whether every change was saved.
 */
export function removeHabitData(
	habitId: string,
	data: readonly HabitData<unknown>[] = habitData
): boolean {
	let saved = true;
	for (const { entry, without } of data) {
		const result = update(entry, undefined, (latest) =>
			latest === undefined ? undefined : without(latest, habitId)
		);
		saved &&= result.saved;
	}
	return saved;
}
