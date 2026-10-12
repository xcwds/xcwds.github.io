<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DEFAULT_EMOJI,
		HABIT_KINDS,
		NAME_MAX,
		nameProblem,
		type Habit,
		type HabitKind
	} from '$lib/self-control/habits';
	import { button, field, primary } from './styles';

	type Fields = Pick<Habit, 'name' | 'emoji' | 'kind'>;

	let {
		initial,
		submitLabel,
		onSubmit,
		onCancel,
		children
	}: {
		initial: Fields;
		submitLabel: string;
		/** Saves the habit; returns whether it was saved (the form stays open if not). */
		onSubmit: (fields: Fields) => boolean;
		onCancel: () => void;
		/** Extra actions under the form (Delete, when editing). */
		children?: import('svelte').Snippet;
	} = $props();

	// The form edits its own copy; `initial` only seeds it.
	// svelte-ignore state_referenced_locally
	let name = $state(initial.name);
	// svelte-ignore state_referenced_locally
	let emoji = $state(initial.emoji);
	// svelte-ignore state_referenced_locally
	let kind = $state<HabitKind>(initial.kind);
	let tried = $state(false);
	let problem = $derived(tried ? nameProblem(name) : undefined);
	const id = $props.id();
	let nameField: HTMLInputElement | undefined = $state();

	// The button that opened the form is gone, so focus moves here instead of to the page.
	onMount(() => nameField?.focus());

	function submit(e: SubmitEvent) {
		e.preventDefault();
		tried = true;
		if (nameProblem(name)) return;
		onSubmit({ name, emoji, kind });
	}
</script>

<form class="flex flex-col gap-3" onsubmit={submit} novalidate>
	<div class="grid grid-cols-[5rem_1fr] gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span>Emoji</span>
			<input
				bind:value={emoji}
				placeholder={DEFAULT_EMOJI}
				autocomplete="off"
				class="{field} min-h-11 text-center text-xl"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>Habit</span>
			<input
				bind:this={nameField}
				bind:value={name}
				maxlength={NAME_MAX}
				autocomplete="off"
				aria-invalid={problem ? 'true' : undefined}
				aria-describedby={problem ? `${id}-problem` : undefined}
				class="{field} min-h-11 text-base"
			/>
		</label>
	</div>
	{#if problem}
		<p id="{id}-problem" class="-mt-1 text-sm text-red-700 dark:text-red-400" role="alert">
			{problem}
		</p>
	{/if}
	<fieldset class="flex flex-col gap-1 text-sm">
		<legend class="mb-1">I want to</legend>
		<div class="grid grid-cols-3 gap-2">
			{#each HABIT_KINDS as k (k.id)}
				<label
					class="flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 text-center font-medium has-checked:bg-blue-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-blue-500 {kind ===
					k.id
						? ''
						: 'bg-white/70 hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700'}"
				>
					<input type="radio" class="sr-only" name="{id}-kind" value={k.id} bind:group={kind} />
					{k.label}
				</label>
			{/each}
		</div>
	</fieldset>
	<div class="grid grid-cols-2 gap-2">
		<button type="button" class={button} onclick={onCancel}>Cancel</button>
		<button type="submit" class={primary}>{submitLabel}</button>
	</div>
	{@render children?.()}
</form>
