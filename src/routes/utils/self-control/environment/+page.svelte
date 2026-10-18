<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { hasUnsavedChanges, persist, saveResult } from '#lib/persist.svelte.js';
	import { CUE_FIELDS, topCues } from '#lib/self-control/cues.js';
	import {
		PLANS_MAX,
		TEXT_MAX,
		newCustomItem,
		newPlan,
		planFor,
		starterItems,
		textProblem,
		toggled,
		withPlan,
		withoutCustom,
		type Environment,
		type Group,
		type HabitPlan,
		type Plan
	} from '#lib/self-control/environment.js';
	import { activeHabits, type Habit } from '#lib/self-control/habits.js';
	import { SPRINT_ACTIONS, type UrgeEntry } from '#lib/self-control/sos.js';
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { entries, read, update } from '#lib/storage.js';
	import { toast } from '#lib/toast.svelte.js';
	import { button, card, field, primary } from '../styles';
	import { toggle } from '../../weightlifting/styles';
	import Checklist from './Checklist.svelte';

	let habits = $state<Habit[]>([]);
	let log = $state<UrgeEntry[]>([]);
	let env = $state<Environment | undefined>();
	let picked = $state<string | undefined>();
	/** A cue you came from the Cue Audit to plan for (`#habit=…&cue=…`). */
	let cue = $state<string | undefined>();

	let cueDraft = $state('');
	let actionDraft = $state('');
	let planErrors = $state<{ cue?: string; action?: string; plans?: string }>({});

	const active = $derived(activeHabits(habits));
	/** The habit shown: the one you picked, or the first. */
	const current = $derived(active.find((h) => h.id === picked) ?? active[0]);
	const plan = $derived(current ? planFor(env, current.id) : undefined);
	const items = $derived(current ? starterItems(current.name) : []);

	/** Your most common cues for the habit (Cue Audit), most common first. */
	const cueChips = $derived.by(() => {
		if (!current) return [];
		const own = log.filter((e) => e.habit === current.id);
		const stats = CUE_FIELDS.flatMap((f) => topCues(own, f, 5)).sort((a, b) => b.urges - a.urges);
		return [...new Set(stats.map((s) => s.cue))].slice(0, 6);
	});
	/** Actions to pick from: the sprint actions and the "better option" items you've done. */
	const actionChips = $derived.by(() => {
		const done = plan
			? [...items, ...plan.custom].filter((i) => i.group === 'easy' && plan.done.includes(i.id))
			: [];
		return [...new Set([...done.map((i) => i.text), ...SPRINT_ACTIONS])];
	});

	// Another tab's changes load as they happen.
	const saved = persist(
		entries.selfControlPlan,
		() => env,
		(value) => (env = value),
		{ cleared: () => (env = undefined) }
	);

	$effect(() => {
		if (!settingsStatus.ready) return;
		habits = read(entries.selfControlHabits) ?? [];
		log = read(entries.selfControlLog) ?? [];
	});

	onMount(() => {
		const params = new URLSearchParams(location.hash.slice(1));
		const fromCue = params.get('cue')?.trim();
		if (!fromCue) return;
		picked = params.get('habit') ?? undefined;
		cue = fromCue.slice(0, TEXT_MAX);
		cueDraft = cue;
		replaceState(resolve('/utils/self-control/environment' as '/'), {});
	});

	function pick(id: string) {
		picked = id;
		cue = undefined;
		cueDraft = '';
		actionDraft = '';
		planErrors = {};
	}

	/** Saves a change to the habit's plan, starting from the latest saved; returns whether it was saved. */
	function change(fn: (plan: HabitPlan) => HabitPlan): boolean {
		if (!current) return false;
		const id = current.id;
		const result = update(
			entries.selfControlPlan,
			$state.snapshot(env),
			(latest) => withPlan(latest, id, fn),
			{ unsaved: hasUnsavedChanges(entries.selfControlPlan) }
		);
		env = result.value;
		saved.markSaved();
		return saveResult(entries.selfControlPlan, result.saved, { explicit: true });
	}

	const tick = (id: string, done: boolean) =>
		change((p) => ({ ...p, done: toggled(p.done, id, done) }));

	function hide(id: string, hidden: boolean): boolean {
		const ok = change((p) => ({ ...p, hidden: toggled(p.hidden, id, hidden) }));
		if (ok) toast(hidden ? 'Hidden.' : 'Restored.');
		return ok;
	}

	function addItem(group: Group, text: string): boolean {
		const ok = change((p) => ({ ...p, custom: [...p.custom, newCustomItem(group, text, p)] }));
		if (ok) toast('Added.');
		return ok;
	}

	function deleteItem(id: string): boolean {
		const ok = change((p) => withoutCustom(p, id));
		if (ok) toast('Deleted.');
		return ok;
	}

	function addPlan(event: SubmitEvent) {
		event.preventDefault();
		planErrors = {
			cue: textProblem(cueDraft),
			action: textProblem(actionDraft),
			plans:
				plan && plan.plans.length >= PLANS_MAX
					? `That's ${PLANS_MAX} plans already. Delete one first.`
					: undefined
		};
		if (planErrors.cue || planErrors.action || planErrors.plans) return;
		const [c, a] = [cueDraft, actionDraft];
		if (change((p) => ({ ...p, plans: [...p.plans, newPlan(c, a, p)] }))) {
			cueDraft = '';
			actionDraft = '';
			cue = undefined;
			toast('Plan added.');
		}
	}

	const star = (p: Plan) =>
		change((hp) => ({
			...hp,
			plans: hp.plans.map((x) => (x.id === p.id ? { ...x, starred: !x.starred } : x))
		}));

	function deletePlan(p: Plan) {
		if (change((hp) => ({ ...hp, plans: hp.plans.filter((x) => x.id !== p.id) })))
			toast('Plan deleted.');
	}

	const planText = (p: Plan) => `If ${p.cue}, then I will ${p.action}.`;
	/** A chip as the end of "…then I will": "Drink a glass of water" → "drink a glass of water". */
	const asAction = (chip: string) => chip.charAt(0).toLowerCase() + chip.slice(1);
