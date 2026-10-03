<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let recipe = $derived(data.recipe);
</script>

<svelte:head>
	<title>{recipe.name}</title>
	<meta name="description" content={recipe.description} />
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-6 p-6 text-gray-800 sm:p-12 dark:text-gray-200">
	<a href={resolve('/recipes')} class="text-sm text-gray-600 hover:underline dark:text-gray-400">
		← All recipes
	</a>

	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
			{#if recipe.emoji}<span aria-hidden="true">{recipe.emoji}</span>{/if}
			{recipe.name}
		</h1>
		<p>{recipe.description}</p>
		<dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
			{#if recipe.servings}
				<div class="flex gap-1">
					<dt class="font-medium">Yield:</dt>
					<dd>{recipe.servings}</dd>
				</div>
			{/if}
			{#if recipe.time}
				<div class="flex gap-1">
					<dt class="font-medium">Time:</dt>
					<dd>{recipe.time}</dd>
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

	<section class="flex flex-col gap-2">
		<h2 class="text-lg font-semibold">Ingredients</h2>
		<ul class="list-disc pl-6">
			{#each recipe.ingredients as ingredient, i (i)}
				<li>{ingredient}</li>
			{/each}
		</ul>
	</section>

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
