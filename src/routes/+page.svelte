<script lang="ts">
	import { resolve } from '$app/paths';
	import { recipes } from '$lib/recipes';

	const sections = [
		{
			path: '/recipes',
			emoji: '📖',
			name: 'Recipes',
			blurb: `${recipes.length} recipes from our kitchen.`
		},
		{
			path: '/utils',
			emoji: '🧰',
			name: 'Utils',
			blurb: 'Pizza dough calculator, coffee and cooking timers.'
		}
	] as const;
</script>

<svelte:head>
	<title>Chris Waters</title>
</svelte:head>

<main class="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-8 p-6 sm:p-12">
	<header class="text-center">
		<h1 class="text-3xl font-semibold text-gray-900 dark:text-gray-100">Chris Waters</h1>
	</header>

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
