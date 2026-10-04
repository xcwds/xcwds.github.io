<script lang="ts">
	import { formatIngredient, formatYield, isScalable } from '$lib/recipes/scale';
	import { settings } from '$lib/settings.svelte';
	import { asRange, formatMinutesRange, formatTemp } from '$lib/utils/oven';
	import OvenPanel from './OvenPanel.svelte';

	let { data } = $props();
	let recipe = $derived(data.recipe);

	// Servings target: starts at the recipe's yield (again whenever the recipe changes).
	let base = $derived(recipe.yield);
	let scalable = $derived(base !== undefined && recipe.ingredients.some(isScalable));
	let stepSize = $derived(base?.step ?? 1);
	let target = $derived(base?.amount ?? 1);
	let factor = $derived(base ? target / base.amount : 1);
	let ingredients = $derived(recipe.ingredients.map((i) => formatIngredient(i, factor)));

	/** Steps to the next multiple of the step size, so 24 → 36 → 48 even from an odd yield. */
	function stepTarget(direction: 1 | -1) {
		const n = target / stepSize;
		const next = direction === 1 ? Math.floor(n + 1e-9) + 1 : Math.ceil(n - 1e-9) - 1;
		target = Math.max(1, next) * stepSize;
	}
</script>

<svelte:head>
	<title>{recipe.name}</title>
	<meta name="description" content={recipe.description} />
</svelte:head>

<main
	class="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-2 pb-6 text-gray-800 sm:px-12 sm:pb-12 dark:text-gray-200"
>
	<header class="flex flex-col gap-2">
		<p>{recipe.description}</p>
		<dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
			{#if base || recipe.servings}
				<div class="flex gap-1">
					<dt class="font-medium">Yield:</dt>
					<dd>{base ? formatYield(base.amount, base) : recipe.servings}</dd>
				</div>
			{/if}
			{#if recipe.time}
				<div class="flex gap-1">
					<dt class="font-medium">Time:</dt>
					<dd>{recipe.time}</dd>
				</div>
			{/if}
			{#if recipe.oven}
				<div class="flex gap-1">
					<dt class="font-medium">Oven:</dt>
					<dd>
						{formatTemp(recipe.oven.temp, settings.ovenUnit)} ·
						{formatMinutesRange(asRange(recipe.oven.minutes))}
					</dd>
				</div>
			{/if}
		</dl>
		{#if recipe.tags.length}
			<ul class="flex flex-wrap gap-2">
				{#each recipe.tags as tag (tag)}
					<li class="rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-gray-800">{tag}</li>
				{/each}
			</ul>
		{/if}
	</header>

	{#if recipe.notes?.length}
		<ul class="flex flex-col gap-1 text-sm">
			{#each recipe.notes as note (note)}
				<li>{note}</li>
			{/each}
		</ul>
	{/if}

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold">Ingredients</h2>
		{#if scalable && base}
			<div class="flex flex-wrap items-center gap-2" data-testid="servings">
				<button
					type="button"
					class="size-11 rounded-full bg-white/70 text-xl hover:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:bg-gray-700"
					aria-label="Fewer {base.unit}"
					disabled={target <= stepSize}
					onclick={() => stepTarget(-1)}>−</button
				>
				<output
					class="min-w-28 text-center font-semibold tabular-nums"
					aria-live="polite"
					data-testid="servings-target">{formatYield(target, base)}</output
				>
				<button
					type="button"
					class="size-11 rounded-full bg-white/70 text-xl hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
					aria-label="More {base.unit}"
					onclick={() => stepTarget(1)}>+</button
				>
				{#if factor !== 1}
					<button
						type="button"
						class="rounded-md bg-white/70 px-3 py-2 text-sm hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
						onclick={() => (target = base.amount)}
					>
						Reset to {formatYield(base.amount, base)}
					</button>
				{/if}
			</div>
			{#if factor !== 1}
				<p class="text-sm text-amber-800 dark:text-amber-300" data-testid="scaled-note">
					Quantities scaled ×{Math.round(factor * 100) / 100}. Times and pan sizes are not; check
					doneness as you go.
				</p>
			{/if}
		{/if}
		<ul class="list-disc pl-6" data-testid="ingredients">
			{#each ingredients as ingredient, i (i)}
				<li>
					{#if ingredient.quantity}<strong class="font-semibold">{ingredient.quantity}</strong
						>{/if}{ingredient.quantity ? ' ' : ''}{ingredient.text}
				</li>
			{/each}
		</ul>
	</section>

	{#if recipe.oven}
		{#key recipe.slug}
			<OvenPanel oven={recipe.oven} />
		{/key}
	{/if}

	<section class="flex flex-col gap-2">
		<h2 class="text-lg font-semibold">Instructions</h2>
		<ol class="flex list-decimal flex-col gap-2 pl-6">
			{#each recipe.instructions as step, i (i)}
				<li>{step}</li>
			{/each}
		</ol>
	</section>

	{#if recipe.tips?.length}
		<section class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">Tips</h2>
			<ul class="flex list-disc flex-col gap-1 pl-6">
				{#each recipe.tips as tip, i (i)}
					<li>{tip}</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if recipe.source}
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Source: <a href={recipe.source} class="underline" rel="external noopener">{recipe.source}</a>
		</p>
	{/if}
</main>
