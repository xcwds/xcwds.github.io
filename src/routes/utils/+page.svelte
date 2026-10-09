<script lang="ts">
	import { resolve } from '$app/paths';
	import { shortcuts, togglePin } from '$lib/home.svelte';
	import { tools } from '$lib/utils/tools';
</script>

<svelte:head>
	<title>Utils</title>
</svelte:head>

<main class="page-wide flex flex-col gap-6 pt-2 pb-6 sm:pb-12">
	<ul class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
		{#each tools as tool (tool.path)}
			{@const pinned = shortcuts.pins.includes(tool.path)}
			<li class="flex items-stretch gap-2">
				<a
					href={resolve(tool.path)}
					class="flex flex-1 items-center gap-3 rounded-md bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
				>
					<span aria-hidden="true" class="text-2xl">{tool.emoji}</span>
					<span class="flex flex-col">
						<span class="font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
						<span class="text-sm text-gray-600 dark:text-gray-400">{tool.blurb}</span>
					</span>
				</a>
				<button
					type="button"
					class="min-w-11 rounded-md px-2 text-xl {pinned
						? 'bg-amber-200 dark:bg-amber-800'
						: 'bg-white/70 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800'}"
					aria-pressed={pinned}
					aria-label="Pin {tool.name} to Home"
					onclick={() => togglePin(tool.path)}
				>
					<span aria-hidden="true">{pinned ? '★' : '☆'}</span>
				</button>
			</li>
		{/each}
	</ul>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Pin the tools you use most (☆) to reach them from Home in one tap.
	</p>
</main>
