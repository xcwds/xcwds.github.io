<script lang="ts">
	import { onMount } from 'svelte';
	import { dayInput, fromInputs, timeInput } from '#lib/utils/last-done.js';
	import { button, field, primary } from './styles';

	let {
		label,
		initial,
		submitLabel = 'Log it',
		withTime = false,
		onSubmit,
		onCancel
	}: {
		/** What it's for, e.g. the thing's name, for screen readers. */
		label: string;
		/** The date and time to start from (today when logging something you forgot). */
		initial: Date;
		submitLabel?: string;
		/** Start with `initial`'s time filled in (when changing a logged time). */
		withTime?: boolean;
		/** Saves it; returns whether it was saved (the form stays open if not). */
		onSubmit: (at: Date) => boolean;
		onCancel: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let day = $state(dayInput(initial));
	// svelte-ignore state_referenced_locally
	let time = $state(withTime ? timeInput(initial) : '');
	let error = $state('');
	const id = $props.id();
	let dayField: HTMLInputElement | undefined = $state();
	onMount(() => dayField?.focus());

	function submit(e: SubmitEvent) {
		e.preventDefault();
		let at = fromInputs(day, time);
		// No time means noon, which is still ahead on a morning: today then means now.
		const now = new Date();
		if (at && !time && day === dayInput(now) && at > now) at = now;
		if (!at) {
			error = 'Pick a date.';
			return;
		}
		if (at.getTime() > Date.now() + 60_000) {
			error = "That's in the future.";
			return;
		}
		error = '';
		onSubmit(at);
	}
</script>

<form class="flex flex-col gap-2" onsubmit={submit} novalidate aria-label={label}>
	<div class="grid grid-cols-2 gap-2">
		<label class="flex flex-col gap-1 text-sm">
			<span>Date</span>
			<input
				bind:this={dayField}
				type="date"
				bind:value={day}
				max={dayInput(new Date())}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${id}-error` : undefined}
				class="{field} min-h-11 text-base"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>Time (optional)</span>
			<input type="time" bind:value={time} class="{field} min-h-11 text-base" />
		</label>
	</div>
	{#if error}
		<p id="{id}-error" class="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>
	{/if}
	<div class="flex gap-2">
		<button type="submit" class={primary}>{submitLabel}</button>
		<button type="button" class={button} onclick={onCancel}>Cancel</button>
	</div>
</form>
