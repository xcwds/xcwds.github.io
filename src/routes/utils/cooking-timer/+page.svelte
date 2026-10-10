<script lang="ts">
	import GuideLinks from '$lib/guide/GuideLinks.svelte';
	import { toolGuides } from '$lib/utils/tools';
	import { settings } from '$lib/settings.svelte';
	import { MINUTE, useCookingTimers } from '$lib/utils/cooking-timers.svelte';
	import { formatDuration } from '$lib/utils/time';

	/** Quick-start buttons, in minutes (Settings → Tool defaults). */
	let presets = $derived(settings.cookingPresets);
	const presetLabel = (m: number) =>
		m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`;

	// Saved timers, shared with recipe step timers; the root layout rings them on every page.
	const timers = useCookingTimers();
	// This page lists every cooking timer, so finished ones don't also show as alerts.
	timers.showAll();

	let label = $state('');
	let minutes = $state<number | null>(null);

	function addCustom(event: SubmitEvent) {
		event.preventDefault();
		if (!minutes || minutes <= 0) return;
		timers.add(minutes * MINUTE, label.trim());
		label = '';
		minutes = null;
	}
</script>

<svelte:head>
	<title>Cooking Timer</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	{#if timers.items.length}
		<ul class="flex flex-col gap-3">
			{#each timers.items as item (item.id)}
				<li
					class="flex flex-col gap-3 rounded-2xl p-4 transition-colors {timers.ringing(item)
						? 'bg-amber-300 dark:bg-amber-700'
						: 'bg-white/80 dark:bg-gray-900'}"
				>
					<div class="flex items-baseline justify-between gap-3">
						<span class="truncate text-lg font-medium">{item.label}</span>
						<span class="text-4xl font-semibold tabular-nums" role="timer">
							{timers.ringing(item) ? 'Done!' : formatDuration(item.timer.remaining)}
						</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						{#if timers.ringing(item)}
							<button
								type="button"
								onclick={() => timers.remove(item)}
								class="col-span-2 rounded-xl bg-blue-600 py-3 text-lg font-semibold text-white hover:not-disabled:bg-blue-700 active:bg-blue-700"
							>
								Stop
							</button>
						{:else}
							<button
								type="button"
								onclick={() => timers.toggle(item)}
								class="rounded-xl bg-blue-600 py-3 text-lg font-semibold text-white hover:not-disabled:bg-blue-700 active:bg-blue-700"
							>
								{item.timer.running ? 'Pause' : 'Resume'}
							</button>
							<button
								type="button"
								onclick={() => timers.remove(item)}
								class="rounded-xl bg-white/70 py-3 text-lg hover:not-disabled:bg-white active:bg-white dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700"
							>
								Remove
							</button>
						{/if}
						<button
							type="button"
							onclick={() => item.timer.add(MINUTE)}
							class="rounded-xl bg-white/70 py-3 text-lg hover:not-disabled:bg-white active:bg-white dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700"
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
					onclick={() => timers.add(preset * MINUTE, '')}
					class="rounded-xl bg-white/70 py-3 text-lg font-medium hover:not-disabled:bg-white active:bg-white dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700"
				>
					{presetLabel(preset)}
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
			class="rounded-xl bg-blue-600 py-3 text-lg font-semibold text-white hover:not-disabled:bg-blue-700 active:bg-blue-700"
		>
			Start timer
		</button>
	</form>

	<p class="text-sm text-gray-600 dark:text-gray-400">
		Timers are saved on this device, so they keep counting if the page reloads. The alarm rings on
		any page of the app while it's open.
	</p>

	<GuideLinks slugs={toolGuides('/utils/cooking-timer')} />
</main>
