<script lang="ts">
	import { resolve } from '$app/paths';
	import { hasUnsavedChanges, persist, saveResult } from '$lib/persist.svelte';
	import { activeHabits, type Habit } from '$lib/self-control/habits';
	import {
		itemsFor,
		leanText,
		newItem,
		tilt,
		withItems,
		type Seesaw,
		type SeesawItem,
		type Side,
		type Weight
	} from '$lib/self-control/seesaw';
	import { settingsStatus } from '$lib/settings.svelte';
	import { entries, read, update } from '$lib/storage';
	import { card } from '../styles';
	import { toggle } from '../../weightlifting/styles';
	import SeesawSide from './SeesawSide.svelte';

	let habits = $state<Habit[]>([]);
	let seesaw = $state<Seesaw | undefined>();
	let picked = $state<string | undefined>();

	const active = $derived(activeHabits(habits));
	/** The habit shown: the one you picked, or the first. */
	const current = $derived(active.find((h) => h.id === picked) ?? active[0]);
	const items = $derived(current ? itemsFor(seesaw, current.id) : []);
	const balance = $derived(tilt(items));
	const on = (side: Side) => items.filter((i) => i.side === side);

	// Another tab's changes load as they happen.
	const saved = persist(
		entries.selfControlSeesaw,
		() => seesaw,
		(value) => (seesaw = value),
		{ cleared: () => (seesaw = undefined) }
	);

	$effect(() => {
		if (settingsStatus.ready) habits = read(entries.selfControlHabits) ?? [];
	});

	/** Saves a change to the latest saved seesaws; returns whether it was saved. */
	function change(fn: (items: SeesawItem[]) => SeesawItem[]): boolean {
		if (!current) return false;
		const id = current.id;
		const result = update(
			entries.selfControlSeesaw,
			$state.snapshot(seesaw),
			(latest) => withItems(latest, id, fn),
			{ unsaved: hasUnsavedChanges(entries.selfControlSeesaw) }
		);
		seesaw = result.value;
		saved.markSaved();
		return saveResult(entries.selfControlSeesaw, result.saved, { explicit: true });
	}

	const add = (side: Side) => (text: string, weight: Weight) =>
		change((list) => [...list, newItem({ side, text, weight }, list)]);
	const edit = (id: string, patch: Partial<Pick<SeesawItem, 'text' | 'weight'>>) =>
		change((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
	const remove = (id: string) => change((list) => list.filter((i) => i.id !== id));
</script>

<svelte:head>
	<title>Decision Seesaw</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Weigh what giving in gets you now against what it costs you later, and the same for holding off.
		Name the honest upsides of the habit too: it works better when the short-term reward has a
		voice.
	</p>

	{#if !current}
		<p class={card}>
			The seesaw is per habit.
			<a class="underline" href={resolve('/utils/self-control')}>Add a habit</a> first.
		</p>
	{:else}
		{#if active.length > 1}
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 font-semibold">Habit</legend>
				<div class="flex flex-wrap gap-2">
					{#each active as h (h.id)}
						<button
							type="button"
							class={toggle(current.id === h.id)}
							aria-pressed={current.id === h.id}
							onclick={() => (picked = h.id)}>{h.emoji} {h.name}</button
						>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="{card} flex flex-col items-center gap-2" data-testid="seesaw">
			<svg viewBox="0 0 220 90" class="w-full max-w-xs" aria-hidden="true">
				<g class="beam" style="transform: rotate({balance.angle}deg)">
					<rect x="10" y="40" width="200" height="6" rx="3" class="fill-gray-500" />
					<text x="40" y="30" text-anchor="middle" class="fill-current text-[11px]">Giving in</text>
					<text x="180" y="30" text-anchor="middle" class="fill-current text-[11px]"
						>Holding off</text
					>
				</g>
				<polygon points="110,46 96,80 124,80" class="fill-blue-600" />
			</svg>
			<p class="font-semibold" aria-live="polite" data-testid="lean">
				{leanText(balance)}
			</p>
			<p class="text-center text-sm text-gray-600 dark:text-gray-400">
				A prompt to reflect, not a verdict. The later side is giving in's costs plus holding off's
				gains.
			</p>
		</div>

		<!-- Each habit's lists start fresh: no half-typed item carries over. -->
		{#key current.id}
			<section aria-labelledby="give-heading" class="flex flex-col gap-4">
				<h2 id="give-heading" class="text-lg font-semibold">Giving in</h2>
				{#each ['give-now', 'give-later'] as const as side (side)}
					<SeesawSide {side} items={on(side)} onAdd={add(side)} onChange={edit} onRemove={remove} />
				{/each}
			</section>
			<section aria-labelledby="hold-heading" class="flex flex-col gap-4">
				<h2 id="hold-heading" class="text-lg font-semibold">Holding off</h2>
				{#each ['hold-now', 'hold-later'] as const as side (side)}
					<SeesawSide {side} items={on(side)} onAdd={add(side)} onChange={edit} onRemove={remove} />
				{/each}
			</section>
		{/key}
	{/if}
</main>

<style>
	.beam {
		transform-origin: 110px 43px;
		transition: transform 0.4s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.beam {
			transition: none;
		}
	}
</style>
