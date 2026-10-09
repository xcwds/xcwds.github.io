<script lang="ts">
	import type { Block } from '$lib/guide';
	import DonenessChart from './DonenessChart.svelte';
	import InlineText from './InlineText.svelte';
	import TimerButtons from './TimerButtons.svelte';

	let { block }: { block: Block } = $props();
</script>

{#if typeof block === 'string'}
	<p><InlineText text={block} /></p>
{:else if block.type === 'list'}
	<svelte:element
		this={block.ordered ? 'ol' : 'ul'}
		class="flex flex-col gap-1 pl-6 {block.ordered ? 'list-decimal' : 'list-disc'}"
	>
		{#each block.items as item, i (i)}
			<li><InlineText text={item} /></li>
		{/each}
	</svelte:element>
{:else if block.type === 'tip'}
	<aside
		class="rounded-xl bg-blue-50 px-4 py-3 text-blue-950 dark:bg-blue-950/60 dark:text-blue-100"
		aria-label="Tip"
	>
		<span aria-hidden="true">💡</span>
		<InlineText text={block.text} />
	</aside>
{:else if block.type === 'warning'}
	<aside
		class="rounded-xl bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100"
		aria-label="Warning"
	>
		<span aria-hidden="true">⚠️</span>
		<InlineText text={block.text} />
	</aside>
{:else if block.type === 'table'}
	<!-- Phones: one card per row, so the page never scrolls sideways. -->
	<div class="flex flex-col gap-2 md:hidden" data-testid="guide-table-cards">
		{#if block.caption}<p class="text-sm font-medium">{block.caption}</p>{/if}
		{#each block.rows as row, r (r)}
			<div class="rounded-xl bg-white/70 px-4 py-3 dark:bg-gray-900">
				<p class="font-semibold"><InlineText text={row[0]} /></p>
				<dl class="mt-1 flex flex-col gap-1 text-sm">
					{#each block.columns.slice(1) as column, c (c)}
						<!-- An empty cell ("also called" with nothing to add) is left out of the card. -->
						{#if row[c + 1]}
							<div>
								<dt class="inline font-medium text-gray-600 dark:text-gray-400">{column}:</dt>
								<dd class="inline"><InlineText text={row[c + 1]} /></dd>
							</div>
						{/if}
					{/each}
				</dl>
			</div>
		{/each}
	</div>
	<!-- Wider screens: a real table. -->
	<table class="hidden w-full text-left text-sm md:table">
		{#if block.caption}<caption class="mb-2 text-left font-medium">{block.caption}</caption>{/if}
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				{#each block.columns as column, c (c)}
					<th scope="col" class="px-2 py-2 font-semibold">{column}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each block.rows as row, r (r)}
				<tr class="border-b border-gray-200 align-top dark:border-gray-800">
					{#each row as cell, c (c)}
						{#if c === 0}
							<th scope="row" class="px-2 py-2 font-medium"><InlineText text={cell} /></th>
						{:else}
							<td class="px-2 py-2"><InlineText text={cell} /></td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{:else if block.type === 'timers'}
	<TimerButtons timers={block.timers} />
{:else if block.type === 'widget' && block.widget === 'doneness'}
	<DonenessChart />
{/if}
