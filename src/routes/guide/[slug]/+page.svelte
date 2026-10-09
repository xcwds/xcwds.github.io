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

<!-- On computers (lg+) a sticky "On this page" list sits beside the article (#95). -->
<main
	class="page-wide flex flex-col gap-6 pt-2 pb-6 text-gray-800 sm:pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start lg:gap-x-10 dark:text-gray-200"
>
	{#if article.sections.length > 2}
		<nav
			aria-label="On this page"
			class="hidden lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:flex lg:max-h-[calc(100svh-2rem)] lg:flex-col lg:gap-1 lg:overflow-y-auto"
			data-testid="toc"
		>
			<p class="px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">On this page</p>
			<ul class="flex flex-col">
				{#each article.sections as section (sectionId(section))}
					<li>
						<a
							href="#{sectionId(section)}"
							class="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-white/60 dark:hover:bg-gray-800"
							>{section.heading}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<div class="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
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
				<ul class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
					{#each related as item (item.href)}
						<li>
							<!-- The hrefs are resolved above; the lint rule can't see that. -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={item.href}
								class="flex h-full items-center gap-3 rounded-md bg-white/70 px-4 py-3 font-medium hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
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
	</div>
</main>
