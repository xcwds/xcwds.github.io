<script lang="ts">
	/** Warnings from ovenWarnings(), next to an oven time estimate. */
	let { warnings }: { warnings: string[] } = $props();
</script>

<!--
	Screen readers only announce changes to a live region that's already in the DOM, so this one
	always is. It's visually hidden (and takes no space in the surrounding flex layout); the visible
	list below is hidden from screen readers so the warnings aren't read twice.
-->
<div class="sr-only" role="status">{warnings.join(' ')}</div>
{#if warnings.length}
	<ul class="flex flex-col gap-1 text-left text-sm" aria-hidden="true" data-testid="oven-warnings">
		{#each warnings as warning (warning)}
			<li
				class="rounded-md bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
			>
				{warning}
			</li>
		{/each}
	</ul>
{/if}
