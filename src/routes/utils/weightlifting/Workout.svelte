<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		activeSet,
		EXERCISE_SUGGESTIONS,
		formatWeight,
		workoutHasContent,
		workoutToText,
		type Exercise,
		type WorkoutSet,
		type Workout
	} from '#lib/utils/lifting.js';
	import { persist } from '#lib/persist.svelte.js';
	import { settings, settingsStatus } from '#lib/settings.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import { entries } from '#lib/storage.js';
	import ExerciseName from './ExerciseName.svelte';
	import { button, card, field, primary } from './styles';

	let {
		calculatorWeight = 0,
		onFinish
	}: {
		calculatorWeight?: number;
		/** Saves a finished workout to the history; returns whether it was saved. */
		onFinish: (workout: Workout) => boolean;
	} = $props();

	/** The calculator's unit. A workout keeps the unit it was logged in (see below). */
	/** The active equipment set's unit (#82): a set of your own has its own. */
	let calculatorUnit = $derived(activeSet(settings.lifting).unit);

	const today = () =>
		new Date().toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});

	let workout = $state<Workout>({ date: today(), unit: 'lb', exercises: [] });

	const hasWeights = (w: Workout) => w.exercises.some((e) => e.sets.some((s) => s.weight));

	// Until a weight is logged, the workout follows the calculator's unit. After that its unit is
	// fixed, so switching lb/kg never relabels weights you've already logged.
	$effect(() => {
		if (!settingsStatus.ready) return;
		if (!hasWeights(workout) && workout.unit !== calculatorUnit) workout.unit = calculatorUnit;
	});
	let unitsDiffer = $derived(workout.unit !== calculatorUnit);
	let canShare = $state(false);
	let nextId = 1;
	const id = () => nextId++;

	/**
	 * What ✕ last removed, shown as an Undo row in its place until the next removal or a new
	 * workout. No timer, so it can't vanish before you reach it.
	 */
	type Removed =
		| { kind: 'exercise'; index: number; exercise: Exercise }
		| { kind: 'set'; exerciseId: number; index: number; set: WorkoutSet };
	let removed = $state<Removed | undefined>();
	let undoButton = $state<HTMLButtonElement | undefined>();

	const forget = () => (removed = undefined);

	/** The ✕ you tapped is gone, so focus moves to Undo. */
	async function remember(next: Removed) {
		removed = next;
		await tick();
		undoButton?.focus();
	}

	function removeExercise(index: number) {
		const [exercise] = workout.exercises.splice(index, 1);
		if (exercise) remember({ kind: 'exercise', index, exercise: $state.snapshot(exercise) });
	}

	function removeSet(exercise: Exercise, index: number) {
		const [set] = exercise.sets.splice(index, 1);
		if (set) remember({ kind: 'set', exerciseId: exercise.id, index, set: $state.snapshot(set) });
	}

	/** Puts back what was removed; focus goes to its ✕, since Undo is gone. */
	async function undo() {
		const r = removed;
		forget();
		let back: string | undefined;
		if (r?.kind === 'exercise') {
			workout.exercises.splice(Math.min(r.index, workout.exercises.length), 0, r.exercise);
			back = `exercise-${r.exercise.id}`;
		} else if (r?.kind === 'set') {
			const exercise = workout.exercises.find((e) => e.id === r.exerciseId);
			if (!exercise) return;
			exercise.sets.splice(Math.min(r.index, exercise.sets.length), 0, r.set);
			back = `set-${r.set.id}`;
		}
		await tick();
		if (back) document.querySelector<HTMLElement>(`[data-remove="${back}"]`)?.focus();
	}

	const useWorkout = (next: Workout) => {
		forget();
		workout = next;
		nextId = 1 + Math.max(0, ...next.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)]));
	};

	// An empty workout saved on an earlier day (e.g. right after "Finish workout") is dated today;
	// "Finish workout" is disabled until something is logged, so it can't refresh the date.
	persist(
		entries.liftingWorkout,
		() => workout,
		(saved) => useWorkout(workoutHasContent(saved) ? saved : { ...saved, date: today() })
	);

	/** JSON of the workout as Repeat filled it; an untouched copy isn't saved again by Repeat. */
	let repeated: string | undefined;

	let hasContent = $derived(workoutHasContent(workout));

	onMount(() => {
		canShare = typeof navigator.share === 'function';
	});

	function addExercise() {
		workout.exercises.push({ id: id(), name: '', sets: [{ id: id(), weight: null, reps: null }] });
	}

	function addSet(exercise: Exercise, weight?: number) {
		const last = exercise.sets.at(-1);
		exercise.sets.push({
			id: id(),
			weight: weight ?? last?.weight ?? null,
			reps: last?.reps ?? null
		});
	}

	/**
	 * Saves the current workout to the history (if it has anything in it) and starts a new one.
	 * When the save fails (onFinish reports it), the workout stays, so it isn't lost (#133).
	 */
	function finishWorkout() {
		if (workoutHasContent(workout)) {
			if (!onFinish($state.snapshot(workout))) return;
			toast('Workout saved to history.');
		}
		forget();
		workout = { date: today(), unit: calculatorUnit, exercises: [] };
	}

	/**
	 * Starts a new workout with the same exercises and sets as `source` (dated today). When the
	 * current workout can't be saved first, it stays instead (#133).
	 */
	export function repeat(source: Workout) {
		if (workoutHasContent(workout) && JSON.stringify(workout) !== repeated) {
			if (!onFinish($state.snapshot(workout))) return;
			toast('Your current workout was saved to history.');
		}
		// A plain copy: `source` comes from reactive state, which structuredClone can't copy.
		useWorkout({ ...$state.snapshot(source), date: today() });
		repeated = JSON.stringify(workout);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(workoutToText(workout));
			toast('Workout copied.');
		} catch {
			toast("Couldn't copy the workout.");
		}
	}

	async function share() {
		try {
			await navigator.share({ text: workoutToText(workout) });
		} catch {
			// Share sheet dismissed.
		}
	}
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-center justify-between gap-2">
		<label class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
			<span>Date</span>
			<input bind:value={workout.date} class={field} />
		</label>
		<button type="button" class="{button} self-end" disabled={!hasContent} onclick={finishWorkout}
			>Finish workout</button
		>
	</div>

	{#if unitsDiffer}
		<p class="text-sm text-amber-800 dark:text-amber-300" data-testid="unit-note">
			This workout is logged in {workout.unit}; the calculator is set to {calculatorUnit}. Start a
			new workout to log in {calculatorUnit}.
		</p>
	{/if}

	{#snippet undoRow(label: string)}
		<div
			class="flex items-center justify-between gap-2 rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
			role="status"
			data-testid="undo-row"
		>
			<span class="min-w-0 break-words">{label} removed.</span>
			<button type="button" class="{button} shrink-0" bind:this={undoButton} onclick={undo}
				>Undo</button
			>
		</div>
	{/snippet}

	{#each workout.exercises as exercise, e (exercise.id)}
		{#if removed?.kind === 'exercise' && removed.index === e}
			{@render undoRow(removed.exercise.name || 'Exercise')}
		{/if}
		<div class="{card} flex flex-col gap-3" data-testid="exercise">
			<div class="flex items-start gap-2">
				<ExerciseName
					label="Exercise {e + 1} name"
					suggestions={EXERCISE_SUGGESTIONS}
					bind:value={exercise.name}
					class="{field} text-lg font-medium"
				/>
				<button
					type="button"
					aria-label="Remove {exercise.name || `exercise ${e + 1}`}"
					class="{button} shrink-0"
					data-remove="exercise-{exercise.id}"
					onclick={() => removeExercise(e)}>✕</button
				>
			</div>
			<table class="w-full text-sm">
				<thead class="text-gray-600 dark:text-gray-400">
					<tr>
						<th class="w-8 text-left font-normal">Set</th>
						<th class="text-left font-normal">Weight ({workout.unit})</th>
						<th class="text-left font-normal">Reps</th>
						<th class="w-10"><span class="sr-only">Remove</span></th>
					</tr>
				</thead>
				<tbody>
					{#each exercise.sets as set, i (set.id)}
						<tr>
							<td class="py-1">{i + 1}</td>
							<td class="py-1 pr-2">
								<input
									type="number"
									inputmode="decimal"
									min="0"
									step="any"
									aria-label="{exercise.name || 'Exercise'} set {i + 1} weight"
									bind:value={set.weight}
									class="{field} text-base"
								/>
							</td>
							<td class="py-1 pr-2">
								<input
									type="number"
									inputmode="numeric"
									min="0"
									step="1"
									aria-label="{exercise.name || 'Exercise'} set {i + 1} reps"
									bind:value={set.reps}
									class="{field} text-base"
								/>
							</td>
							<td class="py-1">
								<button
									type="button"
									aria-label="Remove set {i + 1}"
									class="{button} px-2 py-1"
									data-remove="set-{set.id}"
									onclick={() => removeSet(exercise, i)}>✕</button
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if removed?.kind === 'set' && removed.exerciseId === exercise.id}
				{@render undoRow(`Set ${removed.index + 1}`)}
			{/if}
			<div class="grid grid-cols-2 gap-2 text-sm">
				<button type="button" class={button} onclick={() => addSet(exercise)}>+ Set</button>
				<button
					type="button"
					class={button}
					disabled={!calculatorWeight || unitsDiffer}
					onclick={() => addSet(exercise, calculatorWeight)}
				>
					+ Set @ {formatWeight(calculatorWeight, calculatorUnit)}
				</button>
			</div>
		</div>
	{/each}
	{#if removed?.kind === 'exercise' && removed.index >= workout.exercises.length}
		{@render undoRow(removed.exercise.name || 'Exercise')}
	{/if}

	<button type="button" class={button} onclick={addExercise}>+ Add exercise</button>

	<div class="grid gap-2 {canShare ? 'grid-cols-2' : 'grid-cols-1'}">
		<button
			type="button"
			class="{primary} py-3 text-lg"
			disabled={!workout.exercises.length}
			onclick={copy}
		>
			Copy workout
		</button>
		{#if canShare}
			<button
				type="button"
				class="{primary} py-3 text-lg"
				disabled={!workout.exercises.length}
				onclick={share}>Share</button
			>
		{/if}
	</div>

	<p class="text-sm text-gray-600 dark:text-gray-400">
		The workout is saved on this device until you start a new one. "+ Set @" uses the weight from
		the Plates tab.
	</p>
</section>
