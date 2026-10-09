<script lang="ts">
	import { resolve } from '$app/paths';
	import { articles, byCategory, searchArticles } from '$lib/guide';
	import RecipesGuideSwitch from '$lib/RecipesGuideSwitch.svelte';

	let query = $state('');
	let groups = $derived(byCategory(searchArticles(articles, query)));
</script>

<svelte:head>
	<title>Kitchen Guide</title>
	<meta
		name="description"
		content="Cooking and baking know-how: which method to use, cuts of meat, measuring, ovens and pans, doneness and kitchen basics."
	/>
</svelte:head>

<main class="page-wide flex flex-col gap-6 pt-2 pb-6 sm:pb-12">
	<RecipesGuideSwitch />

	<label class="flex flex-col gap-1">
		<span class="sr-only">Search the kitchen guide</span>
		<input
			type="search"
			bind:value={query}
			placeholder="Search the guide…"
			class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		/>
	</label>

	{#if groups.length === 0}
		<p class="text-sm text-gray-600 dark:text-gray-400">No articles match “{query}”.</p>
	{:else}
		{#each groups as group (group.id)}
			<section class="flex flex-col gap-2" aria-labelledby="category-{group.id}">
				<h2
					id="category-{group.id}"
					class="text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
				>
					{group.label}
				</h2>
				<ul class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
					{#each group.articles as article (article.slug)}
						<li>
							<a
								href={resolve('/guide/[slug]', { slug: article.slug })}
								class="flex h-full items-center gap-3 rounded-md bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
							>
								<span aria-hidden="true" class="text-xl">{article.emoji}</span>
								<span class="flex flex-col">
									<span class="font-medium text-gray-900 dark:text-gray-100">{article.name}</span>
									<span class="text-xs text-gray-600 dark:text-gray-400">{article.summary}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</main>
