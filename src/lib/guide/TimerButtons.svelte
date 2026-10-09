<script lang="ts">
	import { toast } from '$lib/toast.svelte';
	import { MINUTE, useCookingTimers } from '$lib/utils/cooking-timers.svelte';
	import { formatMinutes } from '$lib/utils/oven';

	let { timers }: { timers: { label: string; minutes: number }[] } = $props();

	// Timers join the app-wide Cooking Timer list, so they ring on any page.
	const cookingTimers = useCookingTimers();

	function start(timer: { label: string; minutes: number }) {
		cookingTimers.add(timer.minutes * MINUTE, timer.label);
		toast(`Started a ${formatMinutes(timer.minutes)} timer: ${timer.label}.`);
	}
</script>

<div class="flex flex-wrap gap-2">
	{#each timers as timer (timer.label)}
		<button
			type="button"
			class="flex min-h-11 items-center gap-2 rounded-full bg-white/70 px-4 text-sm font-medium hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
			onclick={() => start(timer)}
		>
			<span aria-hidden="true">⏲️</span>
			{formatMinutes(timer.minutes)}: {timer.label}
		</button>
	{/each}
</div>
