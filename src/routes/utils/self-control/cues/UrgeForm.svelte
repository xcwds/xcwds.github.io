<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		CUE_FIELDS,
		CUE_LABELS,
		CUE_MAX,
		chipsFor,
		cueProblem,
		fromLocalInput,
		matchChip,
		toLocalInput,
		type CueField,
		type Cues,
		type LogFields
	} from '$lib/self-control/cues';
	import type { Habit } from '$lib/self-control/habits';
	import { NOTE_MAX, type Outcome } from '$lib/self-control/sos';
	import { button, field, primary } from '../styles';
	import { toggle } from '../../weightlifting/styles';

	/** Logging an urge, or changing one: habit, strength, time, how it went and what set it off. */
	let {
		habits,
		custom,
		initial,
		cuesOpen = false,
		submitLabel,
		onSubmit,
		onCancel,
		children
	}: {
		habits: Habit[];
		/** Your own chips, offered first. */
		custom: Cues | undefined;
		initial?: LogFields;
		/** Whether "What was going on?" starts open. */
		cuesOpen?: boolean;
		submitLabel: string;
		/** Returns whether it was saved. */
		onSubmit: (fields: LogFields) => boolean;
		onCancel?: () => void;
		/** More buttons beside Save (e.g. Delete). */
		children?: Snippet;
	} = $props();

	const OUTCOME_LABELS: Record<Outcome, string> = {
		'rode-out': 'Rode it out',
		partly: 'Partly',
		'gave-in': 'Gave in'
	};

	// The form edits its own copy; `initial` only seeds it.
	// svelte-ignore state_referenced_locally
	let habit = $state(initial?.habit);
	// svelte-ignore state_referenced_locally
	let intensity = $state(initial?.intensity ?? 5);
	// svelte-ignore state_referenced_locally
	let time = $state(toLocalInput(initial?.at ?? Date.now()));
	// svelte-ignore state_referenced_locally
	let outcome = $state<Outcome | undefined>(initial?.outcome);
	// svelte-ignore state_referenced_locally
	let cues = $state<Cues>($state.snapshot(initial?.cues) ?? {});
	// svelte-ignore state_referenced_locally
	let note = $state(initial?.note ?? '');
	const id = $props.id();
	let own = $state<Record<CueField, string>>({
		where: '',
		doing: '',
		with: '',
		feeling: '',
		trigger: ''
	});
	let ownError = $state<Partial<Record<CueField, string>>>({});
	let errors = $state<{ time?: string; outcome?: string; note?: string }>({});

	/** A field's chips: your own, the built-in ones, and any picked here that are neither. */
	const chips = (f: CueField): string[] => {
		const list = chipsFor(f, custom);
		return [...list, ...(cues[f] ?? []).filter((c) => !list.includes(c))];
	};
	const picked = (f: CueField, chip: string) => cues[f]?.includes(chip) ?? false;

	function flip(f: CueField, chip: string) {
		const list = cues[f] ?? [];
		cues[f] = list.includes(chip) ? list.filter((c) => c !== chip) : [...list, chip];
	}

	function addOwn(f: CueField) {
		const problem = cueProblem(own[f]);
		ownError[f] = problem;
		if (problem) return;
		const chip = matchChip(f, own[f], custom);
		if (!picked(f, chip)) flip(f, chip);
		own[f] = '';
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		// An untouched time keeps its seconds (Urge SOS saves them).
		const at = initial && time === toLocalInput(initial.at) ? initial.at : fromLocalInput(time);
		errors = {
			time:
				at === undefined
					? 'Pick a date and time.'
					: at > Date.now() + 60_000
						? "That's in the future."
						: undefined,
			outcome: outcome ? undefined : 'Pick how it went.',
			note: note.trim().length > NOTE_MAX ? `Keep it to ${NOTE_MAX} characters.` : undefined
		};
		if (at === undefined || !outcome || errors.time || errors.note) return;
		onSubmit({ habit, at, intensity, outcome, cues: $state.snapshot(cues), note });
	}
</script>

