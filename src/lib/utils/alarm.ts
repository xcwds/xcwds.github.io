import { settings } from '$lib/settings.svelte';

let context: AudioContext | undefined;

/**
 * Creates/resumes the audio context. Call from a tap handler: iOS only allows audio
 * that was unlocked by a user gesture.
 */
export function primeAudio() {
	try {
		context ??= new AudioContext();
		if (context.state === 'suspended') void context.resume();
	} catch {
		// Audio unavailable; the alarm falls back to vibration and the visual state.
	}
}

/** Plays `count` short beeps and vibrates where supported, per the alarm settings. */
export function beep(count = 3) {
	if (settings.alarm.vibration) {
		try {
			navigator.vibrate?.(Array.from({ length: count * 2 - 1 }, (_, i) => (i % 2 ? 150 : 300)));
		} catch {
			// Vibration unsupported (e.g. iOS Safari).
		}
	}
	if (!context || !settings.alarm.sound) return;
	const start = context.currentTime + 0.05;
	for (let i = 0; i < count; i++) {
		const t = start + i * 0.45;
		const osc = context.createOscillator();
		const gain = context.createGain();
		osc.frequency.value = 880;
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
		osc.connect(gain).connect(context.destination);
		osc.start(t);
		osc.stop(t + 0.32);
	}
}

/** Keeps the screen awake while `active` is true, re-acquiring after the tab is shown again. */
export function keepAwake(active: () => boolean) {
	let sentinel: WakeLockSentinel | undefined;

	async function sync() {
		const want = settings.alarm.keepAwake && active() && document.visibilityState === 'visible';
		try {
			if (want && !sentinel && 'wakeLock' in navigator) {
				sentinel = await navigator.wakeLock.request('screen');
				sentinel.addEventListener('release', () => (sentinel = undefined));
			} else if (!want && sentinel) {
				await sentinel.release();
				sentinel = undefined;
			}
		} catch {
			// Wake lock denied (low battery, unsupported); timers still work.
		}
	}

	document.addEventListener('visibilitychange', sync);
	return {
		sync,
		destroy() {
			document.removeEventListener('visibilitychange', sync);
			void sentinel?.release();
		}
	};
}
