<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatWeight,
		workoutHasContent,
		workoutToText,
		type Exercise,
		type Workout
	} from '$lib/utils/lifting';
	import { persist } from '$lib/persist.svelte';
	import { settings, settingsStatus } from '$lib/settings.svelte';
	import { toast } from '$lib/toast.svelte';
	import { entries } from '$lib/storage';
	import { button, card, field, primary } from './styles';

	let {
		calculatorWeight = 0,
		onFinish
	}: {
		calculatorWeight?: number;
		/** Receives a finished workout to keep in the history. */
		onFinish?: (workout: Workout) => void;
	} = $props();

	/** The calculator's unit. A workout keeps the unit it was logged in (see below). */
	let calculatorUnit = $derived(settings.lifting.unit);

	const SUGGESTIONS = [
		'Bench Press',
		'Squat',
		'Deadlift',
		'Overhead Press',
		'Barbell Row',
		'Romanian Deadlift',
		'Front Squat',
		'Incline Dumbbell Press',
		'Dumbbell Row',
		'Goblet Squat',
		'Kettlebell Swing',
		'Lunges',
		'Pull-ups',
		'Push-ups'
	];

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

	const useWorkout = (next: Workout) => {
		workout = next;
		nextId = 1 + Math.max(0, ...next.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)]));
	};

	persist(entries.liftingWorkout, () => workout, useWorkout);

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

	/** Saves the current workout to the history (if it has anything in it) and starts a new one. */
	function finishWorkout() {
		if (workoutHasContent(workout)) {
			onFinish?.($state.snapshot(workout));
			toast('Workout saved to history.');
		}
		workout = { date: today(), unit: calculatorUnit, exercises: [] };
	}

	/** Starts a new workout with the same exercises and sets as `source` (dated today). */
	export function repeat(source: Workout) {
		if (workoutHasContent(workout)) {
			onFinish?.($state.snapshot(workout));
			toast('Your current workout was saved to history.');
		}
		// A plain copy: `source` comes from reactive state, which structuredClone can't copy.
		useWorkout({ ...$state.snapshot(source), date: today() });
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

	{#each workout.exercises as exercise, e (exercise.id)}
		<div class="{card} flex flex-col gap-3" data-testid="exercise">
			<div class="flex items-center gap-2">
				<input
					aria-label="Exercise {e + 1} name"
					placeholder="Exercise"
					list="exercise-suggestions"
					bind:value={exercise.name}
					class="{field} text-lg font-medium"
				/>
				<button
					type="button"
					aria-label="Remove {exercise.name || `exercise ${e + 1}`}"
					class="{button} shrink-0"
					onclick={() => workout.exercises.splice(e, 1)}>✕</button
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
									onclick={() => exercise.sets.splice(i, 1)}>✕</button
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
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

	<datalist id="exercise-suggestions">
		{#each SUGGESTIONS as name (name)}
			<option value={name}></option>
		{/each}
	</datalist>

	<p class="text-sm text-gray-600 dark:text-gray-400">
		The workout is saved on this device until you start a new one. "+ Set @" uses the weight from
		the Plates tab.
	</p>
</section>
