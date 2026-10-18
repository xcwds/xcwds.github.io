<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { hasUnsavedChanges, persist, saveResult } from '#lib/persist.svelte.js';
	import {
		CUE_FIELDS,
		editEntry,
		logEntry,
		withCustomChips,
		type Cues,
		type LogFields
	} from '#lib/self-control/cues.js';
	import { activeHabits, habitById, randomId, type Habit } from '#lib/self-control/habits.js';
	import { TECHNIQUE_LABELS, appendEntry, type UrgeEntry } from '#lib/self-control/sos.js';
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { entries, read, update } from '#lib/storage.js';
	import { toast } from '#lib/toast.svelte.js';
	import { button, card } from '../styles';
	import { toggle } from '../../weightlifting/styles';
	import Patterns from './Patterns.svelte';
	import UrgeForm from './UrgeForm.svelte';

	const PAGE = 20;
	const OUTCOME_TEXT = { 'rode-out': 'Rode it out', partly: 'Partly', 'gave-in': 'Gave in' };

	let habits = $state<Habit[]>([]);
	let log = $state<UrgeEntry[] | undefined>();
	let custom = $state<Cues | undefined>();
	/** The habit the log and patterns show; undefined is every urge. */
	let filter = $state<string | undefined>();
	let shown = $state(PAGE);
	/** The entry being changed, and whether it was opened from Urge SOS (cues open). */
	let editing = $state<{ id: string; cues: boolean } | undefined>();
	/** An entry to open once the log has loaded (`#edit=<id>`, from Urge SOS). */
	let pending = $state<string | undefined>();
	/** Remounts the log form after a save, so it starts fresh. */
	let fresh = $state(0);

	const active = $derived(activeHabits(habits));
	const filtered = $derived(
		(log ?? []).filter((e) => filter === undefined || e.habit === filter).reverse()
	);

	// Another tab's changes load as they happen.
	const saved = persist(
		entries.selfControlLog,
		() => log,
		(value) => (log = value),
		{ cleared: () => (log = undefined) }
	);

	$effect(() => {
		if (!settingsStatus.ready) return;
		habits = read(entries.selfControlHabits) ?? [];
		custom = read(entries.selfControlPrefs)?.cues;
	});

	// A filter for a habit deleted or archived elsewhere falls back to every urge.
	$effect(() => {
		if (filter !== undefined && !active.some((h) => h.id === filter)) filter = undefined;
	});

	onMount(() => {
		const match = /^#edit=(.+)$/.exec(location.hash);
		if (!match) return;
		pending = decodeURIComponent(match[1]!);
		replaceState(resolve('/utils/self-control/cues' as '/'), {});
	});

	$effect(() => {
		if (pending === undefined || !settingsStatus.ready) return;
		const id = pending;
		pending = undefined;
		if (!log?.some((e) => e.id === id)) return;
		editing = { id, cues: true };
		requestAnimationFrame(() =>
			document.getElementById(`entry-${id}`)?.scrollIntoView({ block: 'start' })
		);
	});

	/** Saves a change to the latest saved log; returns whether it was saved. */
	function change(fn: (latest: UrgeEntry[]) => UrgeEntry[]): boolean {
		const result = update(
			entries.selfControlLog,
			$state.snapshot(log),
			(latest) => {
				const next = fn(latest ?? []);
				return next.length ? next : undefined;
			},
			{ unsaved: hasUnsavedChanges(entries.selfControlLog) }
		);
		log = result.value;
		saved.markSaved();
		return saveResult(entries.selfControlLog, result.saved, { explicit: true });
	}

	/** `fields` without a habit deleted since the page loaded (its log went with it). */
	function checked(fields: LogFields): LogFields {
		if (!fields.habit || habitById(read(entries.selfControlHabits) ?? [], fields.habit))
			return fields;
		return { ...fields, habit: undefined };
	}

	/** Remembers your own chips, so they're offered first next time. */
	function rememberChips(cues: Cues | undefined) {
		if (!cues || !CUE_FIELDS.some((f) => cues[f]?.length)) return;
		const result = update(entries.selfControlPrefs, undefined, (latest) => {
			const next = { ...latest };
			const chips = withCustomChips(latest?.cues, cues);
			if (chips) next.cues = chips;
			else delete next.cues;
			return next;
		});
		if (saveResult(entries.selfControlPrefs, result.saved)) custom = result.value?.cues;
	}

	function add(fields: LogFields): boolean {
		const entry = logEntry(checked(fields), randomId());
		if (!change((latest) => appendEntry(latest, entry))) return false;
		rememberChips(entry.cues);
		fresh++;
		toast('Logged.');
		return true;
	}

	function edit(id: string, fields: LogFields): boolean {
		const next = checked(fields);
		let found = false;
		const ok = change((latest) =>
			latest.map((e) => {
				if (e.id !== id) return e;
				found = true;
				return editEntry(e, next);
			})
		);
		if (!ok) return false;
		editing = undefined;
		// Another tab may have deleted it meanwhile.
		if (!found) {
			toast('That urge was deleted elsewhere.');
			return true;
		}
		rememberChips(next.cues);
		toast('Saved.');
		return true;
	}

	function remove(id: string) {
		if (!change((latest) => latest.filter((e) => e.id !== id))) return;
		editing = undefined;
		toast('Deleted.');
	}

	/** The habits an entry's form offers: the active ones, and its own if it's archived. */
	const habitsFor = (entry: UrgeEntry): Habit[] => {
		const own = entry.habit ? habitById(habits, entry.habit) : undefined;
		return own && own.archived ? [...active, own] : active;
	};

	const fieldsOf = (entry: UrgeEntry): LogFields => ({
		habit: entry.habit,
		at: entry.at,
		intensity: entry.start,
		outcome: entry.outcome,
		cues: entry.cues,
		note: entry.note
	});

	const when = (at: number) =>
		new Date(at).toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
