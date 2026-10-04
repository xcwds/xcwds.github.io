<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast.svelte';
	import {
		historyToText,
		workoutSummary,
		workoutToText,
		type HistoryEntry
	} from '$lib/utils/lifting';
	import { button, card } from './styles';

	let {
		history = $bindable([]),
		onRepeat
	}: { history?: HistoryEntry[]; onRepeat: (entry: HistoryEntry) => void } = $props();

	let canShare = $state(false);
	onMount(() => {
		canShare = typeof navigator.share === 'function';
	});

	async function copy(text: string, message: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast(message);
		} catch {
			toast("Couldn't copy.");
		}
	}

	async function share(text: string) {
		try {
			await navigator.share({ text });
		} catch {
			// Share sheet dismissed.
		}
	}

	function remove(entry: HistoryEntry) {
		if (!confirm(`Delete the workout from ${entry.workout.date}? This can't be undone.`)) return;
		history = history.filter((h) => h.id !== entry.id);
		toast('Workout deleted.');
	}
</script>

<section class="flex flex-col gap-4">
	{#if history.length === 0}
		<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="history-empty">
			No saved workouts yet. Tap <strong>Finish workout</strong> on the Workout tab to save one here.
		</p>
	{:else}
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm text-gray-600 dark:text-gray-400">
				{history.length}
				{history.length === 1 ? 'workout' : 'workouts'}, newest first
			</p>
			<button
				type="button"
				class="{button} text-sm"
				onclick={() => copy(historyToText(history), 'All workouts copied.')}>Copy all</button
			>
		</div>
		<ul class="flex flex-col gap-3">
			{#each history as entry (entry.id)}
				<li class="{card} flex flex-col gap-2" data-testid="history-entry">
					<details>
						<summary class="cursor-pointer">
							<span class="font-semibold">{entry.workout.date}</span>
							<span class="text-sm text-gray-600 dark:text-gray-400"
								>· {workoutSummary(entry.workout)}</span
							>
						</summary>
						<pre
							class="mt-2 overflow-x-auto font-sans text-sm whitespace-pre-wrap"
							data-testid="history-text">{workoutToText(entry.workout)}</pre>
					</details>
					<div class="grid gap-2 text-sm {canShare ? 'grid-cols-4' : 'grid-cols-3'}">
						<button
							type="button"
							class={button}
							onclick={() => copy(workoutToText(entry.workout), 'Workout copied.')}>Copy</button
						>
						{#if canShare}
							<button
								type="button"
								class={button}
								onclick={() => share(workoutToText(entry.workout))}>Share</button
							>
						{/if}
						<button type="button" class={button} onclick={() => onRepeat(entry)}>Repeat</button>
						<button
							type="button"
							class={button}
							aria-label="Delete workout from {entry.workout.date}"
							onclick={() => remove(entry)}>Delete</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
