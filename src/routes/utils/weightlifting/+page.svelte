<script lang="ts">
	import { persist } from '$lib/persist.svelte';
	import { entries } from '$lib/storage';
	import type { HistoryEntry, Workout } from '$lib/utils/lifting';
	import History from './History.svelte';
	import PlateCalculator from './PlateCalculator.svelte';
	import WorkoutTracker from './Workout.svelte';
	import { toggle } from './styles';

	type Tab = 'plates' | 'workout' | 'history';
	const tabs: { id: Tab; label: string }[] = [
		{ id: 'plates', label: 'Plates' },
		{ id: 'workout', label: 'Workout' },
		{ id: 'history', label: 'History' }
	];

	let tab = $state<Tab>('plates');
	let total = $state(0);
	let history = $state<HistoryEntry[]>([]);
	let tracker: ReturnType<typeof WorkoutTracker> | undefined = $state();

	persist(
		entries.liftingTab,
		() => tab,
		(saved) => (tab = saved)
	);
	// An empty history removes the saved entry.
	persist(
		entries.workoutHistory,
		() => (history.length ? history : undefined),
		(saved) => (history = saved)
	);

	function finished(workout: Workout) {
		// Unique even if two workouts finish within the same millisecond.
		const id = Math.max(Date.now(), (history[0]?.id ?? 0) + 1);
		history = [{ id, finishedAt: new Date().toISOString(), workout }, ...history];
	}

	function repeat(entry: HistoryEntry) {
		tracker?.repeat(entry.workout);
		tab = 'workout';
	}
</script>

<svelte:head>
	<title>Weightlifting Calculator</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
	<div class="grid grid-cols-3 gap-2" role="tablist">
		{#each tabs as t (t.id)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === t.id}
				class="{toggle(tab === t.id)} py-3 text-base"
				onclick={() => (tab = t.id)}>{t.label}</button
			>
		{/each}
	</div>

	<!-- All stay mounted so the calculator total reaches the workout tab and Repeat can fill it. -->
	<div hidden={tab !== 'plates'}><PlateCalculator bind:total /></div>
	<div hidden={tab !== 'workout'}>
		<WorkoutTracker bind:this={tracker} calculatorWeight={total} onFinish={finished} />
	</div>
	<div hidden={tab !== 'history'}><History bind:history onRepeat={repeat} /></div>
</main>
