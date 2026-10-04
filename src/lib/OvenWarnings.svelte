<script lang="ts">
	/** Warnings from ovenWarnings(), next to an oven time estimate. */
	let { warnings }: { warnings: string[] } = $props();
</script>

{#if warnings.length}
	<ul class="flex flex-col gap-1 text-left text-sm" role="status" data-testid="oven-warnings">
		{#each warnings as warning (warning)}
			<li
				class="rounded-md bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
			>
				{warning}
			</li>
		{/each}
	</ul>
{/if}
