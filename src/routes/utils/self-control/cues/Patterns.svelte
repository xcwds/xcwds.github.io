<script lang="ts">
	import {
		CUE_FIELDS,
		CUE_LABELS,
		HOUR_BLOCKS,
		PATTERN_MIN,
		WEEKDAYS,
		byHourBlock,
		byWeekday,
		riskiest,
		topCues
	} from '$lib/self-control/cues';
	import { resolve } from '$app/paths';
	import type { UrgeEntry } from '$lib/self-control/sos';
	import { button, card } from '../styles';

	/**
	 * When, where and why urges hit, once there are enough of them. For one habit, each top cue
	 * links to the Environment Designer (#152) to plan for it.
	 */
	let { log, habit }: { log: UrgeEntry[]; habit?: string } = $props();

	const hours = $derived(byHourBlock(log));
	const days = $derived(byWeekday(log));
	const top = $derived(
		CUE_FIELDS.map((field) => ({ field, stats: topCues(log, field) })).filter((t) => t.stats.length)
	);
	const risky = $derived(riskiest(log));
	const percent = (n: number) => `${Math.round((n / log.length) * 100)}%`;
</script>

{#snippet bars(title: string, labels: readonly string[], counts: number[])}
	{@const max = Math.max(1, ...counts)}
	<div class="flex flex-col gap-1">
		<h3 class="font-semibold">{title}</h3>
		<ul class="flex flex-col gap-1 text-sm">
			{#each labels as label, i (label)}
				<li class="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2">
					<span>{label}</span>
					<span class="h-3 rounded-full bg-gray-200 dark:bg-gray-800" aria-hidden="true">
						<span
							class="block h-3 rounded-full bg-blue-600"
							style="width: {(counts[i]! / max) * 100}%"
						></span>
					</span>
					<span class="text-right tabular-nums"
						>{counts[i]}<span class="sr-only">{counts[i] === 1 ? ' urge' : ' urges'}</span></span
					>
				</li>
			{/each}
		</ul>
	</div>
{/snippet}

<section aria-labelledby="patterns-heading" class="flex flex-col gap-3" data-testid="patterns">
	<h2 id="patterns-heading" class="text-lg font-semibold">Patterns</h2>
	{#if log.length < PATTERN_MIN}
		<p class="{card} text-sm" data-testid="patterns-wait">
			Log a few more to see patterns ({log.length} of {PATTERN_MIN}).
		</p>
	{:else}
		<div class="{card} flex flex-col gap-4">
			{@render bars('Time of day', HOUR_BLOCKS, hours)}
			{@render bars('Day of the week', WEEKDAYS, days)}
		</div>
		{#if top.length}
			<div class="{card} flex flex-col gap-3" data-testid="top-cues">
				<h3 class="font-semibold">Top cues</h3>
				{#each top as { field, stats } (field)}
					<div class="flex flex-col gap-1 text-sm">
						<h4 class="text-gray-600 dark:text-gray-400">{CUE_LABELS[field]}</h4>
						<ul class="flex flex-col gap-1">
							{#each stats as stat (stat.cue)}
								<li class="flex items-center gap-2">
									<span class="min-w-0 flex-1"
										><strong>{stat.cue}</strong>: {percent(stat.urges)} of urges, gave in {stat.gaveIn}
										of {stat.urges}</span
									>
									{#if habit}
										<a
											class="{button} shrink-0"
											href="{resolve(
												'/utils/self-control/environment' as '/'
											)}#habit={encodeURIComponent(habit)}&cue={encodeURIComponent(stat.cue)}"
											aria-label="Plan for this: {stat.cue}">Plan for this</a
										>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
			<div class="{card} flex flex-col gap-2 text-sm" data-testid="riskiest">
				<h3 class="text-base font-semibold">Riskiest moments</h3>
				{#if risky.length}
					<ul class="flex flex-col gap-1">
						{#each risky as combo (combo.cues.map((c) => `${c.field}:${c.cue}`).join('+'))}
							<li>
								<strong>{combo.cues.map((c) => c.cue).join(' + ')}</strong>: gave in {combo.gaveIn}
								times
							</li>
						{/each}
					</ul>
				{:else}
					<p>
						No two cues have come together twice when you gave in. Keep logging what was going on.
					</p>
				{/if}
			</div>
		{:else}
			<p class="{card} text-sm">
				Add what was going on to your urges to see which cues come up most.
			</p>
		{/if}
	{/if}
</section>
