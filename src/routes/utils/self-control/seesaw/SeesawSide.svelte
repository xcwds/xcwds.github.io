<script lang="ts">
	import {
		ITEMS_PER_SIDE,
		ITEM_MAX,
		SIDE_EXAMPLES,
		SIDE_LABELS,
		WEIGHTS,
		itemProblem,
		type SeesawItem,
		type Side,
		type Weight
	} from '#lib/self-control/seesaw.js';
	import { button, card, field, primary } from '../styles';
	import { toggle } from '../../weightlifting/styles';

	/** One of the seesaw's four lists: its items, each weighed, and a box to add one. */
	let {
		side,
		items,
		onAdd,
		onChange,
		onRemove
	}: {
		side: Side;
		items: SeesawItem[];
		/** Each returns whether the change was saved. */
		onAdd: (text: string, weight: Weight) => boolean;
		onChange: (id: string, patch: Partial<Pick<SeesawItem, 'text' | 'weight'>>) => boolean;
		onRemove: (id: string) => boolean;
	} = $props();

	let draft = $state('');
	let weight = $state<Weight>(2);
	let error = $state<string | undefined>();
	let editing = $state<string | undefined>();
	let editText = $state('');
	let editError = $state<string | undefined>();

	const label = $derived(SIDE_LABELS[side]);

	function add(event: SubmitEvent) {
		event.preventDefault();
		error =
			itemProblem(draft) ??
			(items.length >= ITEMS_PER_SIDE ? `That's ${ITEMS_PER_SIDE} already.` : undefined);
		if (error) return;
		if (onAdd(draft, weight)) {
			draft = '';
			weight = 2;
		}
	}

	function saveEdit(event: SubmitEvent, id: string) {
		event.preventDefault();
		editError = itemProblem(editText);
		if (editError) return;
		if (onChange(id, { text: editText.trim() })) editing = undefined;
	}
</script>

<section class="flex flex-col gap-2" aria-label={label} data-testid="side-{side}">
	<h3 class="font-semibold">{label}</h3>
	{#if items.length}
		<ul class="flex flex-col gap-2">
			{#each items as item (item.id)}
				<li class="{card} flex flex-col gap-2 text-sm" data-testid="seesaw-item">
					{#if editing === item.id}
						<form class="flex flex-col gap-2" onsubmit={(e) => saveEdit(e, item.id)}>
							<label class="flex flex-col gap-1">
								<span>Edit</span>
								<input
									class={field}
									bind:value={editText}
									maxlength={ITEM_MAX * 2}
									aria-invalid={editError ? 'true' : undefined}
									aria-describedby={editError ? `${side}-edit-error` : undefined}
								/>
							</label>
							{#if editError}
								<p id="{side}-edit-error" role="alert" class="text-red-700 dark:text-red-400">
									{editError}
								</p>
							{/if}
							<div class="grid grid-cols-3 gap-2">
								<button type="submit" class={primary}>Save</button>
								<button type="button" class={button} onclick={() => (editing = undefined)}
									>Cancel</button
								>
								<button
									type="button"
									class="{button} text-red-700 dark:text-red-400"
									onclick={() => onRemove(item.id) && (editing = undefined)}>Delete</button
								>
							</div>
						</form>
					{:else}
						<div class="flex items-start gap-2">
							<p class="min-w-0 flex-1 py-2 break-words">{item.text}</p>
							<button
								type="button"
								class={button}
								aria-label="Edit: {item.text}"
								onclick={() => {
									editing = item.id;
									editText = item.text;
									editError = undefined;
								}}>Edit</button
							>
						</div>
						<div class="grid grid-cols-3 gap-2" role="group" aria-label="How much: {item.text}">
							{#each WEIGHTS as w (w.value)}
								<button
									type="button"
									class={toggle(item.weight === w.value)}
									aria-pressed={item.weight === w.value}
									onclick={() => onChange(item.id, { weight: w.value })}>{w.label}</button
								>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<form class="flex flex-col gap-2" onsubmit={add}>
		<div class="flex gap-2">
			<input
				class={field}
				bind:value={draft}
				maxlength={ITEM_MAX * 2}
				placeholder="e.g. {SIDE_EXAMPLES[side]}"
				aria-label="Add to {label}"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${side}-error` : undefined}
			/>
			<button type="submit" class="{primary} shrink-0">Add</button>
		</div>
		<div class="grid grid-cols-3 gap-2 text-sm" role="group" aria-label="How much, for a new item">
			{#each WEIGHTS as w (w.value)}
				<button
					type="button"
					class={toggle(weight === w.value)}
					aria-pressed={weight === w.value}
					onclick={() => (weight = w.value)}>{w.label}</button
				>
			{/each}
		</div>
		{#if error}
			<p id="{side}-error" role="alert" class="text-sm text-red-700 dark:text-red-400">{error}</p>
		{/if}
	</form>
</section>
