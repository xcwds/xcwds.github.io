<script lang="ts">
	import { resolve } from '$app/paths';

	const tools = [
		{
			path: '/utils/pizza-dough',
			emoji: '🍕',
			name: 'Pizza Dough Calculator',
			blurb: 'Ingredient weights from dough balls and hydration.'
		},
		{
			path: '/utils/coffee-timer',
			emoji: '☕',
			name: 'Coffee Timer',
			blurb: '90-second countdown with quick adjustments.'
		},
		{
			path: '/utils/cooking-timer',
			emoji: '⏲️',
			name: 'Cooking Timer',
			blurb: 'Several labeled timers at once.'
		}
	] as const;
</script>

<svelte:head>
	<title>Utils</title>
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-12">
	<h1 class="text-2xl font-semibold text-gray-800 dark:text-gray-100">Utils</h1>
	<ul class="flex flex-col gap-2">
		{#each tools as tool (tool.path)}
			<li>
				<a
					href={resolve(tool.path)}
					class="flex items-center gap-3 rounded-md bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
				>
					<span aria-hidden="true" class="text-2xl">{tool.emoji}</span>
					<span class="flex flex-col">
						<span class="font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
						<span class="text-sm text-gray-600 dark:text-gray-400">{tool.blurb}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</main>
