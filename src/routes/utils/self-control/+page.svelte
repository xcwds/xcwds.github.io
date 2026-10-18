<script lang="ts">
	import { resolve } from '$app/paths';
	import { hasUnsavedChanges, persist, saveResult } from '#lib/persist.svelte.js';
	import { removeHabitData } from '#lib/self-control/data.js';
	import {
		DEFAULT_EMOJI,
		HABIT_KINDS,
		STARTERS,
		activeHabits,
		newHabit,
		withFields,
		type Habit
	} from '#lib/self-control/habits.js';
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { entries, read, update } from '#lib/storage.js';
	import { toast } from '#lib/toast.svelte.js';
	import { pages } from '../../../plugins/self-control/pages.js';
	import HabitForm from './HabitForm.svelte';
	import { button, card, primary } from './styles';

	let habits = $state<Habit[]>([]);
	/** Adding a habit: choosing a starter, then the form (prefilled from the starter). */
	let adding = $state<Pick<Habit, 'name' | 'emoji' | 'kind'> | 'choose' | undefined>();
	/** The habit being edited. */
	let editing = $state<string | undefined>();
	let noteOpen = $state(false);

	let active = $derived(activeHabits(habits));
	let archived = $derived(habits.filter((h) => h.archived));
	const kindLabel = (h: Habit) => HABIT_KINDS.find((k) => k.id === h.kind)!.label;

	// An empty list removes the saved entry. Another tab's changes load as they happen.
	const saved = persist(
		entries.selfControlHabits,
		() => (habits.length ? habits : undefined),
		(value) => (habits = value),
		{ cleared: () => (habits = []) }
	);

	/**
	 * Changes the habits starting from the latest saved list (another tab may have changed it
	 * since), saves them, and returns whether they were saved.
	 */
	function changeHabits(change: (latest: Habit[]) => Habit[]): boolean {
		const result = update(
			entries.selfControlHabits,
			$state.snapshot(habits),
			(latest) => {
				const next = change(latest ?? []);
				return next.length ? next : undefined;
			},
			{ unsaved: hasUnsavedChanges(entries.selfControlHabits) }
		);
		habits = result.value ?? [];
		saved.markSaved();
		return saveResult(entries.selfControlHabits, result.saved, { explicit: true });
	}

	// The note opens the first time you visit, then stays folded away.
	let noteChecked = false;
	$effect(() => {
		if (!settingsStatus.ready || noteChecked) return;
		noteChecked = true;
		if (read(entries.selfControlPrefs)?.noteSeen) return;
		noteOpen = true;
		const result = update(entries.selfControlPrefs, undefined, (latest) => ({
			...latest,
			noteSeen: true
		}));
		saveResult(entries.selfControlPrefs, result.saved);
	});

	function add(fields: Pick<Habit, 'name' | 'emoji' | 'kind'>): boolean {
		const ok = changeHabits((latest) => [...latest, newHabit(fields, latest)]);
		if (ok) {
			adding = undefined;
			toast('Habit added.');
		}
		return ok;
	}

	function edit(id: string, fields: Pick<Habit, 'name' | 'emoji' | 'kind'>): boolean {
		const ok = changeHabits((latest) =>
			latest.map((h) => (h.id === id ? withFields(h, fields) : h))
		);
		if (ok) {
			editing = undefined;
			toast('Habit saved.');
		}
		return ok;
	}

	function setArchived(habit: Habit, archived: boolean) {
		const ok = changeHabits((latest) =>
			latest.map((h) => (h.id === habit.id ? { ...h, archived } : h))
		);
		if (ok) toast(archived ? `${habit.name} archived.` : `${habit.name} restored.`);
	}

	function remove(habit: Habit) {
		if (
			!confirm(
				`Delete ${habit.name}? Everything saved for it goes too. This can't be undone. (Archive keeps it.)`
			)
		)
			return;
		// The habit goes first: data left behind by a failed second step belongs to no habit, and
		// the tools ignore it.
		const ok =
			changeHabits((latest) => latest.filter((h) => h.id !== habit.id)) &&
			removeHabitData(habit.id);
		if (ok) {
			editing = undefined;
			toast(`${habit.name} deleted.`);
		}
	}
</script>

