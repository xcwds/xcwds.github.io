<script lang="ts">
	/** Settings → Tool defaults: recipes' ingredient units. */
	import RecipeUnitsToggle from '#lib/RecipeUnitsToggle.svelte';
</script>

<!-- Spaced from the tool above it in Tool defaults. -->
<div class="flex flex-col gap-3 not-first-of-type:mt-2">
	<h3 class="font-semibold">Recipes</h3>
	<RecipeUnitsToggle />
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Ingredient units. “As written” shows each recipe in the units it was written in.
	</p>
</div>
