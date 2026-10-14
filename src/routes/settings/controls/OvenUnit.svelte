<script lang="ts">
	/** Settings → Tool defaults: the oven converter's temperature unit. */
	import TempUnitToggle from '$lib/TempUnitToggle.svelte';
</script>

<!-- Spaced from the tool above it in Tool defaults. -->
<div class="flex flex-col gap-3 not-first-of-type:mt-2">
	<h3 class="font-semibold">Oven Time Converter</h3>
	<TempUnitToggle />
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Also used by the “different temperature” panel on recipes.
	</p>
</div>
