<script lang="ts">
	import { hasUnsavedChanges, persist, saveResult } from '$lib/persist.svelte';
	import { activeHabits, type Habit } from '$lib/self-control/habits';
	import {
		REASONS_MAX,
		REASON_MAX,
		WHY_NOTE_MAX,
		WHY_PROMPTS,
		moveReason,
		newReason,
		noteProblem,
		reasonProblem,
		reasonsFor,
		withNote,
		withReasons,
		type Reason,
		type Why
	} from '$lib/self-control/why';
	import { settingsStatus } from '$lib/settings.svelte';
	import { entries, read, update } from '$lib/storage';
	import { toast } from '$lib/toast.svelte';
	import { button, card, field, primary } from '../styles';
	import { toggle } from '../../weightlifting/styles';

	let habits = $state<Habit[]>([]);
	let why = $state<Why | undefined>();
	/** The habit whose reasons are shown; undefined is the general list. */
	let habit = $state<string | undefined>();

	let draft = $state('');
	let draftError = $state<string | undefined>();
	/** The reason being edited, and its text. */
	let editing = $state<string | undefined>();
	let editText = $state('');
	let editError = $state<string | undefined>();
	let note = $state('');
	let noteError = $state<string | undefined>();

	const active = $derived(activeHabits(habits));
	const current = $derived(active.find((h) => h.id === habit));
	const reasons = $derived(reasonsFor(why, current?.id));
	const savedNote = $derived(current ? (why?.byHabit[current.id]?.note ?? '') : '');

	// Another tab's changes load as they happen.
	const saved = persist(
		entries.selfControlWhy,
		() => why,
		(value) => (why = value),
		{ cleared: () => (why = undefined) }
	);

	$effect(() => {
		if (settingsStatus.ready) habits = read(entries.selfControlHabits) ?? [];
	});

	// A habit that was deleted or archived elsewhere falls back to the general list.
	$effect(() => {
		if (habit !== undefined && !current && habits.length) habit = undefined;
	});

	// The note's box follows the habit you pick (and its saved note).
	$effect(() => {
		note = savedNote;
		noteError = undefined;
	});

	/** Saves a change to the latest saved reasons; returns whether it was saved. */
	function change(next: (latest: Why | undefined) => Why | undefined): boolean {
		const result = update(entries.selfControlWhy, $state.snapshot(why), next, {
			unsaved: hasUnsavedChanges(entries.selfControlWhy)
		});
		why = result.value;
		saved.markSaved();
		return saveResult(entries.selfControlWhy, result.saved, { explicit: true });
	}

	const changeList = (fn: (list: Reason[]) => Reason[]) =>
		change((latest) => withReasons(latest, current?.id, fn));

	function pick(id: string | undefined) {
		habit = id;
		editing = undefined;
		draft = '';
		draftError = undefined;
	}

	function add(event: SubmitEvent) {
		event.preventDefault();
		draftError =
			reasonProblem(draft) ??
			(reasons.length >= REASONS_MAX ? `That's ${REASONS_MAX} already.` : undefined);
		if (draftError) return;
		const text = draft;
		if (changeList((list) => [...list, newReason(text, list)])) draft = '';
	}

	function startEdit(reason: Reason) {
		editing = reason.id;
		editText = reason.text;
		editError = undefined;
	}

	function saveEdit(event: SubmitEvent, id: string) {
		event.preventDefault();
		editError = reasonProblem(editText);
		if (editError) return;
		const text = editText.trim();
		if (changeList((list) => list.map((r) => (r.id === id ? { ...r, text } : r))))
			editing = undefined;
	}

	function remove(reason: Reason) {
		if (changeList((list) => list.filter((r) => r.id !== reason.id))) {
			editing = undefined;
			toast('Reason deleted.');
		}
	}

	const star = (reason: Reason) =>
		changeList((list) => list.map((r) => (r.id === reason.id ? { ...r, starred: !r.starred } : r)));

	const move = (reason: Reason, by: number) =>
		changeList((list) => moveReason(list, reason.id, by));

	function saveNote(event: SubmitEvent) {
		event.preventDefault();
		if (!current) return;
		noteError = noteProblem(note);
		if (noteError) return;
		const id = current.id;
		const text = note;
		if (change((latest) => withNote(latest, id, text)))
			toast(text.trim() ? 'Note saved.' : 'Note removed.');
	}
</script>

