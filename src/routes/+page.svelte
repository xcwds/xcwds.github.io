<script lang="ts">
	import { resolve } from '$app/paths';
	import Acronym from '$lib/Acronym.svelte';
	import { ACRONYM, BRAND, TAGLINE } from '$lib/brand';
	import { recipes } from '$lib/recipes';
	import { tools } from '$lib/utils/tools';

	const sections = [
		{
			path: '/recipes',
			emoji: '📖',
			name: 'Recipes',
			blurb: `${recipes.length} classic back-pocket recipes.`
		},
		{
			path: '/utils',
			emoji: '🧰',
			name: 'Utils',
			blurb: tools.map((tool) => tool.name).join(', ')
		}
	] as const;
</script>

<svelte:head>
	<title>{BRAND}</title>
	<meta name="description" content="{BRAND}: {TAGLINE} {ACRONYM}." />
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-8 px-6 pt-2 pb-6 sm:px-12 sm:pb-12">
	<div class="flex flex-col gap-1">
		<p class="text-gray-700 dark:text-gray-300">{TAGLINE}</p>
		<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="acronym">
			<Acronym phrase={ACRONYM} />
		</p>
	</div>

	<nav aria-label="Sections">
		<ul class="grid gap-3 sm:grid-cols-2">
			{#each sections as section (section.path)}
				<li>
					<a
						href={resolve(section.path)}
						class="flex h-full items-center gap-4 rounded-xl bg-white/70 px-5 py-4 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
					>
						<span aria-hidden="true" class="text-3xl">{section.emoji}</span>
						<span class="flex flex-col">
							<span class="text-lg font-medium text-gray-900 dark:text-gray-100"
								>{section.name}</span
							>
							<span class="text-sm text-gray-600 dark:text-gray-400">{section.blurb}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</main>