<form class="flex flex-col gap-4" onsubmit={submit} novalidate>
	{#if habits.length}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-sm font-semibold">What was the urge about?</legend>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class={toggle(habit === undefined)}
					aria-pressed={habit === undefined}
					onclick={() => (habit = undefined)}>Just a craving</button
				>
				{#each habits as h (h.id)}
					<button
						type="button"
						class={toggle(habit === h.id)}
						aria-pressed={habit === h.id}
						onclick={() => (habit = h.id)}>{h.emoji} {h.name}</button
					>
				{/each}
			</div>
		</fieldset>
	{/if}

	<label class="flex flex-col gap-2 text-sm">
		<span class="font-semibold">How strong was it? <strong>{intensity}</strong> / 10</span>
		<input type="range" min="0" max="10" step="1" bind:value={intensity} class="min-h-11" />
	</label>

	<fieldset class="flex flex-col gap-2">
		<legend class="mb-2 text-sm font-semibold">How did it go?</legend>
		<div class="grid grid-cols-3 gap-2">
			{#each Object.entries(OUTCOME_LABELS) as [value, label] (value)}
				<button
					type="button"
					class={toggle(outcome === value)}
					aria-pressed={outcome === value}
					onclick={() => {
						outcome = value as Outcome;
						errors.outcome = undefined;
					}}>{label}</button
				>
			{/each}
		</div>
		{#if errors.outcome}
			<p role="alert" class="text-sm text-red-700 dark:text-red-400">{errors.outcome}</p>
		{/if}
	</fieldset>

	<label class="flex flex-col gap-1 text-sm">
		<span class="font-semibold">When</span>
		<input
			class="{field} min-h-11"
			type="datetime-local"
			bind:value={time}
			aria-invalid={errors.time ? 'true' : undefined}
			aria-describedby={errors.time ? `${id}-time-error` : undefined}
		/>
	</label>
	{#if errors.time}
		<p id="{id}-time-error" role="alert" class="-mt-3 text-sm text-red-700 dark:text-red-400">
			{errors.time}
		</p>
	{/if}

	<details open={cuesOpen} class="flex flex-col gap-3" data-testid="cue-fields">
		<summary class="flex min-h-11 cursor-pointer items-center text-sm font-semibold"
			>What was going on? (optional)</summary
		>
		<div class="mt-2 flex flex-col gap-4">
			{#each CUE_FIELDS as f (f)}
				<fieldset class="flex flex-col gap-2" data-testid="cue-{f}">
					<legend class="mb-2 text-sm">{CUE_LABELS[f]}</legend>
					<div class="flex flex-wrap gap-2">
						{#each chips(f) as chip (chip)}
							<button
								type="button"
								class={toggle(picked(f, chip))}
								aria-pressed={picked(f, chip)}
								onclick={() => flip(f, chip)}>{chip}</button
							>
						{/each}
					</div>
					<div class="flex gap-2 text-sm">
						<input
							class={field}
							bind:value={own[f]}
							maxlength={CUE_MAX * 2}
							placeholder="Your own"
							aria-label="Your own: {CUE_LABELS[f]}"
							aria-invalid={ownError[f] ? 'true' : undefined}
							aria-describedby={ownError[f] ? `${id}-${f}-error` : undefined}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addOwn(f);
								}
							}}
						/>
						<button
							type="button"
							class="{button} shrink-0"
							aria-label="Add your own: {CUE_LABELS[f]}"
							onclick={() => addOwn(f)}>+ Add</button
						>
					</div>
					{#if ownError[f]}
						<p id="{id}-{f}-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
							{ownError[f]}
						</p>
					{/if}
				</fieldset>
			{/each}
			<label class="flex flex-col gap-1 text-sm">
				<span>Note</span>
				<textarea
					class="{field} min-h-20"
					bind:value={note}
					maxlength={NOTE_MAX * 2}
					aria-invalid={errors.note ? 'true' : undefined}
					aria-describedby={errors.note ? `${id}-note-error` : undefined}
				></textarea>
			</label>
			{#if errors.note}
				<p id="{id}-note-error" role="alert" class="-mt-3 text-sm text-red-700 dark:text-red-400">
					{errors.note}
				</p>
			{/if}
		</div>
	</details>

	<div class="grid auto-cols-fr grid-flow-col gap-2 text-sm">
		<button type="submit" class={primary}>{submitLabel}</button>
		{#if onCancel}
			<button type="button" class={button} onclick={onCancel}>Cancel</button>
		{/if}
		{@render children?.()}
	</div>
</form>
