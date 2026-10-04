<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { beep, keepAwake, primeAudio } from '$lib/utils/alarm';
	import { markBusy } from '$lib/app-update.svelte';
	import { persist } from '$lib/persist.svelte';
	import { entries } from '$lib/storage';
	import { formatDuration } from '$lib/utils/time';
	import { Timer } from '$lib/utils/timer.svelte';

	const DEFAULT_MS = 90_000;

	let base = $state(DEFAULT_MS);
	const timer = new Timer(DEFAULT_MS, () => beep(3));
	let over = $derived(timer.running && timer.done);

	// The countdown itself isn't saved, so an app update (reload) would reset it.
	markBusy('coffee timer', () => timer.running);

	persist(
		entries.coffeeDuration,
		() => base,
		(saved) => {
			base = saved;
			timer.reset(saved);
		}
	);

	const awake = browser ? keepAwake(() => timer.running) : undefined;
	$effect(() => {
		void timer.running;
		void awake?.sync();
	});

	onMount(() => {
		return () => {
			awake?.destroy();
			timer.destroy();
		};
	});

	function setBase(ms: number) {
		base = ms;
	}

	/** Adjusting a timer that hasn't started changes the default; mid-brew it only changes this run. */
	function adjust(ms: number) {
		const atStart = !timer.running && timer.remaining === base;
		timer.add(ms);
		if (atStart) setBase(timer.duration);
	}

	function toggle() {
		primeAudio();
		// Stopping a finished brew resets it, so the next Start begins a fresh countdown.
		if (over) timer.reset(base);
		else if (timer.running) timer.pause();
		else timer.start();
	}
</script>

<svelte:head>
	<title>Coffee Timer</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
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
			onclick={() => timer.reset(base)}
			class="rounded-xl bg-white/70 py-6 text-2xl font-semibold active:bg-white dark:bg-gray-800 dark:active:bg-gray-700"
		>
			Reset
		</button>
	</div>

	<p class="text-center text-sm text-gray-600 dark:text-gray-400">
		Resets to {formatDuration(base)}.
		{#if base !== DEFAULT_MS}
			<button
				type="button"
				class="underline"
				onclick={() => (setBase(DEFAULT_MS), timer.reset(DEFAULT_MS))}
			>
				Back to 1:30
			</button>
		{/if}
	</p>
</main>
