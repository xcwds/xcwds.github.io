<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { beep, keepAwake, primeAudio } from '$lib/utils/alarm';
	import { markBusy } from '$lib/app-update.svelte';
	import { persist } from '$lib/persist.svelte';
	import { entries } from '$lib/storage';
	import { formatDuration } from '$lib/utils/time';
	import { Timer } from '$lib/utils/timer.svelte';

	type Item = { id: number; label: string; timer: Timer };

	const MINUTE = 60_000;
	const presets = [1, 3, 5, 10, 15, 20, 30, 45, 60];

	let items = $state<Item[]>([]);
	let label = $state('');
	let minutes = $state<number | null>(null);

	const ringing = (item: Item) => item.timer.running && item.timer.done;
	let anyRinging = $derived(items.some(ringing));
	let anyRunning = $derived(items.some((item) => item.timer.running));

	// Timers survive a reload, but the alarm stays silent until the next tap (browsers need a
	// gesture to play sound), so hold app updates while any are running.
	markBusy('cooking timers', () => anyRunning);

	const awake = browser ? keepAwake(() => anyRunning) : undefined;
	$effect(() => {
		void anyRunning;
		void awake?.sync();
	});

	// Keep beeping until every finished timer is stopped or snoozed.
	$effect(() => {
		if (!anyRinging) return;
		beep(2);
		const interval = setInterval(() => beep(2), 3000);
		return () => clearInterval(interval);
	});

	// Timers keep counting across reloads: end times are saved, not remaining ticks.
	persist(
		entries.cookingTimers,
		() => items.map(({ id, label, timer }) => ({ id, label, state: timer.toJSON() })),
		(saved) => {
			items = saved.map(({ id, label, state }) => {
				const timer = new Timer(state.duration);
				timer.restore(state);
				return { id, label, timer };
			});
		}
	);

	onMount(() => {
		return () => {
			awake?.destroy();
			for (const item of items) item.timer.destroy();
		};
	});

	function add(ms: number, name: string) {
		if (ms <= 0) return;
		primeAudio();
		const timer = new Timer(ms);
		timer.start();
		items.push({
			id: Date.now() + Math.random(),
			label: name || `${formatDuration(ms)} timer`,
			timer
		});
	}

	function addCustom(event: SubmitEvent) {
		event.preventDefault();
		if (!minutes || minutes <= 0) return;
		add(minutes * MINUTE, label.trim());
		label = '';
		minutes = null;
	}

	function remove(item: Item) {
		item.timer.destroy();
		items = items.filter((i) => i.id !== item.id);
	}

	function toggle(item: Item) {
		primeAudio();
		if (item.timer.running) item.timer.pause();
		else item.timer.start();
	}
</script>

<svelte:head>
	<title>Cooking Timer</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
	{#if items.length}
		<ul class="flex flex-col gap-3">
			{#each items as item (item.id)}
				<li
					class="flex flex-col gap-3 rounded-2xl p-4 transition-colors {ringing(item)
						? 'bg-amber-300 dark:bg-amber-700'
						: 'bg-white/80 dark:bg-gray-900'}"
				>
					<div class="flex items-baseline justify-between gap-3">
						<span class="truncate text-lg font-medium">{item.label}</span>
						<span class="text-4xl font-semibold tabular-nums" role="timer">
							{ringing(item) ? 'Done!' : formatDuration(item.timer.remaining)}
						</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						{#if ringing(item)}
							<button
								type="button"
								onclick={() => remove(item)}
								class="col-span-2 rounded-xl bg-blue-600 py-3 text-lg font-semibold text-white active:bg-blue-700"
							>
								Stop
							</button>
						{:else}
							<button
								type="button"
								onclick={() => toggle(item)}
								class="rounded-xl bg-blue-600 py-3 text-lg font-semibold text-white active:bg-blue-700"
							>
								{item.timer.running ? 'Pause' : 'Resume'}
							</button>
							<button
								type="button"
								onclick={() => remove(item)}
								class="rounded-xl bg-white/70 py-3 text-lg active:bg-white dark:bg-gray-800 dark:active:bg-gray-700"
							>
								Remove
							</button>
						{/if}
						<button
							type="button"
							onclick={() => item.timer.add(MINUTE)}
							class="rounded-xl bg-white/70 py-3 text-lg active:bg-white dark:bg-gray-800 dark:active:bg-gray-700"
						>
							+1 min
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold">Quick start</h2>
		<div class="grid grid-cols-3 gap-2">
			{#each presets as preset (preset)}
				<button
					type="button"
					onclick={() => add(preset * MINUTE, '')}
					class="rounded-xl bg-white/70 py-3 text-lg font-medium active:bg-white dark:bg-gray-800 dark:active:bg-gray-700"
				>
					{preset < 60 ? `${preset} min` : `${preset / 60} hr`}
				</button>
			{/each}
		</div>
	</section>

	<form class="flex flex-col gap-3" onsubmit={addCustom}>
		<h2 class="text-lg font-semibold">Custom</h2>
		<div class="grid grid-cols-[1fr_6rem] gap-2">
			<label class="flex flex-col gap-1 text-sm">
				<span>Label</span>
				<input
					bind:value={label}
					placeholder="Rice, chicken…"
					class="rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span>Minutes</span>
				<input
					type="number"
					inputmode="decimal"
					min="0"
					step="any"
					bind:value={minutes}
					class="rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
				/>
			</label>
		</div>
		<button
			type="submit"
			class="rounded-xl bg-blue-600 py-3 text-lg font-semibold text-white active:bg-blue-700"
		>
			Start timer
		</button>
	</form>

	<p class="text-sm text-gray-600 dark:text-gray-400">
		Timers are saved on this device, so they keep counting if the page reloads. Keep the page open
		to hear the alarm.
	</p>
</main>
