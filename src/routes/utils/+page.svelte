<script lang="ts">
	import { resolve } from '$app/paths';
	import { appIsOn } from '#lib/apps.svelte.js';
	import { shortcuts, togglePin } from '#lib/home.svelte.js';
	import { tools } from '#lib/utils/tools.js';
</script>

<svelte:head>
	<title>Utils</title>
</svelte:head>

<main class="page-wide flex flex-col gap-6 pt-2 pb-6 sm:pb-12">
	<p class="text-sm text-gray-600 dark:text-gray-400">
		<a
			href={resolve('/apps')}
			class="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
			>Choose apps</a
		> to show only the tools you use.
	</p>
	{#if appIsOn('blocks')}
		<!-- Your apps (#224): the ones you've made show in the list below, too. -->
		<a
			href={resolve('/my-apps')}
			data-app="blocks"
			class="flex items-center gap-3 self-start rounded-md bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
			data-testid="your-apps-link"
		>
			<span aria-hidden="true" class="text-2xl">🧩</span>
			<span class="flex flex-col">
				<span class="font-medium text-gray-900 dark:text-gray-100">Your apps</span>
				<span class="text-sm text-gray-600 dark:text-gray-400"
					>Build your own checklists, counters and logs, or start from a template.</span
				>
			</span>
		</a>
	{/if}
	<ul class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
		{#each tools() as tool (tool.path)}
			{@const pinned = shortcuts.pins.includes(tool.path)}
			<!-- `data-app` hides it before the page starts when its app is off (app.css). -->
			<li class="flex items-stretch gap-2" data-app={tool.app}>
				<a
					href={resolve(tool.path as '/')}
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
