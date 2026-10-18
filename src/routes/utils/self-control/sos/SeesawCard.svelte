<script lang="ts">
	import { seesawForSos, type Seesaw } from '#lib/self-control/seesaw.js';
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { entries, read } from '#lib/storage.js';
	import { card } from '../styles';

	/** The seesaw (#151) for the urge's habit: what giving in costs later, what holding off gets. */
	let { habit }: { habit?: string } = $props();

	let seesaw = $state<Seesaw | undefined>();
	$effect(() => {
		if (settingsStatus.ready) seesaw = read(entries.selfControlSeesaw);
	});
	const shown = $derived(seesawForSos(seesaw, habit));
</script>

{#if shown.costs.length || shown.gains.length}
	<details class="{card} text-sm" data-testid="sos-seesaw">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold">Your seesaw</summary>
		<div class="mt-2 flex flex-col gap-3">
			{#if shown.costs.length}
				<div>
					<p class="text-gray-600 dark:text-gray-400">Giving in costs you later</p>
					<ul class="list-disc pl-5">
						{#each shown.costs as item (item.id)}
							<li>{item.text}</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if shown.gains.length}
				<div>
					<p class="text-gray-600 dark:text-gray-400">Holding off gets you later</p>
					<ul class="list-disc pl-5">
						{#each shown.gains as item (item.id)}
							<li>{item.text}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</details>
{/if}
