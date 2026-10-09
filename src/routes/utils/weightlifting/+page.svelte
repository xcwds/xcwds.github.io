<script lang="ts">
	import { hasUnsavedChanges, persist, saveResult } from '$lib/persist.svelte';
	import { entries, update } from '$lib/storage';
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

	// The open tab is per window, so it doesn't follow other windows.
	persist(
		entries.liftingTab,
		() => tab,
		(saved) => (tab = saved),
		{ sync: false }
	);
	// An empty history removes the saved entry. Another tab's changes load as they happen.
	const savedHistory = persist(
		entries.workoutHistory,
		() => (history.length ? history : undefined),
		(saved) => (history = saved),
		{ cleared: () => (history = []) }
	);

	/**
	 * Changes the history starting from the latest saved list, not this tab's copy (which another
	 * tab may have changed since), saves it, and returns whether it was saved.
	 */
	function changeHistory(change: (latest: HistoryEntry[]) => HistoryEntry[]): boolean {
		const result = update(
			entries.workoutHistory,
			$state.snapshot(history),
			(latest) => {
				const next = change(latest ?? []);
				return next.length ? next : undefined;
			},
			// After a failed save this tab's list is ahead of storage; don't drop what it holds.
			{ unsaved: hasUnsavedChanges(entries.workoutHistory) }
		);
		history = result.value ?? [];
		savedHistory.markSaved();
		return saveResult(entries.workoutHistory, result.saved, { explicit: true });
	}

	function finished(workout: Workout): boolean {
		return changeHistory((latest) => {
			// Unique even if two workouts finish within the same millisecond.
			const id = Math.max(Date.now(), (latest[0]?.id ?? 0) + 1);
			return [{ id, finishedAt: new Date().toISOString(), workout }, ...latest];
		});
	}

	function deleted(entry: HistoryEntry): boolean {
		return changeHistory((latest) => latest.filter((h) => h.id !== entry.id));
	}

	function repeat(entry: HistoryEntry) {
		tracker?.repeat(entry.workout);
		tab = 'workout';
	}
</script>

<svelte:head>
	<title>Weightlifting Calculator</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
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
	<div hidden={tab !== 'history'}><History {history} onRepeat={repeat} onDelete={deleted} /></div>
</main>
