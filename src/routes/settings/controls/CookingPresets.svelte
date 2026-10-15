<script lang="ts">
	/** Settings → Tool defaults: the cooking timer's quick-start buttons. */
	import { settings } from '$lib/settings.svelte';
	import { COOKING_PRESETS, parseCookingPresets } from '$lib/storage';

	// Editable copy of the presets; resets whenever the saved presets change.
	let presetsText = $derived(settings.cookingPresets.join(', '));
	let presetsError = $state('');

	function savePresets() {
		const parts = presetsText
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number);
		// The same check storage uses on load, so a saved list is never rejected later.
		const presets = parseCookingPresets(parts);
		if (!presets) {
			presetsError = `Enter 1–${COOKING_PRESETS.max} numbers of minutes, each from ${COOKING_PRESETS.minMinutes} to ${COOKING_PRESETS.maxMinutes}, separated by commas.`;
			return;
		}
		presetsError = '';
		settings.cookingPresets = presets;
		presetsText = presets.join(', ');
	}
</script>

<!-- Spaced from the tool above it in Tool defaults. -->
<div class="flex flex-col gap-3 not-first-of-type:mt-2">
	<h3 class="font-semibold">Cooking Timer</h3>
	<label class="flex flex-col gap-1 text-sm">
		<span>Quick-start buttons (minutes, separated by commas)</span>
		<input
			class="rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
			inputmode="decimal"
			bind:value={presetsText}
			onchange={savePresets}
		/>
	</label>
	{#if presetsError}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{presetsError}</p>
	{/if}
</div>
