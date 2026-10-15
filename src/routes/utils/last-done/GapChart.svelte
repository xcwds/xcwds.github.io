<script lang="ts">
	/** The gaps between times something was done, as bars (oldest first). Inline SVG, no library. */
	let { gaps }: { gaps: number[] } = $props();

	const HEIGHT = 96;
	const BAR = 14;
	const GAP = 6;
	let max = $derived(Math.max(1, ...gaps));
	let width = $derived(gaps.length * (BAR + GAP) - GAP);
	const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
</script>

<figure class="flex flex-col gap-1">
	<div class="overflow-x-auto">
		<svg
			viewBox="0 0 {width} {HEIGHT}"
			{width}
			height={HEIGHT}
			role="img"
			aria-label="Days between times: {gaps.map(days).join(', ')}"
			data-testid="gap-chart"
		>
			{#each gaps as gap, i (i)}
				{@const h = Math.max(2, (gap / max) * HEIGHT)}
				<rect
					x={i * (BAR + GAP)}
					y={HEIGHT - h}
					width={BAR}
					height={h}
					rx="3"
					class="fill-blue-500 dark:fill-blue-400"
				>
					<title>{days(gap)}</title>
				</rect>
			{/each}
		</svg>
	</div>
	<figcaption class="text-xs text-gray-600 dark:text-gray-400">
		Days between times, oldest first (longest {days(max)}).
	</figcaption>
</figure>
