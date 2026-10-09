<script lang="ts">
	import { resolve } from '$app/paths';
	import Acronym from '$lib/Acronym.svelte';
	import { ACRONYM, BRAND, TAGLINE } from '$lib/brand';
	import { movePin, shortcuts, togglePin } from '$lib/home.svelte';
	import { recipes } from '$lib/recipes';
	import { tools } from '$lib/utils/tools';

	const toolAt = (path: string) => tools.find((t) => t.path === path);
	let pinned = $derived(shortcuts.pins.map(toolAt).filter((t) => t !== undefined));
	// Recently used tools that aren't already pinned.
	let recent = $derived(
		shortcuts.recent
			.filter((p) => !shortcuts.pins.includes(p))
			.map(toolAt)
			.filter((t) => t !== undefined)
	);
	let editing = $state(false);
	// Leave edit mode once nothing is pinned, so a new pin doesn't open in it.
	$effect(() => {
		if (!pinned.length) editing = false;
	});

	const small =
		'min-h-11 min-w-11 rounded-lg bg-white/70 px-2 text-sm hover:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:bg-gray-700';

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

<main class="page-wide flex flex-col gap-8 pt-2 pb-6 sm:pb-12">
	<div class="flex flex-col gap-1">
		<p class="text-gray-700 dark:text-gray-300">{TAGLINE}</p>
		<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="acronym">
			<Acronym phrase={ACRONYM} />
		</p>
	</div>

	{#if pinned.length}
		<section class="flex flex-col gap-2" aria-labelledby="pinned" data-testid="pinned">
			<div class="flex items-center justify-between">
				<h2
					id="pinned"
					class="text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
				>
					Pinned
				</h2>
				<button
					type="button"
					class={small}
					aria-pressed={editing}
					onclick={() => (editing = !editing)}
				>
					{editing ? 'Done' : 'Edit'}
				</button>
			</div>
			<ul class="flex flex-col gap-2">
				{#each pinned as tool, i (tool.path)}
					<li class="flex items-stretch gap-2">
						<a
							href={resolve(tool.path)}
							class="flex flex-1 items-center gap-3 rounded-xl bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
						>
							<span aria-hidden="true" class="text-2xl">{tool.emoji}</span>
							<span class="font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
						</a>
						{#if editing}
							<button
								type="button"
								class={small}
								aria-label="Move {tool.name} up"
								disabled={i === 0}
								onclick={() => movePin(tool.path, -1)}>↑</button
							>
							<button
								type="button"
								class={small}
								aria-label="Move {tool.name} down"
								disabled={i === pinned.length - 1}
								onclick={() => movePin(tool.path, 1)}>↓</button
							>
							<button
								type="button"
								class={small}
								aria-label="Unpin {tool.name}"
								onclick={() => togglePin(tool.path)}>✕</button
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if recent.length}
		<section class="flex flex-col gap-2" aria-labelledby="recent" data-testid="recent">
			<h2
				id="recent"
				class="text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
			>
				Recently used
			</h2>
			<ul class="flex flex-col gap-2">
				{#each recent as tool (tool.path)}
					<li>
						<a
							href={resolve(tool.path)}
							class="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800"
						>
							<span aria-hidden="true" class="text-2xl">{tool.emoji}</span>
							<span class="font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

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
