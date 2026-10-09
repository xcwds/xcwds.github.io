<script lang="ts">
	import { resolve } from '$app/paths';
	import { CookingTimers, MINUTE } from '$lib/utils/cooking-timers.svelte';
	import { formatDuration } from '$lib/utils/time';

	/** Running cooking timers, pinned to the bottom of the recipe so they're in view while cooking. */
	let { timers }: { timers: CookingTimers } = $props();

	const small =
		'min-h-11 min-w-11 rounded-xl bg-white/70 px-3 text-sm active:bg-white dark:bg-gray-800 dark:active:bg-gray-700';
</script>

{#if timers.items.length}
	<section
		aria-label="Timers"
		data-testid="timer-tray"
		class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-2xl bg-blue-50/95 p-3 shadow-lg backdrop-blur md:bottom-4 lg:col-start-2 dark:bg-gray-900/95"
	>
		<ul class="flex flex-col gap-2">
			{#each timers.items as item (item.id)}
				{@const ringing = timers.ringing(item)}
				<li
					class="flex items-center gap-2 rounded-xl px-2 {ringing
						? 'bg-amber-300 dark:bg-amber-700'
						: ''}"
				>
					<span class="min-w-0 flex-1 truncate">{item.label}</span>
					<span class="font-semibold tabular-nums" role="timer">
						{ringing ? 'Done!' : formatDuration(item.timer.remaining)}
					</span>
					{#if ringing}
						<button type="button" class={small} onclick={() => item.timer.add(MINUTE)}>
							+1 min
						</button>
						<button
							type="button"
							class="min-h-11 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white active:bg-blue-700"
							onclick={() => timers.remove(item)}
						>
							Stop
						</button>
					{:else}
						<button type="button" class={small} onclick={() => timers.toggle(item)}>
							{item.timer.running ? 'Pause' : 'Resume'}
						</button>
						<button
							type="button"
							class={small}
							aria-label="Remove {item.label} timer"
							onclick={() => timers.remove(item)}
						>
							✕
						</button>
					{/if}
				</li>
			{/each}
		</ul>
		<a
			class="flex min-h-11 items-center self-end px-2 text-sm underline"
			href={resolve('/utils/cooking-timer')}>All timers</a
		>
	</section>
{/if}