<svelte:head>
	<title>Self-Control</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<a
		href={resolve('/utils/self-control/sos' as '/')}
		class="{primary} py-4 text-center text-lg"
		data-testid="sos-button">🌊 I have an urge right now</a
	>
	<section aria-labelledby="habits-heading" class="flex flex-col gap-3">
		<h2 id="habits-heading" class="text-lg font-semibold">Your habits</h2>
		{#if active.length === 0 && adding === undefined}
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Add a habit you're working on. Every tool here works without one, but your reasons and plans
				attach to a habit.
			</p>
		{/if}
		<ul class="flex flex-col gap-3">
			{#each active as habit (habit.id)}
				<li class="{card} flex flex-col gap-3" data-testid="habit">
					{#if editing === habit.id}
						<HabitForm
							initial={habit}
							submitLabel="Save"
							onSubmit={(fields) => edit(habit.id, fields)}
							onCancel={() => (editing = undefined)}
						>
							<button
								type="button"
								class="{button} text-red-700 dark:text-red-400"
								onclick={() => remove(habit)}>Delete habit</button
							>
						</HabitForm>
					{:else}
						<div class="flex items-center gap-3">
							<span class="text-2xl" aria-hidden="true">{habit.emoji}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold">{habit.name}</p>
								<p class="text-sm text-gray-600 dark:text-gray-400">{kindLabel(habit)}</p>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<button
								type="button"
								class={button}
								aria-label="Edit {habit.name}"
								onclick={() => (editing = habit.id)}>Edit</button
							>
							<button
								type="button"
								class={button}
								aria-label="Archive {habit.name}"
								onclick={() => setArchived(habit, true)}>Archive</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if adding === undefined}
			<button type="button" class={primary} onclick={() => (adding = 'choose')}>Add a habit</button>
		{:else if adding === 'choose'}
			<div class="{card} flex flex-col gap-3">
				<p class="text-sm">What do you want to work on?</p>
				<div class="grid grid-cols-2 gap-2 text-sm">
					{#each STARTERS as starter (starter.name)}
						<button type="button" class={button} onclick={() => (adding = { ...starter })}
							>{starter.emoji} {starter.name}</button
						>
					{/each}
					<button
						type="button"
						class="{button} col-span-2"
						onclick={() => (adding = { name: '', emoji: DEFAULT_EMOJI, kind: 'stop' })}
						>Something else</button
					>
				</div>
				<button type="button" class="{button} text-sm" onclick={() => (adding = undefined)}
					>Cancel</button
				>
			</div>
		{:else}
			<div class={card}>
				<HabitForm
					initial={adding}
					submitLabel="Add habit"
					onSubmit={add}
					onCancel={() => (adding = undefined)}
				/>
			</div>
		{/if}

		{#if archived.length}
			<details class="text-sm" data-testid="archived">
				<summary class="flex min-h-11 cursor-pointer items-center"
					>Archived ({archived.length})</summary
				>
				<ul class="mt-2 flex flex-col gap-2">
					{#each archived as habit (habit.id)}
						<li class="{card} flex flex-col gap-2" data-testid="archived-habit">
							<p class="truncate">
								<span aria-hidden="true">{habit.emoji}</span>
								{habit.name}
							</p>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									class={button}
									aria-label="Restore {habit.name}"
									onclick={() => setArchived(habit, false)}>Restore</button
								>
								<button
									type="button"
									class="{button} text-red-700 dark:text-red-400"
									aria-label="Delete {habit.name}"
									onclick={() => remove(habit)}>Delete</button
								>
							</div>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</section>

	{#if pages.length}
		<section aria-label="Tools" class="grid gap-3 sm:grid-cols-2">
			{#each pages as page (page.slug)}
				<a
					href={resolve(`/utils/self-control/${page.slug}` as '/')}
					class="{card} flex items-center gap-3 hover:bg-white dark:hover:bg-gray-800"
				>
					<span class="text-2xl" aria-hidden="true">{page.emoji}</span>
					<span class="flex flex-col">
						<span class="font-semibold">{page.title}</span>
						<span class="text-sm text-gray-600 dark:text-gray-400">{page.blurb}</span>
					</span>
				</a>
			{/each}
		</section>
	{/if}

	<details bind:open={noteOpen} class="{card} text-sm" data-testid="self-control-note">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold"
			>These are habit tools, not therapy</summary
		>
		<div class="mt-2 flex flex-col gap-2 text-gray-700 dark:text-gray-300">
			<p>
				They help with everyday cravings and habits. If an urge is about alcohol, drugs, gambling or
				self-harm, or feels out of control, please talk to a professional.
			</p>
			<ul class="flex flex-col gap-1">
				<li>
					US: call or text <a class="underline" href="tel:988">988</a>, the
					<a class="underline" href="https://988lifeline.org" rel="noreferrer" target="_blank"
						>Suicide &amp; Crisis Lifeline</a
					>, or
					<a
						class="underline"
						href="https://www.samhsa.gov/find-help/helplines/national-helpline"
						rel="noreferrer"
						target="_blank">SAMHSA's National Helpline</a
					> (1-800-662-4357).
				</li>
				<li>
					Elsewhere: <a
						class="underline"
						href="https://findahelpline.com"
						rel="noreferrer"
						target="_blank">findahelpline.com</a
					>.
				</li>
			</ul>
			<p>
				Everything here stays on this device. Backups include it, and
				<a class="underline" href={resolve('/settings')}>Settings → Your data</a> can clear it on its
				own.
			</p>
		</div>
	</details>
</main>
