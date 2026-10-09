<script lang="ts">
	import { resolve } from '$app/paths';
	import { getArticle, sectionId } from '$lib/guide';
	import GuideBlock from '$lib/guide/GuideBlock.svelte';
	import { getRecipe } from '$lib/recipes';
	import { tools } from '$lib/utils/tools';

	let { data } = $props();
	let article = $derived(data.article);

	// Related articles, recipes and tools, as cards at the end (guide.spec.ts checks they exist).
	let related = $derived([
		...(article.related?.guides ?? []).map((slug) => {
			const a = getArticle(slug)!;
			return { href: resolve('/guide/[slug]', { slug }), emoji: a.emoji, name: a.name };
		}),
		...(article.related?.recipes ?? []).map((slug) => {
			const r = getRecipe(slug)!;
			return { href: resolve('/recipes/[slug]', { slug }), emoji: r.emoji ?? '🍽️', name: r.name };
		}),
		...(article.related?.tools ?? []).map((path) => {
			const t = tools.find((tool) => tool.path === path)!;
			return { href: resolve(t.path), emoji: t.emoji, name: t.name };
		})
	]);
</script>

<svelte:head>
	<title>{article.name}</title>
	<meta name="description" content={article.summary} />
</svelte:head>

<main class="page-wide flex flex-col gap-6 pt-2 pb-6 text-gray-800 sm:pb-12 dark:text-gray-200">
	<p>{article.summary}</p>

	{#each article.sections as section (sectionId(section))}
		<section class="flex scroll-mt-20 flex-col gap-3" id={sectionId(section)}>
			<h2 class="text-lg font-semibold">{section.heading}</h2>
			{#each section.blocks as block, i (i)}
				<GuideBlock {block} />
			{/each}
		</section>
	{/each}

	{#if related.length}
		<section class="flex flex-col gap-2" aria-labelledby="related">
			<h2 id="related" class="text-lg font-semibold">Related</h2>
			<ul class="flex flex-col gap-2">
				{#each related as item (item.href)}
					<li>
						<!-- The hrefs are resolved above; the lint rule can't see that. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={item.href}
							class="flex items-center gap-3 rounded-md bg-white/70 px-4 py-3 font-medium hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
						>
							<span aria-hidden="true" class="text-xl">{item.emoji}</span>
							{item.name}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>
