<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { hasUnsavedChanges, persist, saveResult } from '#lib/persist.svelte.js';
	import { entries, update } from '#lib/storage.js';
	import { toast } from '#lib/toast.svelte.js';
	import { agoLabel } from '#lib/utils/last-done.js';
	import {
		exerciseKey,
		lastTrained,
		MUSCLE_GROUPS,
		type HistoryEntry,
		type MuscleGroup,
		type MyMuscles
	} from '#lib/utils/lifting.js';
	import { button, card, toggle } from './styles';

	let { history }: { history: HistoryEntry[] } = $props();

	/** How many workouts a group's list shows. */
	const SHOWN = 10;

	let mine = $state<MyMuscles>({});
	const savedMine = persist(
		entries.workoutMuscles,
		() => (Object.keys(mine).length ? mine : undefined),
		(saved) => (mine = saved),
		{ cleared: () => (mine = {}) }
	);

	let now = $state(new Date());
	onMount(() => {
		const tickNow = () => (now = new Date());
		const timer = setInterval(tickNow, 60_000);
		const visible = () => document.visibilityState === 'visible' && tickNow();
		document.addEventListener('visibilitychange', visible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', visible);
		};
	});

	let trained = $derived(lastTrained(history, mine));
	let open = $state<MuscleGroup | undefined>();
	let openStatus = $derived(trained.groups.find((g) => g.group === open));
	/**
	 * The groups picked for each ungrouped exercise, by `exerciseKey`, until saved. A map, so a
	 * name like "constructor" can't read an object's built-ins.
	 */
	const picks = new SvelteMap<string, MuscleGroup[]>();

	const ago = (last: Date | undefined) => (last ? agoLabel(last, now) : 'never');

	function pick(name: string, group: MuscleGroup) {
		const key = exerciseKey(name);
		const current = picks.get(key) ?? [];
		picks.set(
			key,
			current.includes(group)
				? current.filter((g) => g !== group)
				: MUSCLE_GROUPS.map((g) => g.id).filter((g) => g === group || current.includes(g))
		);
	}

	function save(name: string) {
		const key = exerciseKey(name);
		const groups = picks.get(key);
		if (!groups?.length) return;
		const result = update(
			entries.workoutMuscles,
			$state.snapshot(mine),
			(latest) => ({ ...latest, [key]: [...groups] }),
			{ unsaved: hasUnsavedChanges(entries.workoutMuscles) }
		);
		mine = result.value ?? {};
		savedMine.markSaved();
		if (!saveResult(entries.workoutMuscles, result.saved, { explicit: true })) return;
		picks.delete(key);
		const labels = MUSCLE_GROUPS.filter((g) => groups.includes(g.id)).map((g) => g.label);
		toast(`${name} counts for ${labels.join(', ')}.`);
	}
</script>

<section class="flex flex-col gap-3" aria-labelledby="muscle-groups-heading">
	<h2 id="muscle-groups-heading" class="text-sm font-semibold">Last trained</h2>
	<div class="grid grid-cols-3 gap-2" data-testid="muscle-groups">
		{#each trained.groups as g (g.group)}
			<button
				type="button"
				class="{toggle(open === g.group)} flex flex-col items-center leading-tight"
				aria-expanded={open === g.group}
				aria-controls="muscle-group-workouts"
				data-testid="muscle-group"
				onclick={() => (open = open === g.group ? undefined : g.group)}
			>
				<span class="font-semibold">{g.label}</span><span class="sr-only"> · </span><span
					class="text-xs {open === g.group ? '' : 'text-gray-600 dark:text-gray-400'}"
					>{ago(g.last)}</span
				>
			</button>
		{/each}
	</div>

	<div id="muscle-group-workouts" aria-live="polite">
		{#if openStatus}
			<div class="{card} flex flex-col gap-2 text-sm" data-testid="muscle-group-workouts">
				{#if openStatus.workouts.length === 0}
					<p>No finished workouts have trained {openStatus.label.toLowerCase()} yet.</p>
				{:else}
					<p class="font-semibold">{openStatus.label}: what counted</p>
					<ul class="flex flex-col gap-1">
						{#each openStatus.workouts.slice(0, SHOWN) as w (w.entry.id)}
							<li>
								<span class="font-medium">{w.entry.workout.date}</span>
								<span class="text-gray-600 dark:text-gray-400">· {w.exercises.join(', ')}</span>
							</li>
						{/each}
					</ul>
					{#if openStatus.workouts.length > SHOWN}
						<p class="text-gray-600 dark:text-gray-400">
							and {openStatus.workouts.length - SHOWN} older
						</p>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#if trained.ungrouped.length}
		<div class="{card} flex flex-col gap-3" data-testid="ungrouped">
			<div>
				<h3 class="text-sm font-semibold">Not grouped yet</h3>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Pick what each of your own exercises trains, so it counts above.
				</p>
			</div>
			<ul class="flex flex-col gap-4">
				{#each trained.ungrouped as name (exerciseKey(name))}
					{@const chosen = picks.get(exerciseKey(name)) ?? []}
					<li class="flex flex-col gap-2">
						<span class="font-medium">{name}</span>
						<div class="flex flex-wrap gap-2" role="group" aria-label="Groups for {name}">
							{#each MUSCLE_GROUPS as g (g.id)}
								<button
									type="button"
									class={toggle(chosen.includes(g.id))}
									aria-pressed={chosen.includes(g.id)}
									onclick={() => pick(name, g.id)}>{g.label}</button
								>
							{/each}
						</div>
						<button
							type="button"
							class="{button} self-start text-sm"
							disabled={chosen.length === 0}
							aria-label="Save groups for {name}"
							onclick={() => save(name)}>Save</button
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
