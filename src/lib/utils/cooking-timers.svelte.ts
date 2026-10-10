import type { TimerItem } from '@xcwds/plugin-timers/client';
import { getApp } from '@xcwds/sveltekit';
import { getContext, onMount, setContext } from 'svelte';
import { formatDuration } from './time';

export const MINUTE = 60_000;

/** One cooking timer as pages show it: live values from `@xcwds/plugin-timers`. */
export type CookingTimerItem = {
	id: number;
	label: string;
	timer: {
		running: boolean;
		/** Signed remaining time in ms; negative once the timer has run over. */
		remaining: number;
		done: boolean;
		/** Adds (or removes) time; on a finished timer, snoozes it. */
		add(ms: number): void;
	};
};

/**
 * The labeled cooking timers, shared by the Cooking Timer page and recipe step timers. They are
 * `@xcwds/plugin-timers`' timers (saved as `app:cooking-timer:timers`), which ring, keep the
 * screen awake and hold app updates on every page, not just the one that started a timer (#66).
 */
export class CookingTimers {
	items = $state<CookingTimerItem[]>([]);
	#ringing = $state<number[]>([]);

	constructor() {
		onMount(() => {
			const timers = getApp().timers;
			return timers?.subscribe((list) => {
				this.items = list.map((item) => this.#view(item));
				this.#ringing = list.filter((item) => timers.ringing(item)).map((item) => item.id);
			});
		});
	}

	#view(item: TimerItem): CookingTimerItem {
		const timers = getApp().timers!;
		const remaining = timers.remaining(item);
		return {
			id: item.id,
			label: item.label,
			timer: {
				running: item.state.endsAt !== null,
				remaining,
				done: remaining <= 0,
				add: (ms) => timers.add(item.id, ms)
			}
		};
	}

	ringing(item: CookingTimerItem): boolean {
		return this.#ringing.includes(item.id);
	}

	get anyRinging(): boolean {
		return this.#ringing.length > 0;
	}

	get anyRunning(): boolean {
		return this.items.some((item) => item.timer.running);
	}

	/** Starts a new timer. Call from a tap handler, so the alarm can play sound later (iOS). */
	add(ms: number, label: string): void {
		if (ms <= 0) return;
		getApp().timers?.create(label || `${formatDuration(ms)} timer`, ms);
	}

	remove(item: CookingTimerItem): void {
		getApp().timers?.remove(item.id);
	}

	toggle(item: CookingTimerItem): void {
		getApp().timers?.toggle(item.id);
	}

	/**
	 * Says this page lists every timer, so finished ones don't also show as alerts. Call during
	 * component init.
	 */
	showAll(): void {
		onMount(() => getApp().timers?.show());
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
