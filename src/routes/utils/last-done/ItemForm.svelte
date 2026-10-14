<script module lang="ts">
	import type { LastDoneItem } from '$lib/utils/last-done';

	export type Fields = Omit<LastDoneItem, 'id'>;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		EVERY_MAX,
		NAME_MAX,
		NOTES_MAX,
		UNITS,
		cleanEmoji,
		nameProblem,
		type IntervalUnit
	} from '$lib/utils/last-done';
	import { button, field, primary } from './styles';

	let {
		initial,
		submitLabel,
		onSubmit,
		onCancel,
		children
	}: {
		initial: Fields;
		submitLabel: string;
		/** Saves the thing; returns whether it was saved (the form stays open if not). */
		onSubmit: (fields: Fields) => boolean;
		onCancel: () => void;
		/** Extra actions under the form (Delete, when editing). */
		children?: import('svelte').Snippet;
	} = $props();

	// The form edits its own copy; `initial` only seeds it.
	// svelte-ignore state_referenced_locally
	let name = $state(initial.name);
	// svelte-ignore state_referenced_locally
	let emoji = $state(initial.emoji ?? '');
	// svelte-ignore state_referenced_locally
	let everyN = $state(initial.every ? String(initial.every.n) : '');
	// svelte-ignore state_referenced_locally
	let everyUnit = $state<IntervalUnit>(initial.every?.unit ?? 'weeks');
	// svelte-ignore state_referenced_locally
	let notes = $state(initial.notes ?? '');
	let tried = $state(false);
	let nameError = $derived(tried ? nameProblem(name) : undefined);
	let everyError = $derived.by(() => {
		if (!tried || everyN.trim() === '') return undefined;
		const n = Number(everyN);
		return Number.isInteger(n) && n >= 1 && n <= EVERY_MAX
			? undefined
			: `Enter a whole number from 1 to ${EVERY_MAX}, or leave it empty.`;
	});
	const id = $props.id();
	let nameField: HTMLInputElement | undefined = $state();

	// The button that opened the form is gone, so focus moves here instead of to the page.
	onMount(() => nameField?.focus());

	function submit(e: SubmitEvent) {
		e.preventDefault();
		tried = true;
		if (nameProblem(name) || everyError) return;
		const fields: Fields = { name: name.trim() };
		const cleaned = cleanEmoji(emoji);
		if (cleaned) fields.emoji = cleaned;
		if (everyN.trim()) fields.every = { n: Number(everyN), unit: everyUnit };
		if (notes.trim()) fields.notes = notes.trim().slice(0, NOTES_MAX);
		onSubmit(fields);
	}
</script>

<form class="flex flex-col gap-3" onsubmit={submit} novalidate>
	<div class="grid grid-cols-[5rem_1fr] gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span>Emoji</span>
			<input bind:value={emoji} placeholder="✅" class="{field} text-center text-lg" />
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>Name</span>
			<input
				bind:this={nameField}
				bind:value={name}
				maxlength={NAME_MAX}
				placeholder="Clean the bathroom"
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby={nameError ? `${id}-name-error` : undefined}
				class="{field} text-base"
			/>
		</label>
	</div>
	{#if nameError}
		<p id="{id}-name-error" class="text-sm text-red-700 dark:text-red-400" role="alert">
			{nameError}
		</p>
	{/if}
	<fieldset class="flex flex-col gap-1 text-sm">
		<legend>Target (optional)</legend>
		<div class="flex items-center gap-2">
			<span>Every</span>
			<input
				bind:value={everyN}
				inputmode="numeric"
				aria-label="Target number"
				aria-invalid={everyError ? 'true' : undefined}
				aria-describedby={everyError ? `${id}-every-error` : undefined}
				class="{field} w-20 text-base"
			/>
			<select bind:value={everyUnit} aria-label="Target unit" class="{field} w-auto text-base">
				{#each UNITS as unit (unit.id)}
					<option value={unit.id}>{unit.label}</option>
				{/each}
			</select>
		</div>
	</fieldset>
	{#if everyError}
		<p id="{id}-every-error" class="text-sm text-red-700 dark:text-red-400" role="alert">
			{everyError}
		</p>
	{/if}
	<label class="flex flex-col gap-1 text-sm">
		<span>Notes (optional)</span>
		<textarea bind:value={notes} maxlength={NOTES_MAX} rows="2" class="{field} text-base"
		></textarea>
	</label>
	<div class="flex flex-wrap gap-2">
		<button type="submit" class={primary}>{submitLabel}</button>
		<button type="button" class={button} onclick={onCancel}>Cancel</button>
		{@render children?.()}
	</div>
</form>