</script>

<svelte:head>
	<title>Cue Audit</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Log urges as they come, whether or not you gave in, and what was going on. After a few, the
		patterns show when, where and why they hit.
	</p>

	<section aria-labelledby="log-urge-heading" class="{card} flex flex-col gap-3">
		<h2 id="log-urge-heading" class="text-lg font-semibold">Log an urge</h2>
		{#key fresh}
			<UrgeForm habits={active} {custom} submitLabel="Log it" onSubmit={add} />
		{/key}
	</section>

	{#if active.length}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 font-semibold">Show</legend>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class={toggle(filter === undefined)}
					aria-pressed={filter === undefined}
					onclick={() => (filter = undefined)}>Every urge</button
				>
				{#each active as h (h.id)}
					<button
						type="button"
						class={toggle(filter === h.id)}
						aria-pressed={filter === h.id}
						onclick={() => (filter = h.id)}>{h.emoji} {h.name}</button
					>
				{/each}
			</div>
		</fieldset>
	{/if}

	<Patterns log={filtered} habit={filter} />

	<section aria-labelledby="entries-heading" class="flex flex-col gap-3">
		<h2 id="entries-heading" class="text-lg font-semibold">Log</h2>
		{#if filtered.length === 0}
			<p class="text-sm text-gray-600 dark:text-gray-400">Nothing logged yet.</p>
		{/if}
		<ul class="flex flex-col gap-2">
			{#each filtered.slice(0, shown) as entry (entry.id)}
				{@const h = entry.habit ? habitById(habits, entry.habit) : undefined}
				<li id="entry-{entry.id}" class="{card} flex flex-col gap-2 text-sm" data-testid="urge">
					{#if editing?.id === entry.id}
						<UrgeForm
							habits={habitsFor(entry)}
							{custom}
							initial={fieldsOf(entry)}
							cuesOpen={editing.cues || entry.cues !== undefined || entry.note !== undefined}
							submitLabel="Save"
							onSubmit={(fields) => edit(entry.id, fields)}
							onCancel={() => (editing = undefined)}
						>
							<button
								type="button"
								class="{button} text-red-700 dark:text-red-400"
								onclick={() => remove(entry.id)}>Delete</button
							>
						</UrgeForm>
					{:else}
						<div class="flex items-start gap-2">
							<div class="flex min-w-0 flex-1 flex-col gap-1 py-1">
								<p class="font-semibold">
									{when(entry.at)} · {OUTCOME_TEXT[entry.outcome]}
								</p>
								<p class="text-gray-600 dark:text-gray-400">
									{h ? `${h.emoji} ${h.name}` : 'Just a craving'} · {entry.start}/10{entry.technique
										? ` · ${TECHNIQUE_LABELS[entry.technique]}`
										: ''}
								</p>
								{#if entry.cues}
									<p class="break-words" data-testid="urge-cues">
										{CUE_FIELDS.flatMap((f) => entry.cues?.[f] ?? []).join(' · ')}
									</p>
								{/if}
								{#if entry.note}
									<p class="break-words italic">{entry.note}</p>
								{/if}
							</div>
							<button
								type="button"
								class={button}
								aria-label="Edit the urge from {when(entry.at)}"
								onclick={() => (editing = { id: entry.id, cues: false })}>Edit</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		{#if filtered.length > shown}
			<button type="button" class={button} onclick={() => (shown += PAGE)}>Show more</button>
		{/if}
	</section>

	<details class="{card} text-sm">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold">How this works</summary
		>
		<p class="mt-2 text-gray-700 dark:text-gray-300">
			Noticing your patterns is itself a way to change them: writing down each urge makes the next
			one easier to catch. Log for a week before judging what you see. Everything stays on this
			device.
		</p>
	</details>
</main>
