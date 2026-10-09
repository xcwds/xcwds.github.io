<script lang="ts">
	import type { UnitSystem } from '$lib/recipes/units';
	import { settings } from '$lib/settings.svelte';

	/**
	 * US or metric for recipe ingredients (a tool default in Settings, saved as
	 * `settings.recipeUnits`). On a recipe, pass its `native` system: with nothing chosen yet, that
	 * one shows as selected. Without `native` (Settings), "As written" clears the choice.
	 */
	let { native }: { native?: UnitSystem } = $props();

	const labels: Record<UnitSystem | 'written', string> = {
		written: 'As written',
		us: 'US',
		metric: 'Metric'
	};
	let options = $derived<(UnitSystem | null)[]>(native ? ['us', 'metric'] : [null, 'us', 'metric']);
	let selected = $derived(settings.recipeUnits ?? native ?? null);

	function choose(option: UnitSystem | null) {
		// Tapping what a recipe already shows isn't a choice: saving it would convert every recipe
		// written in the other system.
		if (native && settings.recipeUnits === null && option === native) return;
		settings.recipeUnits = option;
	}
</script>

<div
	class="grid gap-2 {options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}"
	role="radiogroup"
	aria-label="Recipe units"
>
	{#each options as option (option ?? 'written')}
		<button
			type="button"
			role="radio"
			aria-checked={selected === option}
			class="min-h-11 rounded-xl px-3 py-2 text-sm font-medium {selected === option
				? 'bg-blue-600 text-white'
				: 'bg-white/70 hover:not-disabled:bg-white active:bg-white dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700'}"
			onclick={() => choose(option)}
		>
			{labels[option ?? 'written']}
		</button>
	{/each}
</div>
