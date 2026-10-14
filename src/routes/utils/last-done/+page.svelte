<script lang="ts">
	/**
	 * Last done (#218): one card per thing with how long it's been, how often you usually do it
	 * and when it's next due; a thing's page (`#<id>`) has its history and stats.
	 */
	import { onMount, tick } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { hasUnsavedChanges, persist, saveResult } from '$lib/persist.svelte';
	import { slashToFocus } from '$lib/shortcuts';
	import { entries, update } from '$lib/storage';
	import { toast } from '$lib/toast.svelte';
	import {
		agoLabel,
		average,
		dueLabel,
		everyLabel,
		gaps,
		median,
		newId,
		sortStatuses,
		statusOf,
		type LastDoneEntry,
		type LastDoneItem,
		type Status
	} from '$lib/utils/last-done';
	import DoneEarlier from './DoneEarlier.svelte';
	import GapChart from './GapChart.svelte';
	import ItemForm, { type Fields } from './ItemForm.svelte';
	import { button, card, primary } from './styles';

	let items = $state<LastDoneItem[]>([]);
	let log = $state<LastDoneEntry[]>([]);
	/** Ticks every minute (and when the page comes back), so "today" moves on at midnight. */
	let now = $state(new Date());
	/** The thing whose page is open (`#<id>`), if any. */
	let selected = $state<string | undefined>();
	let adding = $state(false);
	let editing = $state(false);
	/** The thing (or, on its page, the history row) whose "Done earlier" form is open. */
	let earlier = $state<string | undefined>();
	let query = $state('');

	/**
	 * What can be undone: the last Done, or a history row you deleted. Shown as an Undo row
	 * until the next change, with no timer, so it can't vanish before you reach it.
	 */
	let undo = $state<{ message: string; entry: LastDoneEntry; kind: 'logged' | 'deleted' }>();
	let undoButton = $state<HTMLButtonElement | undefined>();

	const savedItems = persist(
		entries.lastDoneItems,
		() => (items.length ? items : undefined),
		(value) => (items = value),
		{ cleared: () => (items = []) }
	);
	const savedLog = persist(
		entries.lastDoneLog,
		() => (log.length ? log : undefined),
		(value) => (log = value),
		{ cleared: () => (log = []) }
	);

	/** Changes the things, starting from the latest saved list; returns whether it was saved. */
	function changeItems(change: (latest: LastDoneItem[]) => LastDoneItem[]): boolean {
		const result = update(
			entries.lastDoneItems,
			$state.snapshot(items),
			(latest) => {
				const next = change(latest ?? []);
				return next.length ? next : undefined;
			},
			{ unsaved: hasUnsavedChanges(entries.lastDoneItems) }
		);
		items = result.value ?? [];
		savedItems.markSaved();
		return saveResult(entries.lastDoneItems, result.saved, { explicit: true });
	}

	/** Changes the history, starting from the latest saved log; returns whether it was saved. */
	function changeLog(change: (latest: LastDoneEntry[]) => LastDoneEntry[]): boolean {
		const result = update(
			entries.lastDoneLog,
			$state.snapshot(log),
			(latest) => {
				const next = change(latest ?? []);
				return next.length ? next : undefined;
			},
			{ unsaved: hasUnsavedChanges(entries.lastDoneLog) }
		);
		log = result.value ?? [];
		savedLog.markSaved();
		return saveResult(entries.lastDoneLog, result.saved, { explicit: true });
	}

	const readHash = () => {
		const id = decodeURIComponent(location.hash.slice(1));
		selected = id || undefined;
		editing = false;
		earlier = undefined;
		undo = undefined;
	};

	// "All things" leaves the hash out, which SvelteKit handles as a navigation.
	afterNavigate(readHash);

	onMount(() => {
		readHash();
		const tickNow = () => (now = new Date());
		const timer = setInterval(tickNow, 60_000);
		const visible = () => document.visibilityState === 'visible' && tickNow();
		addEventListener('hashchange', readHash);
		document.addEventListener('visibilitychange', visible);
		return () => {
			clearInterval(timer);
			removeEventListener('hashchange', readHash);
			document.removeEventListener('visibilitychange', visible);
		};
	});

	let statuses = $derived(
		sortStatuses(
			items.map((item) => statusOf(item, log, now)),
			now
		)
	);
	let shown = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase();
		return q ? statuses.filter((s) => s.item.name.toLocaleLowerCase().includes(q)) : statuses;
	});
	let current = $derived(statuses.find((s) => s.item.id === selected));

	async function offerUndo(next: NonNullable<typeof undo>) {
		undo = next;
		await tick();
		undoButton?.focus();
	}

	function logDone(item: LastDoneItem, at: Date): boolean {
		// A thing deleted in another tab since can't be logged.
		if (!items.some((i) => i.id === item.id)) return false;
		const entry: LastDoneEntry = {
			id: newId(log.map((e) => e.id)),
			itemId: item.id,
			at: at.toISOString()
		};
		if (!changeLog((latest) => [...latest, entry])) return false;
		earlier = undefined;
		now = new Date();
		void offerUndo({ message: `Logged ${item.name}.`, entry, kind: 'logged' });
		return true;
	}

	function undoLast() {
		const u = undo;
		if (!u) return;
		undo = undefined;
		const ok = changeLog((latest) =>
			u.kind === 'logged'
				? latest.filter((e) => e.id !== u.entry.id)
				: latest.some((e) => e.id === u.entry.id)
					? latest
					: [...latest, u.entry]
		);
		if (ok) toast(u.kind === 'logged' ? 'Undone.' : 'Put back.');
	}

	function add(fields: Fields): boolean {
		const ok = changeItems((latest) => [
			...latest,
			{ id: newId(latest.map((i) => i.id)), ...fields }
		]);
		if (ok) {
			adding = false;
			toast(`Added ${fields.name}.`);
		}
		return ok;
	}

	function edit(id: string, fields: Fields): boolean {
		const ok = changeItems((latest) => latest.map((i) => (i.id === id ? { id, ...fields } : i)));
		if (ok) {
			editing = false;
			toast('Saved.');
		}
		return ok;
	}

	function remove(item: LastDoneItem) {
		if (!confirm(`Delete “${item.name}” and its history?`)) return;
		const ok =
			changeLog((latest) => latest.filter((e) => e.itemId !== item.id)) &&
			changeItems((latest) => latest.filter((i) => i.id !== item.id));
		if (!ok) return;
		toast(`Deleted ${item.name}.`);
		void goto(resolve('/utils/last-done'));
	}

	function moveEntry(entry: LastDoneEntry, at: Date): boolean {
		const ok = changeLog((latest) =>
			latest.map((e) => (e.id === entry.id ? { ...e, at: at.toISOString() } : e))
		);
		if (ok) {
			earlier = undefined;
			toast('Saved.');
		}
		return ok;
	}

	function deleteEntry(entry: LastDoneEntry) {
		if (!changeLog((latest) => latest.filter((e) => e.id !== entry.id))) return;
		void offerUndo({ message: 'Removed from the history.', entry, kind: 'deleted' });
	}

	const days = (n: number) => `${Math.round(n * 10) / 10} ${n === 1 ? 'day' : 'days'}`;
	const when = (date: Date) =>
		date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	const usualLine = (s: Status) =>
		s.usual ? `usually ${everyLabel({ n: s.usual, unit: 'days' })}` : undefined;