<svelte:head>
	<title>Your why</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Reasons that matter to you make holding off worth it. Star the ones that hit hardest: Urge SOS
		shows them first.
	</p>

	{#if active.length}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 font-semibold">Reasons for</legend>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class={toggle(current === undefined)}
					aria-pressed={current === undefined}
					onclick={() => pick(undefined)}>In general</button
				>
				{#each active as h (h.id)}
					<button
						type="button"
						class={toggle(current?.id === h.id)}
						aria-pressed={current?.id === h.id}
						onclick={() => pick(h.id)}>{h.emoji} {h.name}</button
					>
				{/each}
			</div>
		</fieldset>
	{/if}

	<section aria-labelledby="reasons-heading" class="flex flex-col gap-3" data-testid="reasons">
		<h2 id="reasons-heading" class="text-lg font-semibold">
			{current ? `Your reasons: ${current.name}` : 'Your reasons'}
		</h2>
		{#if reasons.length === 0}
			<div class="{card} flex flex-col gap-2 text-sm" data-testid="why-prompts">
				<p>A few questions to start from:</p>
				<ul class="list-disc pl-5">
					{#each WHY_PROMPTS as prompt (prompt)}
						<li>{prompt}</li>
					{/each}
				</ul>
			</div>
		{/if}
		<ol class="flex flex-col gap-2">
			{#each reasons as reason, i (reason.id)}
				<li class="{card} flex flex-col gap-2" data-testid="reason">
					{#if editing === reason.id}
						<form class="flex flex-col gap-2" onsubmit={(e) => saveEdit(e, reason.id)}>
							<label class="flex flex-col gap-1 text-sm">
								<span>Reason</span>
								<input
									class={field}
									bind:value={editText}
									maxlength={REASON_MAX * 2}
									aria-invalid={editError ? 'true' : undefined}
									aria-describedby={editError ? 'edit-error' : undefined}
								/>
							</label>
							{#if editError}
								<p id="edit-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
									{editError}
								</p>
							{/if}
							<div class="grid grid-cols-3 gap-2 text-sm">
								<button type="submit" class={primary}>Save</button>
								<button type="button" class={button} onclick={() => (editing = undefined)}
									>Cancel</button
								>
								<button
									type="button"
									class="{button} text-red-700 dark:text-red-400"
									onclick={() => remove(reason)}>Delete</button
								>
							</div>
						</form>
					{:else}
						<p class="break-words">
							{#if reason.starred}<span aria-label="Starred">⭐</span>{/if}
							{reason.text}
						</p>
						<div class="grid grid-cols-4 gap-2 text-sm">
							<button
								type="button"
								class={button}
								aria-pressed={reason.starred}
								aria-label="Star: {reason.text}"
								onclick={() => star(reason)}>{reason.starred ? '★' : '☆'}</button
							>
							<button
								type="button"
								class={button}
								aria-label="Move up: {reason.text}"
								disabled={i === 0}
								onclick={() => move(reason, -1)}>↑</button
							>
							<button
								type="button"
								class={button}
								aria-label="Move down: {reason.text}"
								disabled={i === reasons.length - 1}
								onclick={() => move(reason, 1)}>↓</button
							>
							<button
								type="button"
								class={button}
								aria-label="Edit: {reason.text}"
								onclick={() => startEdit(reason)}>Edit</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
		<form class="{card} flex flex-col gap-2" onsubmit={add}>
			<label class="flex flex-col gap-1">
				<span class="text-sm">Add a reason</span>
				<input
					class={field}
					bind:value={draft}
					maxlength={REASON_MAX * 2}
					placeholder={current ? 'I want my evenings back' : 'I want to feel in charge of my day'}
					aria-invalid={draftError ? 'true' : undefined}
					aria-describedby={draftError ? 'draft-error' : undefined}
				/>
			</label>
			{#if draftError}
				<p id="draft-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
					{draftError}
				</p>
			{/if}
			<button type="submit" class={primary}>Add</button>
		</form>
	</section>

	{#if current}
		<form
			class="{card} flex flex-col gap-2"
			aria-labelledby="note-heading"
			onsubmit={saveNote}
			data-testid="why-note"
		>
			<h2 id="note-heading" class="text-lg font-semibold">A note to your future self</h2>
			<label class="flex flex-col gap-1">
				<span class="text-sm text-gray-600 dark:text-gray-400"
					>Urge SOS shows it as "A note from you" when this habit's urge hits.</span
				>
				<textarea
					class="{field} min-h-24"
					bind:value={note}
					maxlength={WHY_NOTE_MAX * 2}
					aria-invalid={noteError ? 'true' : undefined}
					aria-describedby={noteError ? 'note-error' : undefined}
				></textarea>
			</label>
			{#if noteError}
				<p id="note-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
					{noteError}
				</p>
			{/if}
			<button type="submit" class={primary} disabled={note.trim() === savedNote}>Save note</button>
		</form>
	{/if}
</main>
