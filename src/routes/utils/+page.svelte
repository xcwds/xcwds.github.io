<script lang="ts">
	import { resolve } from '$app/paths';
	import { tools } from '$lib/utils/tools';
</script>

<svelte:head>
	<title>Utils</title>
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-2 pb-6 sm:px-12 sm:pb-12">
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
