<script lang="ts">
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { whyForSos, type Why } from '#lib/self-control/why.js';
	import { entries, read } from '#lib/storage.js';
	import { card } from '../styles';

	/** "Your why" (#150) for the urge's habit, under the technique: folded, one tap to open. */
	let { habit }: { habit?: string } = $props();

	let why = $state<Why | undefined>();
	$effect(() => {
		if (settingsStatus.ready) why = read(entries.selfControlWhy);
	});
	const shown = $derived(whyForSos(why, habit));
</script>

{#if shown.reasons.length || shown.note}
	<details class="{card} text-sm" data-testid="sos-why">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold">Your why</summary>
		<div class="mt-2 flex flex-col gap-3">
			{#if shown.note}
				<figure class="flex flex-col gap-1">
					<figcaption class="text-gray-600 dark:text-gray-400">A note from you</figcaption>
					<blockquote class="whitespace-pre-line italic">{shown.note}</blockquote>
				</figure>
			{/if}
			{#if shown.reasons.length}
				<ul class="flex flex-col gap-1">
					{#each shown.reasons as reason (reason.id)}
						<li>{reason.starred ? '⭐ ' : '• '}{reason.text}</li>
					{/each}
				</ul>
			{/if}
		</div>
	</details>
{/if}
