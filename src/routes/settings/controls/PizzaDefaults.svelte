<script lang="ts">
	/** Settings → Tool defaults: the pizza dough calculator's saved defaults, and a reset. */
	import { settings } from '#lib/settings.svelte.js';
	import { doughDefaults } from '#lib/utils/dough.js';

	let pizza = $derived(settings.pizzaDefaults);
	let pizzaIsBuiltIn = $derived(
		(Object.keys(doughDefaults) as (keyof typeof doughDefaults)[]).every(
			(k) => pizza[k] === doughDefaults[k]
		)
	);

	const button =
		'rounded-xl bg-white/70 px-3 py-2 font-medium hover:not-disabled:bg-white active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700';
</script>

<!-- Spaced from the tool above it in Tool defaults. -->
<div class="flex flex-col gap-3 not-first-of-type:mt-2">
	<h3 class="font-semibold">Pizza Dough Calculator</h3>
	<p class="text-sm" data-testid="pizza-defaults">
		{pizza.balls} × {pizza.ballWeight} g · {pizza.hydration}% hydration · {pizza.salt}% salt ·
		{pizza.yeast}% yeast · {pizza.oil}% oil · {pizza.sugar}% sugar
	</p>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Always in grams. Change these with <strong>Save as my defaults</strong> in the calculator.
	</p>
	<button
		type="button"
		class="{button} text-sm"
		disabled={pizzaIsBuiltIn}
		onclick={() => (settings.pizzaDefaults = { ...doughDefaults })}
	>
		Restore built-in pizza defaults
	</button>
</div>
