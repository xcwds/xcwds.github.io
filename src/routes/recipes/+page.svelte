<script lang="ts">
	import { resolve } from '$app/paths';
	import { recipes, searchRecipes } from '$lib/recipes';
	import RecipesGuideSwitch from '$lib/RecipesGuideSwitch.svelte';

	let query = $state('');
	let results = $derived(searchRecipes(recipes, query));
</script>

<svelte:head>
	<title>Recipes</title>
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-2 pb-6 sm:px-12 sm:pb-12">
	<RecipesGuideSwitch />

	<label class="flex flex-col gap-1">
		<span class="sr-only">Search recipes</span>
		<input
			type="search"
			bind:value={query}
			placeholder="Search recipes…"
			class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		/>
	</label>

	{#if results.length === 0}
		<p class="text-sm text-gray-600 dark:text-gray-400">No recipes match “{query}”.</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each results as recipe (recipe.slug)}
				<li>
					<a
						href={resolve('/recipes/[slug]', { slug: recipe.slug })}
						class="flex items-center gap-3 rounded-md bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
					>
						<span aria-hidden="true" class="text-xl">{recipe.emoji ?? '🍽️'}</span>
						<span class="flex flex-col">
							<span class="font-medium text-gray-900 dark:text-gray-100">{recipe.name}</span>
							{#if recipe.tags.length || recipe.time}
								<span class="text-xs text-gray-600 dark:text-gray-400">
									{[recipe.time, ...recipe.tags].filter(Boolean).join(' · ')}
								</span>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
