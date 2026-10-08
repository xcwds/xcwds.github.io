import { getContext, onMount, setContext } from 'svelte';
import { browser } from '$app/environment';
import { markBusy } from '$lib/app-update.svelte';
import { persist } from '$lib/persist.svelte';
import { entries } from '$lib/storage';
import { beep, keepAwake, primeAudio } from './alarm';
import { formatDuration } from './time';
import { Timer } from './timer.svelte';

export const MINUTE = 60_000;

export type CookingTimerItem = { id: number; label: string; timer: Timer };

/**
 * The saved list of labeled cooking timers, shared by the Cooking Timer page and recipe step
 * timers (`app:cooking-timer:timers`). The root layout owns the one instance (see
 * `provideCookingTimers`), so the alarm rings, the screen stays awake and app updates wait on
 * every page, not just the one that started a timer (#66).
 */
export class CookingTimers {
	items = $state<CookingTimerItem[]>([]);

	constructor() {
		markBusy('cooking timers', () => this.anyRunning);

		const awake = browser ? keepAwake(() => this.anyRunning) : undefined;
		$effect(() => {
			void this.anyRunning;
			void awake?.sync();
		});

		// Keep beeping until every finished timer is stopped or snoozed.
		$effect(() => {
			if (!this.anyRinging) return;
			beep(2);
			const interval = setInterval(() => beep(2), 3000);
			return () => clearInterval(interval);
		});

		// Timers keep counting across reloads: end times are saved, not remaining ticks.
		persist(
			entries.cookingTimers,
			() => this.items.map(({ id, label, timer }) => ({ id, label, state: timer.toJSON() })),
			(saved) => {
				// Also runs when another tab changes the timers; stop the ones being replaced.
				this.#destroyAll();
				this.items = saved.map(({ id, label, state }) => {
					const timer = new Timer(state.duration);
					timer.restore(state);
					return { id, label, timer };
				});
			},
			{
				cleared: () => {
					this.#destroyAll();
					this.items = [];
				}
			}
		);

		onMount(() => () => {
			awake?.destroy();
			this.#destroyAll();
		});
	}

	ringing(item: CookingTimerItem): boolean {
		return item.timer.running && item.timer.done;
	}

	get anyRinging(): boolean {
		return this.items.some((item) => this.ringing(item));
	}

	get anyRunning(): boolean {
		return this.items.some((item) => item.timer.running);
	}

	/** Starts a new timer. Call from a tap handler, so the alarm can play sound later (iOS). */
	add(ms: number, label: string): void {
		if (ms <= 0) return;
		primeAudio();
		const timer = new Timer(ms);
		timer.start();
		this.items.push({
			id: Date.now() + Math.random(),
			label: label || `${formatDuration(ms)} timer`,
			timer
		});
	}

	remove(item: CookingTimerItem): void {
		item.timer.destroy();
		this.items = this.items.filter((i) => i.id !== item.id);
	}

	toggle(item: CookingTimerItem): void {
		primeAudio();
		if (item.timer.running) item.timer.pause();
		else item.timer.start();
	}

	#destroyAll() {
		for (const item of this.items) item.timer.destroy();
	}
}

const KEY = Symbol('cooking timers');

/** Creates the app-wide cooking timers. Call once, from the root layout's init. */
export function provideCookingTimers(): CookingTimers {
	return setContext(KEY, new CookingTimers());
}

/** The app-wide cooking timers (from any page or component under the root layout). */
export function useCookingTimers(): CookingTimers {
	return getContext<CookingTimers>(KEY);
}
