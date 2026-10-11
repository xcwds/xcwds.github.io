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
	/**
	 * Width of the page's content. When the calculator and the workout both fit (50rem, the
	 * `@[50rem]:` container query below), they show side by side under one tab (#95).
	 */
	let width = $state(0);
	// In the root font size, like the container query, so they agree with a larger default font.
	let split = $derived(
		width > 0 && width >= 50 * parseFloat(getComputedStyle(document.documentElement).fontSize)
	);
	/** The tab that looks selected: in the side-by-side layout Plates also stands for Workout. */
	let shown = $derived(split && tab === 'workout' ? 'plates' : tab);
	/** Panel visibility, in CSS so the layout is right before the page hydrates. */
	function panel(id: Tab) {
		if (tab === id) return '';
		const pair = (id === 'plates' && tab === 'workout') || (id === 'workout' && tab === 'plates');
		return pair ? 'hidden @[50rem]:block' : 'hidden';
	}

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
		const before = $state.snapshot(history);
		const saved = changeHistory((latest) => {
			// Unique even if two workouts finish within the same millisecond.
			const id = Math.max(Date.now(), (latest[0]?.id ?? 0) + 1);
			return [{ id, finishedAt: new Date().toISOString(), workout }, ...latest];
		});
		// Not saved: the workout stays in the tracker to finish again, so it isn't listed here
		// too (finishing it again would list it twice) (#133).
		if (!saved) history = before;
		return saved;
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

<main
	class="page-split @container flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200"
>
	<div class="flex flex-col gap-6" bind:clientWidth={width}>
		<div class="grid grid-cols-3 gap-2 @[50rem]:grid-cols-2" role="tablist">
			{#each tabs as t (t.id)}
				<button
					type="button"
					role="tab"
					aria-selected={shown === t.id}
					class="{toggle(shown === t.id)} py-3 text-base {t.id === 'workout'
						? '@[50rem]:hidden'
						: ''}"
					onclick={() => (tab = t.id)}
					>{t.label}{#if t.id === 'plates'}<span class="hidden @[50rem]:inline"
							>&nbsp;&amp; Workout</span
						>{/if}</button
				>
			{/each}
		</div>

		<!-- All stay mounted so the calculator total reaches the workout tab and Repeat can fill it. -->
		<div
			class={tab === 'history'
				? 'hidden'
				: '@[50rem]:grid @[50rem]:grid-cols-2 @[50rem]:items-start @[50rem]:gap-10'}
		>
			<div class={panel('plates')}><PlateCalculator bind:total /></div>
			<div class={panel('workout')}>
				<WorkoutTracker bind:this={tracker} calculatorWeight={total} onFinish={finished} />
			</div>
		</div>
		<div class={panel('history')}>
			<History {history} onRepeat={repeat} onDelete={deleted} />
		</div>
	</div>
</main>
