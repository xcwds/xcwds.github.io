<script lang="ts">
	import { resolve } from '$app/paths';
	import { getArticle } from '$lib/guide';

	/** Kitchen Guide articles to point to, by slug (specs check they exist). */
	let { slugs }: { slugs: readonly string[] } = $props();
	let links = $derived(slugs.map(getArticle).filter((a) => a !== undefined));
</script>

{#if links.length}
	<section class="flex flex-col gap-2" aria-labelledby="learn-more">
		<h2 id="learn-more" class="text-lg font-semibold">Learn more</h2>
		<ul class="flex flex-col gap-2">
			{#each links as article (article.slug)}
				<li>
					<a
						href={resolve('/guide/[slug]', { slug: article.slug })}
						class="flex items-center gap-3 rounded-md bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
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
{/if}