</script>

<svelte:head>
	<title>Last done</title>
</svelte:head>

{#snippet undoRow()}
	{#if undo}
		<div
			class="flex items-center justify-between gap-2 rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
			role="status"
			data-testid="undo-row"
		>
			<span class="min-w-0 break-words">{undo.message}</span>
			<button type="button" class="{button} shrink-0" bind:this={undoButton} onclick={undoLast}
				>Undo</button
			>
		</div>
	{/if}
{/snippet}

{#snippet dueLine(s: Status)}
	{#if s.due}
		<span class="flex flex-wrap items-center gap-2 text-sm">
			{#if s.overdue}
				<span
					class="rounded-full bg-amber-200 px-2 text-xs font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100"
					data-testid="overdue">Overdue</span
				>
			{/if}
			<span class="text-gray-600 dark:text-gray-400">Due {dueLabel(s.due, now)}</span>
		</span>
	{/if}
{/snippet}

<main
	class="page-split @container flex flex-col gap-4 pt-2 pb-6 text-gray-800 sm:pb-12 dark:text-gray-200"
>
	{#if selected && current}
		{@const s = current}
		{@const g = gaps(s.times)}
		<a
			href={resolve('/utils/last-done')}
			class="inline-flex min-h-11 items-center self-start text-sm underline">All things</a
		>
		<section class="{card} flex flex-col gap-3" aria-labelledby="thing-name">
			{#if editing}
				<ItemForm
					initial={s.item}
					submitLabel="Save"
					onSubmit={(fields) => edit(s.item.id, fields)}
					onCancel={() => (editing = false)}
				>
					<button
						type="button"
						class="{button} text-red-700 dark:text-red-400"
						onclick={() => remove(s.item)}>Delete…</button
					>
				</ItemForm>
			{:else}
				<div class="flex items-start justify-between gap-3">
					<h2 id="thing-name" class="flex items-center gap-2 text-xl font-semibold">
						{#if s.item.emoji}<span aria-hidden="true">{s.item.emoji}</span>{/if}
						{s.item.name}
					</h2>
					<button type="button" class={button} onclick={() => (editing = true)}>Edit</button>
				</div>
				<p data-testid="since">
					{s.last ? `Last done ${agoLabel(s.last, now)}` : 'Not done yet'}
					{#if s.item.every}· target {everyLabel(s.item.every)}{/if}
				</p>
				{@render dueLine(s)}
				{#if s.item.notes}
					<p class="text-sm whitespace-pre-line text-gray-600 dark:text-gray-400">
						{s.item.notes}
					</p>
				{/if}
				{#if earlier === s.item.id}
					<DoneEarlier
						label="Done earlier: {s.item.name}"
						initial={now}
						onSubmit={(at) => logDone(s.item, at)}
						onCancel={() => (earlier = undefined)}
					/>
				{:else}
					<div class="flex flex-wrap gap-2">
						<button type="button" class="{primary} px-6" onclick={() => logDone(s.item, new Date())}
							>Done</button
						>
						<button type="button" class={button} onclick={() => (earlier = s.item.id)}
							>Done earlier…</button
						>
					</div>
				{/if}
			{/if}
		</section>

		{@render undoRow()}

		<div class="grid gap-4 @[50rem]:grid-cols-2">
			<section class="{card} flex flex-col gap-3" aria-labelledby="stats">
				<h3 id="stats" class="font-semibold">How often</h3>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="stats">
					<dt class="text-gray-600 dark:text-gray-400">Times done</dt>
					<dd>{s.times.length}</dd>
					{#if g.length}
						<dt class="text-gray-600 dark:text-gray-400">Median gap</dt>
						<dd data-testid="median">{days(median(g)!)}</dd>
						<dt class="text-gray-600 dark:text-gray-400">Average gap</dt>
						<dd>{days(average(g)!)}</dd>
						<dt class="text-gray-600 dark:text-gray-400">Shortest</dt>
						<dd>{days(Math.min(...g))}</dd>
						<dt class="text-gray-600 dark:text-gray-400">Longest</dt>
						<dd>{days(Math.max(...g))}</dd>
					{/if}
				</dl>
				{#if g.length}
					<GapChart gaps={g} />
				{:else}
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Log it a couple of times to see how often you do it.
					</p>
				{/if}
			</section>

			<section class="{card} flex flex-col gap-3" aria-labelledby="history">
				<h3 id="history" class="font-semibold">History</h3>
				{#if s.times.length === 0}
					<p class="text-sm text-gray-600 dark:text-gray-400">Nothing logged yet.</p>
				{:else}
					<ol class="flex flex-col gap-2" data-testid="history">
						{#each log
							.filter((e) => e.itemId === s.item.id)
							.sort((a, b) => b.at.localeCompare(a.at)) as entry (entry.id)}
							<li class="flex flex-col gap-2">
								{#if earlier === entry.id}
									<DoneEarlier
										label="Change {when(new Date(entry.at))}"
										initial={new Date(entry.at)}
										submitLabel="Save"
										onSubmit={(at) => moveEntry(entry, at)}
										onCancel={() => (earlier = undefined)}
									/>
								{:else}
									<div class="flex items-center justify-between gap-2">
										<span class="text-sm">{when(new Date(entry.at))}</span>
										<span class="flex gap-2">
											<button
												type="button"
												class="{button} text-sm"
												aria-label="Change {when(new Date(entry.at))}"
												onclick={() => (earlier = entry.id)}>Change</button
											>
											<button
												type="button"
												class="{button} text-sm"
												aria-label="Remove {when(new Date(entry.at))}"
												onclick={() => deleteEntry(entry)}>Remove</button
											>
										</span>
									</div>
								{/if}
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		</div>
	{:else if selected && items.length}
		<p>That thing isn't here any more.</p>
		<a
			href={resolve('/utils/last-done')}
			class="inline-flex min-h-11 items-center self-start underline">All things</a
		>
	{:else}
		{#if adding}
			<section class="{card} flex flex-col gap-3" aria-labelledby="add-heading">
				<h2 id="add-heading" class="font-semibold">Add something</h2>
				<ItemForm
					initial={{ name: '' }}
					submitLabel="Add"
					onSubmit={add}
					onCancel={() => (adding = false)}
				/>
			</section>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				<button type="button" class={primary} onclick={() => (adding = true)}>Add something</button>
				{#if items.length > 8}
					<label class="min-w-0 flex-1">
						<span class="sr-only">Search</span>
						<input
							type="search"
							bind:value={query}
							use:slashToFocus
							placeholder="Search…"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
						/>
					</label>
				{/if}
			</div>
		{/if}

		{@render undoRow()}

		{#if items.length === 0 && !adding}
			<p class="text-gray-600 dark:text-gray-400">
				Add the things you do now and then, like cleaning the bathroom or opening a new bag of dog
				food. Tap Done each time, and you'll see how long it's been and how often you usually do it.
			</p>
		{:else if shown.length === 0 && query}
			<p class="text-sm text-gray-600 dark:text-gray-400">Nothing matches “{query}”.</p>
		{/if}

		<ul class="grid gap-3 @[40rem]:grid-cols-2" data-testid="things">
			{#each shown as s (s.item.id)}
				<li class="{card} flex flex-col gap-2" data-testid="thing">
					<a
						href="#{encodeURIComponent(s.item.id)}"
						class="flex min-h-11 items-center gap-2 text-lg font-semibold hover:underline"
					>
						{#if s.item.emoji}<span aria-hidden="true">{s.item.emoji}</span>{/if}
						{s.item.name}
					</a>
					<p data-testid="since">
						{s.last ? agoLabel(s.last, now) : 'Not done yet'}
						{#if usualLine(s)}<span class="text-sm text-gray-600 dark:text-gray-400">
								· {usualLine(s)}</span
							>{/if}
					</p>
					{@render dueLine(s)}
					{#if earlier === s.item.id}
						<DoneEarlier
							label="Done earlier: {s.item.name}"
							initial={now}
							onSubmit={(at) => logDone(s.item, at)}
							onCancel={() => (earlier = undefined)}
						/>
					{:else}
						<div class="mt-auto flex gap-2 pt-1">
							<button
								type="button"
								class="{primary} flex-1"
								aria-label="Done: {s.item.name}"
								onclick={() => logDone(s.item, new Date())}>Done</button
							>
							<button
								type="button"
								class={button}
								aria-label="Done earlier: {s.item.name}"
								onclick={() => (earlier = s.item.id)}>Earlier…</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</main>
