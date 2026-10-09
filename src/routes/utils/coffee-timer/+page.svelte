<script lang="ts">
	import { untrack } from 'svelte';
	import { persist } from '$lib/persist.svelte';
	import { settings, settingsStatus } from '$lib/settings.svelte';
	import { COFFEE_SECONDS, entries } from '$lib/storage';
	import { useCoffeeTimer } from '$lib/utils/coffee-timer.svelte';
	import { formatDuration } from '$lib/utils/time';

	/** Settings → Tool defaults (90 s unless changed). */
	let defaultMs = $derived(settings.coffeeDefaultSeconds * 1000);
	/**
	 * A length picked with the ± buttons, remembered between visits; null means "use the default".
	 * Changing the default in Settings clears it, so the new default takes effect.
	 */
	let custom = $state<number | null>(null);
	let base = $derived(custom ?? defaultMs);

	// The countdown lives in the root layout, so it keeps running (and rings) on other pages.
	const coffee = useCoffeeTimer();
	const timer = coffee.timer;
	/** True from Start until the next reset; ± buttons change the saved length only before it. */
	let started = $derived(coffee.started);
	let over = $derived(coffee.over);

	persist(
		entries.coffeeDuration,
		() => custom ?? undefined,
		(saved) => (custom = saved),
		{ cleared: () => (custom = null) }
	);

	// Show the starting length once settings load (after this page mounts), and again whenever
	// it changes before a brew starts, e.g. when another tab changes or clears it.
	$effect(() => {
		if (!settingsStatus.ready) return;
		const ms = base;
		untrack(() => {
			if (!started && !timer.running) timer.reset(ms);
		});
	});

	/** Before Start, ± changes the saved length (kept within Settings' limits); after, only this run. */
	function adjust(ms: number) {
		if (started) {
			timer.add(ms);
			return;
		}
		custom = Math.min(Math.max(base + ms, COFFEE_SECONDS.min * 1000), COFFEE_SECONDS.max * 1000);
		timer.reset(custom);
	}

	function reset(ms = base) {
		coffee.reset(ms);
	}

	function useDefault() {
		custom = null;
		reset(defaultMs);
	}

	function toggle() {
		// Stopping a finished brew resets it, so the next Start begins a fresh countdown.
		if (over) reset();
		else coffee.toggle();
	}
</script>

<svelte:head>
	<title>Coffee Timer</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<div
		class="rounded-2xl py-10 text-center transition-colors {over
			? 'bg-amber-300 dark:bg-amber-700'
			: 'bg-white/80 dark:bg-gray-900'}"
	>
		<p
			class="text-8xl font-semibold tabular-nums"
			role="timer"
			aria-live="off"
			data-testid="display"
		>
			{over ? `+${formatDuration(-timer.remaining)}` : formatDuration(timer.remaining)}
		</p>
		{#if over}<p class="mt-2 text-lg font-medium">Done!</p>{/if}
	</div>

	<div class="grid grid-cols-4 gap-2">
		{#each [-10_000, 10_000, 30_000, 60_000] as ms (ms)}
			<button
				type="button"
				onclick={() => adjust(ms)}
				class="rounded-xl bg-white/70 py-4 text-lg font-medium active:bg-white dark:bg-gray-800 dark:active:bg-gray-700"
			>
				{ms < 0 ? '−' : '+'}{Math.abs(ms) / 1000}s
			</button>
		{/each}
	</div>

	<div class="grid grid-cols-2 gap-2">
		<button
			type="button"
			onclick={toggle}
			class="rounded-xl bg-blue-600 py-6 text-2xl font-semibold text-white active:bg-blue-700"
		>
			{timer.running ? (over ? 'Stop' : 'Pause') : 'Start'}
		</button>
		<button
			type="button"
			onclick={() => reset()}
			class="rounded-xl bg-white/70 py-6 text-2xl font-semibold active:bg-white dark:bg-gray-800 dark:active:bg-gray-700"
		>
			Reset
		</button>
	</div>

	<p class="text-center text-sm text-gray-600 dark:text-gray-400">
		Resets to {formatDuration(base)}.
		{#if base !== defaultMs}
			<button type="button" class="underline" onclick={useDefault}>
				Back to {formatDuration(defaultMs)}
			</button>
		{/if}
	</p>
</main>
