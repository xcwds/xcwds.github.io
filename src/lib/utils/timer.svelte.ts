export type TimerState = {
	duration: number;
	endsAt: number | null;
	pausedRemaining: number;
};

/**
 * Countdown that tracks a wall-clock end time instead of counting ticks, so it stays
 * correct when a phone throttles or suspends the tab.
 */
export class Timer {
	duration = $state(0);
	endsAt = $state<number | null>(null);
	pausedRemaining = $state(0);
	now = $state(Date.now());
	onDone: (() => void) | undefined;

	#interval: ReturnType<typeof setInterval> | undefined;
	#fired = false;

	constructor(duration: number, onDone?: () => void) {
		this.duration = duration;
		this.pausedRemaining = duration;
		this.onDone = onDone;
	}

	get running() {
		return this.endsAt !== null;
	}

	/** Signed remaining time in ms; negative once the timer has run over. */
	get remaining() {
		return this.endsAt === null ? this.pausedRemaining : this.endsAt - this.now;
	}

	get done() {
		return this.remaining <= 0;
	}

	start() {
		if (this.running) return;
		this.now = Date.now();
		this.#fired = this.pausedRemaining <= 0;
		this.endsAt = this.now + this.pausedRemaining;
		this.#tick();
	}

	pause() {
		if (!this.running) return;
		this.now = Date.now();
		this.pausedRemaining = this.remaining;
		this.endsAt = null;
		this.#stopTicking();
	}

	reset(duration = this.duration) {
		this.#stopTicking();
		this.duration = duration;
		this.pausedRemaining = duration;
		this.endsAt = null;
		this.#fired = false;
	}

	/**
	 * Adds (or with a negative value, removes) time from this run without dropping below zero
	 * remaining. `duration` (what `reset()` goes back to) is left alone.
	 */
	add(ms: number) {
		this.now = Date.now();
		const next = Math.max(0, this.remaining + ms);
		if (this.running) this.endsAt = this.now + next;
		else this.pausedRemaining = next;
		if (next > 0) this.#fired = false;
	}

	toJSON(): TimerState {
		return { duration: this.duration, endsAt: this.endsAt, pausedRemaining: this.pausedRemaining };
	}

	/** Restores a saved state; a timer that finished while the page was closed fires on resume. */
	restore(state: TimerState) {
		this.duration = state.duration;
		this.pausedRemaining = state.pausedRemaining;
		this.endsAt = state.endsAt;
		this.#fired = false;
		if (this.running) this.#tick();
	}

	destroy() {
		this.#stopTicking();
	}

	#tick() {
		this.#stopTicking();
		const step = () => {
			this.now = Date.now();
			if (!this.#fired && this.remaining <= 0) {
				this.#fired = true;
				this.onDone?.();
			}
		};
		step();
		this.#interval = setInterval(step, 200);
	}

	#stopTicking() {
		clearInterval(this.#interval);
		this.#interval = undefined;
	}
}