</script>

<svelte:head>
	<title>Environment Designer</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Make the habit the harder option and the better choice the easy one, then decide ahead of time
		what you'll do when the urge comes.
	</p>

	{#if !current || !plan}
		<p class={card}>
			The Environment Designer is per habit.
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
							onclick={() => pick(h.id)}>{h.emoji} {h.name}</button
						>
					{/each}
				</div>
			</fieldset>
		{/if}

		<section aria-labelledby="plans-heading" class="flex flex-col gap-3" data-testid="plans">
			<h2 id="plans-heading" class="text-lg font-semibold">If-then plans</h2>
			{#if plan.plans.length}
				<ul class="flex flex-col gap-2">
					{#each plan.plans as p (p.id)}
						<li class="{card} flex flex-col gap-2 text-sm" data-testid="plan">
							<p class="break-words">
								{#if p.starred}<span aria-hidden="true">⭐ </span><span class="sr-only"
										>Starred:
									</span>{/if}If <strong>{p.cue}</strong>, then I will <strong>{p.action}</strong>.
							</p>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									class={button}
									aria-pressed={p.starred}
									aria-label="Star: {planText(p)}"
									onclick={() => star(p)}>{p.starred ? '★ Starred' : '☆ Star'}</button
								>
								<button
									type="button"
									class="{button} text-red-700 dark:text-red-400"
									aria-label="Delete: {planText(p)}"
									onclick={() => deletePlan(p)}>Delete</button
								>
							</div>
						</li>
					{/each}
				</ul>
				<p class="text-sm text-gray-600 dark:text-gray-400">Urge SOS shows your starred plans.</p>
			{/if}
			<form class="{card} flex flex-col gap-3" onsubmit={addPlan} data-testid="plan-form">
				<label class="flex flex-col gap-1">
					<span class="text-sm">If…</span>
					<input
						class={field}
						bind:value={cueDraft}
						maxlength={TEXT_MAX * 2}
						placeholder="I'm bored after dinner"
						aria-invalid={planErrors.cue ? 'true' : undefined}
						aria-describedby={planErrors.cue ? 'cue-error' : undefined}
					/>
				</label>
				{#if cueChips.length}
					<div class="flex flex-wrap gap-2" role="group" aria-label="Your top cues">
						{#each cueChips as chip (chip)}
							<button
								type="button"
								class={toggle(cueDraft === chip)}
								aria-pressed={cueDraft === chip}
								onclick={() => (cueDraft = chip)}>{chip}</button
							>
						{/each}
					</div>
				{/if}
				{#if planErrors.cue}
					<p id="cue-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
						{planErrors.cue}
					</p>
				{/if}
				<label class="flex flex-col gap-1">
					<span class="text-sm">…then I will</span>
					<input
						class={field}
						bind:value={actionDraft}
						maxlength={TEXT_MAX * 2}
						placeholder="make a cup of tea"
						aria-invalid={planErrors.action ? 'true' : undefined}
						aria-describedby={planErrors.action ? 'action-error' : undefined}
					/>
				</label>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Actions">
					{#each actionChips as chip (chip)}
						<button
							type="button"
							class={toggle(actionDraft === asAction(chip))}
							aria-pressed={actionDraft === asAction(chip)}
							onclick={() => (actionDraft = asAction(chip))}>{chip}</button
						>
					{/each}
				</div>
				{#if planErrors.action}
					<p id="action-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
						{planErrors.action}
					</p>
				{/if}
				{#if planErrors.plans}
					<p role="alert" class="text-sm text-red-700 dark:text-red-400">{planErrors.plans}</p>
				{/if}
				<button type="submit" class={primary}>Add plan</button>
			</form>
		</section>

		{#key current.id}
			<Checklist
				{items}
				{plan}
				{cue}
				onTick={tick}
				onHide={hide}
				onAdd={addItem}
				onDelete={deleteItem}
			/>
		{/key}
	{/if}

	<details class="{card} text-sm">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold">How this works</summary
		>
		<div class="mt-2 flex flex-col gap-2 text-gray-700 dark:text-gray-300">
			<p>
				Changing the situation is easier than resisting in it: a cue you never see can't set off the
				urge, and a few seconds of friction is often enough to let it pass.
			</p>
			<p>
				Plans in "if-then" form help too. Studies of these implementation intentions found people
				followed through noticeably more often when they decided in advance exactly what they would
				do and when.
			</p>
		</div>
	</details>
</main>
