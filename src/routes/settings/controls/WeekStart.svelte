<script lang="ts">
	/** Settings → Appearance: which day weeks start on, or the locale's (`settings.weekStart`). */
	import { onMount } from 'svelte';
	import { settings } from '$lib/settings.svelte';
	import { WEEK_DAYS, dayName, isWeekDay, localeWeekStart, type WeekDay } from '$lib/week';

	/** The locale's first day of the week, known once the page runs in the browser. */
	let regionWeekStart = $state<WeekDay | undefined>();
	onMount(() => {
		regionWeekStart = localeWeekStart();
	});
</script>

<label class="flex flex-col gap-1 text-sm">
	<span class="font-semibold">Week starts on</span>
	<select
		class="rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
		value={settings.weekStart === null ? '' : String(settings.weekStart)}
		onchange={(e) => {
			const value = Number(e.currentTarget.value);
			settings.weekStart = e.currentTarget.value && isWeekDay(value) ? value : null;
		}}
	>
		<option value="">Where you are{regionWeekStart ? ` (${dayName(regionWeekStart)})` : ''}</option>
		{#each WEEK_DAYS as day (day.value)}
			<option value={String(day.value)}>{day.label}</option>
		{/each}
	</select>
</label>
