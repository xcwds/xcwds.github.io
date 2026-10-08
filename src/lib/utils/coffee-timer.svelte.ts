import { getContext, onMount, setContext } from 'svelte';
import { browser } from '$app/environment';
import { markBusy } from '$lib/app-update.svelte';
import { persist } from '$lib/persist.svelte';
import { entries } from '$lib/storage';
import { beep, keepAwake, primeAudio } from './alarm';
import { Timer } from './timer.svelte';

/**
 * The Coffee Timer's countdown. The root layout owns it (see `provideCoffeeTimer`) and saves it
 * (`app:coffee-timer:brew`), so a brew keeps counting and rings while you use the rest of the app
 * or after a reload (#66). The page decides the starting length.
 */
export class CoffeeTimer {
	timer = new Timer(90_000, () => beep(3));
	/** True from Start until the next reset; the page only changes the length before it. */
	started = $state(false);

	constructor() {
		markBusy('coffee timer', () => this.timer.running);

		const awake = browser ? keepAwake(() => this.timer.running) : undefined;
		$effect(() => {
			void this.timer.running;
			void awake?.sync();
		});

		persist(
			entries.coffeeBrew,
			() => (this.started ? this.timer.toJSON() : undefined),
			(saved) => {
				this.started = true;
				this.timer.restore(saved);
			},
			{ cleared: () => this.reset() }
		);

		onMount(() => () => {
			awake?.destroy();
			this.timer.destroy();
		});
	}

	/** Done and still counting the time over. */
	get over(): boolean {
		return this.timer.running && this.timer.done;
	}

	/** Start or pause; a finished brew is reset instead. Call from a tap handler (iOS audio). */
	toggle(): void {
		primeAudio();
		if (this.over) this.reset();
		else if (this.timer.running) this.timer.pause();
		else {
			this.started = true;
			this.timer.start();
		}
	}

	/** Ends the brew; `ms` sets the next starting length (default: the last one). */
	reset(ms = this.timer.duration): void {
		this.started = false;
		this.timer.reset(ms);
	}
}

const KEY = Symbol('coffee timer');

/** Creates the app-wide coffee timer. Call once, from the root layout's init. */
export function provideCoffeeTimer(): CoffeeTimer {
	return setContext(KEY, new CoffeeTimer());
}

/** The app-wide coffee timer (from any page or component under the root layout). */
export function useCoffeeTimer(): CoffeeTimer {
	return getContext<CoffeeTimer>(KEY);
}
