<script lang="ts">
	import {
		CUSTOM_MAX,
		GROUPS,
		GROUP_LABELS,
		TEXT_MAX,
		matchesCue,
		textProblem,
		type Group,
		type HabitPlan,
		type StarterItem
	} from '$lib/self-control/environment';
	import { button, card, field, primary } from '../styles';

	/** A habit's environment checklist: built-in and your own items, by group. */
	let {
		items,
		plan,
		cue,
		onTick,
		onHide,
		onAdd,
		onDelete
	}: {
		/** The habit's built-in items. */
		items: StarterItem[];
		plan: HabitPlan;
		/** A cue you came here to plan for: items that help with it are highlighted. */
		cue?: string;
		/** Each returns whether the change was saved. */
		onTick: (id: string, done: boolean) => boolean;
		onHide: (id: string, hidden: boolean) => boolean;
		onAdd: (group: Group, text: string) => boolean;
		onDelete: (id: string) => boolean;
	} = $props();

	type Row = { id: string; group: Group; text: string; custom: boolean; match: boolean };

	const rows = $derived<Row[]>([
		...items.map((i) => ({ ...i, custom: false, match: matchesCue(i, cue) })),
		...plan.custom.map((i) => ({ ...i, custom: true, match: false }))
	]);
	const shown = $derived(rows.filter((r) => !plan.hidden.includes(r.id)));
	const hidden = $derived(rows.filter((r) => plan.hidden.includes(r.id)));
	const doneCount = $derived(shown.filter((r) => plan.done.includes(r.id)).length);

	let draft = $state('');
	let group = $state<Group>('hide');
	let error = $state<string | undefined>();

	function add(event: SubmitEvent) {
		event.preventDefault();
		error =
			textProblem(draft) ??
			(plan.custom.length >= CUSTOM_MAX
				? `That's ${CUSTOM_MAX} of your own already. Delete one first.`
				: undefined);
		if (error) return;
		if (onAdd(group, draft)) draft = '';
	}
</script>

<section aria-labelledby="checklist-heading" class="flex flex-col gap-4" data-testid="checklist">
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="checklist-heading" class="text-lg font-semibold">Change your surroundings</h2>
		<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="checklist-progress">
			{doneCount} of {shown.length} done
		</p>
	</div>
	{#each GROUPS as g (g)}
		{@const list = shown.filter((r) => r.group === g)}
		{#if list.length}
			<div class="flex flex-col gap-2" data-testid="group-{g}">
				<h3 class="font-semibold">{GROUP_LABELS[g]}</h3>
				<ul class="flex flex-col gap-2">
					{#each list as row (row.id)}
						<li
							class="{card} flex items-center gap-2 text-sm {row.match
								? 'ring-2 ring-blue-600'
								: ''}"
							data-testid="checklist-item"
						>
							<label class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									class="size-5 shrink-0"
									checked={plan.done.includes(row.id)}
									onchange={(e) => {
										const input = e.currentTarget;
										if (!onTick(row.id, input.checked)) input.checked = !input.checked;
									}}
								/>
								<span class="break-words"
									>{row.text}{#if row.match}<span class="sr-only">
											(helps with {cue})</span
										>{/if}</span
								>
							</label>
							{#if row.custom}
								<button
									type="button"
									class="{button} shrink-0 text-red-700 dark:text-red-400"
									aria-label="Delete: {row.text}"
									onclick={() => onDelete(row.id)}>Delete</button
								>
							{:else}
								<button
									type="button"
									class="{button} shrink-0"
									aria-label="Not for me: {row.text}"
									onclick={() => onHide(row.id, true)}>Not for me</button
								>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}

	<form class="{card} flex flex-col gap-2" onsubmit={add}>
		<label class="flex flex-col gap-1">
			<span class="text-sm">Add your own</span>
			<input
				class={field}
				bind:value={draft}
				maxlength={TEXT_MAX * 2}
				placeholder="e.g. Keep the guitar on its stand"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'custom-error' : undefined}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>Group</span>
			<select class="{field} min-h-11" bind:value={group}>
				{#each GROUPS as g (g)}
					<option value={g}>{GROUP_LABELS[g]}</option>
				{/each}
			</select>
		</label>
		{#if error}
			<p id="custom-error" role="alert" class="text-sm text-red-700 dark:text-red-400">{error}</p>
		{/if}
		<button type="submit" class={primary}>Add</button>
	</form>

	{#if hidden.length}
		<details class="text-sm" data-testid="hidden-items">
			<summary class="flex min-h-11 cursor-pointer items-center"
				>Not for me ({hidden.length})</summary
			>
			<ul class="mt-2 flex flex-col gap-2">
				{#each hidden as row (row.id)}
					<li class="{card} flex items-center gap-2">
						<span class="min-w-0 flex-1 break-words">{row.text}</span>
						<button
							type="button"
							class="{button} shrink-0"
							aria-label="Restore: {row.text}"
							onclick={() => onHide(row.id, false)}>Restore</button
						>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>
