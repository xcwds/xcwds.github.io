<script lang="ts">
	import { resolve } from '$app/paths';
	import { hasUnsavedChanges, persist, saveResult } from '$lib/persist.svelte';
	import { riskiest } from '$lib/self-control/cues';
	import { planFor, type Environment, type Plan } from '$lib/self-control/environment';
	import { activeHabits, type Habit } from '$lib/self-control/habits';
	import {
		REFLECTION_MAX,
		byTechnique,
		encouragement,
		habitForCue,
		hardWeek,
		rodeOutShare,
		summarize,
		weeks,
		withReflection,
		type Reflections,
		type Summary
	} from '$lib/self-control/review';
	import { TECHNIQUE_LABELS, type UrgeEntry } from '$lib/self-control/sos';
	import { settings, settingsStatus } from '$lib/settings.svelte';
	import { entries, read, update } from '$lib/storage';
	import { toast } from '$lib/toast.svelte';
	import { weekStartDay } from '$lib/week';
	import { button, card, field, primary } from '../styles';
	import { toggle } from '../../weightlifting/styles';

	/** Weeks the chart shows. */
	const WEEKS = 12;

	let habits = $state<Habit[]>([]);
	let log = $state<UrgeEntry[]>([]);
	let env = $state<Environment | undefined>();
	let reflections = $state<Reflections | undefined>();
	/** The habit the review is about; undefined is every urge. */
	let filter = $state<string | undefined>();
	let now = $state(Date.now());

	let well = $state('');
	let changeNext = $state('');
	let reflectionError = $state<string | undefined>();

	const active = $derived(activeHabits(habits));
	const first = $derived(weekStartDay(settings.weekStart));
	const shown = $derived(log.filter((e) => filter === undefined || e.habit === filter));
	const recent = $derived(weeks(shown, first, now, WEEKS));
	const thisWeek = $derived(recent.at(-1)!);
	const lastWeek = $derived(recent.at(-2)!);
	const current = $derived(summarize(thisWeek.log));
	const previous = $derived(summarize(lastWeek.log));
	const techniques = $derived(byTechnique(shown));
	const risky = $derived(riskiest(thisWeek.log));
	const saved = $derived(reflections?.[thisWeek.key]);
	const lastChange = $derived(reflections?.[lastWeek.key]?.change);
	const unsavedReflection = $derived(
		well.trim() !== (saved?.well ?? '') || changeNext.trim() !== (saved?.change ?? '')
	);

	// Another tab's reflections load as they happen.
	const savedReflections = persist(
		entries.selfControlReview,
		() => reflections,
		(value) => (reflections = value),
		{ cleared: () => (reflections = undefined) }
	);

	$effect(() => {
		if (!settingsStatus.ready) return;
		habits = read(entries.selfControlHabits) ?? [];
		log = read(entries.selfControlLog) ?? [];
		env = read(entries.selfControlPlan);
		now = Date.now();
	});

	// The boxes follow this week's saved reflection.
	$effect(() => {
		well = saved?.well ?? '';
		changeNext = saved?.change ?? '';
		reflectionError = undefined;
	});

	// A filter for a habit deleted or archived elsewhere falls back to every urge.
	$effect(() => {
		if (filter !== undefined && !active.some((h) => h.id === filter)) filter = undefined;
	});

	function saveReflection(event: SubmitEvent) {
		event.preventDefault();
		reflectionError =
			well.trim().length > REFLECTION_MAX || changeNext.trim().length > REFLECTION_MAX
				? `Keep each answer to ${REFLECTION_MAX} characters.`
				: undefined;
		if (reflectionError) return;
		const key = thisWeek.key;
		const answers = { well, change: changeNext };
		const result = update(
			entries.selfControlReview,
			$state.snapshot(reflections),
			(latest) => withReflection(latest, key, answers),
			{ unsaved: hasUnsavedChanges(entries.selfControlReview) }
		);
		reflections = result.value;
		savedReflections.markSaved();
		if (saveResult(entries.selfControlReview, result.saved, { explicit: true }))
			toast('Reflection saved.');
	}

	/** An if-then plan (#152) for one of `cues`, from the habit shown or any habit. */
	function planForCues(cues: string[]): Plan | undefined {
		const ids = filter ? [filter] : active.map((h) => h.id);
		const wanted = cues.map((c) => c.toLowerCase());
		for (const id of ids) {
			const found = planFor(env, id).plans.find((p) => wanted.includes(p.cue.toLowerCase()));
			if (found) return found;
		}
		return undefined;
	}

	/**
	 * The habit to plan for `cue` in: the one shown, or else the habit most of this week's
	 * give-ins with that cue belong to.
	 */
	const habitFor = (cue: string): string | undefined => filter ?? habitForCue(thisWeek.log, cue);

	/** The fragment that opens the Environment Designer planning for `cue`. */
	const planHash = (cue: string) => {
		const habit = habitFor(cue);
		return String(new URLSearchParams(habit ? { habit, cue } : { cue }));
	};

	const outcomeLine = (s: Summary) =>
		s.urges ? `rode out ${s.rodeOut}, partly ${s.partly}, gave in ${s.gaveIn}` : 'none logged';
	const percent = (share: number | undefined) =>
		share === undefined ? 'no urges' : `${Math.round(share * 100)}% ridden out`;
	const shortDate = (at: number) =>
		new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

	// The chart: one bar per week, its height the share ridden out.
	const chart = $derived(
		recent.map((w, i) => {
			const share = rodeOutShare(summarize(w.log));
			return { ...w, i, share, height: share === undefined ? 0 : Math.max(2, share * 100) };
		})
	);
</script>

<svelte:head>
	<title>Weekly review</title>
</svelte:head>

<main class="page-wide flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<p class="text-sm text-gray-600 dark:text-gray-400">
		A calm look back at the urges you noticed, the ones you rode out, and what helped. Weeks start
		on {new Date(thisWeek.start).toLocaleDateString(undefined, { weekday: 'long' })}; change it in
		<a class="underline" href={resolve('/settings')}>Settings</a>.
	</p>

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

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		<section
			class="{card} flex flex-col gap-2 text-sm"
			aria-labelledby="week-heading"
			data-testid="this-week"
		>
			<h2 id="week-heading" class="text-lg font-semibold">This week</h2>
			<p class="text-base" data-testid="encouragement">{encouragement(current)}</p>
			<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
				<dt class="text-gray-600 dark:text-gray-400">This week</dt>
				<dd data-testid="this-week-outcomes">{outcomeLine(current)}</dd>
				<dt class="text-gray-600 dark:text-gray-400">Last week</dt>
				<dd data-testid="last-week-outcomes">{outcomeLine(previous)}</dd>
				{#if current.avgPeak !== undefined}
					<dt class="text-gray-600 dark:text-gray-400">Average peak</dt>
					<dd data-testid="avg-peak">
						{current.avgPeak} / 10{previous.avgPeak !== undefined
							? ` (last week ${previous.avgPeak})`
							: ''}
					</dd>
				{/if}
			</dl>
			{#if hardWeek(current)}
				<p class="rounded-xl bg-blue-50 p-3 dark:bg-blue-950" data-testid="hard-week">
					A tough week happens, and logging it honestly is part of the work. Changing what's around
					you can make next week easier:
					<a class="underline" href={resolve('/utils/self-control/environment' as '/')}
						>try the Environment Designer</a
					>.
				</p>
			{/if}
		</section>

		{#if filter === undefined && active.length}
			<section
				class="{card} flex flex-col gap-2 text-sm"
				aria-labelledby="habits-heading"
				data-testid="per-habit"
			>
				<h2 id="habits-heading" class="text-lg font-semibold">By habit</h2>
				<ul class="flex flex-col gap-2">
					{#each active as h (h.id)}
						{@const mine = summarize(thisWeek.log.filter((e) => e.habit === h.id))}
						{@const before = summarize(lastWeek.log.filter((e) => e.habit === h.id))}
						<li>
							<p class="font-semibold">{h.emoji} {h.name}</p>
							<p>
								This week: {mine.urges
									? `rode out ${mine.rodeOut} of ${mine.urges}`
									: 'none logged'}. Last week: {before.urges
									? `rode out ${before.rodeOut} of ${before.urges}`
									: 'none logged'}.
							</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section
			class="{card} flex flex-col gap-2 text-sm"
			aria-labelledby="helps-heading"
			data-testid="what-helps"
		>
			<h2 id="helps-heading" class="text-lg font-semibold">What helps you</h2>
			{#if techniques.length}
				<ul class="flex flex-col gap-1">
					{#each techniques as t (t.technique)}
						<li>
							<strong>{TECHNIQUE_LABELS[t.technique]}</strong>: rode out {t.rodeOut} of {t.urges}
						</li>
					{/each}
				</ul>
				<p class="text-gray-600 dark:text-gray-400">
					From every urge you've worked through in Urge SOS. Lead with what works for you.
				</p>
			{:else}
				<p>
					Work through an urge in
					<a class="underline" href={resolve('/utils/self-control/sos' as '/')}>Urge SOS</a> to see which
					techniques help you most.
				</p>
			{/if}
		</section>

		<section
			class="{card} flex flex-col gap-2 text-sm"
			aria-labelledby="risky-heading"
			data-testid="risky-week"
		>
			<h2 id="risky-heading" class="text-lg font-semibold">Riskiest moments this week</h2>
			{#if risky.length}
				<ul class="flex flex-col gap-3">
					{#each risky as combo (combo.cues.map((c) => `${c.field}:${c.cue}`).join('+'))}
						{@const cues = combo.cues.map((c) => c.cue)}
						{@const plan = planForCues(cues)}
						<li class="flex flex-col gap-1">
							<p><strong>{cues.join(' + ')}</strong>: gave in {combo.gaveIn} times</p>
							{#if plan}
								<p class="text-gray-600 dark:text-gray-400">
									Your plan: if {plan.cue}, then I will {plan.action}.
								</p>
							{:else}
								<a
									class="{button} self-start"
									href="{resolve('/utils/self-control/environment' as '/')}#{planHash(cues[0]!)}"
									>Make a plan</a
								>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p>
					Nothing stood out this week. Adding what was going on in the
					<a class="underline" href={resolve('/utils/self-control/cues' as '/')}>Cue Audit</a> helps spot
					patterns.
				</p>
			{/if}
		</section>

		<section
			class="{card} flex flex-col gap-2 text-sm md:col-span-2"
			aria-labelledby="time-heading"
			data-testid="over-time"
		>
			<h2 id="time-heading" class="text-lg font-semibold">Over time</h2>
			<p class="text-gray-600 dark:text-gray-400">Share of urges ridden out, week by week.</p>
			<svg viewBox="0 0 {WEEKS * 20} 120" class="h-40 w-full" aria-hidden="true">
				<line
					x1="0"
					y1="100"
					x2={WEEKS * 20}
					y2="100"
					class="stroke-gray-300 dark:stroke-gray-700"
				/>
				{#each chart as bar (bar.key)}
					{#if bar.share === undefined}
						<rect x={bar.i * 20 + 7} y="98" width="6" height="2" class="fill-gray-400" />
					{:else}
						<rect
							x={bar.i * 20 + 3}
							y={100 - bar.height}
							width="14"
							height={bar.height}
							rx="2"
							class={bar.i === WEEKS - 1 ? 'fill-blue-600' : 'fill-blue-400 dark:fill-blue-500'}
						/>
					{/if}
					{#if bar.i % 3 === 2 || bar.i === WEEKS - 1}
						<text x={bar.i * 20 + 10} y="115" text-anchor="middle" class="fill-current text-[8px]"
							>{shortDate(bar.start)}</text
						>
					{/if}
				{/each}
			</svg>
			<ul class="sr-only" data-testid="weeks-list">
				{#each [...chart].reverse() as bar (bar.key)}
					<li>Week of {shortDate(bar.start)}: {percent(bar.share)}</li>
				{/each}
			</ul>
		</section>

		<form
			class="{card} flex flex-col gap-3 text-sm"
			aria-labelledby="reflect-heading"
			onsubmit={saveReflection}
			data-testid="reflection"
		>
			<h2 id="reflect-heading" class="text-lg font-semibold">Reflect on this week</h2>
			{#if lastChange}
				<p class="text-gray-600 dark:text-gray-400" data-testid="last-change">
					Last week you planned: {lastChange}
				</p>
			{/if}
			<label class="flex flex-col gap-1">
				<span>What went well?</span>
				<textarea class="{field} min-h-20" bind:value={well} maxlength={REFLECTION_MAX * 2}
				></textarea>
			</label>
			<label class="flex flex-col gap-1">
				<span>What's one change for next week?</span>
				<textarea class="{field} min-h-20" bind:value={changeNext} maxlength={REFLECTION_MAX * 2}
				></textarea>
			</label>
			{#if reflectionError}
				<p role="alert" class="text-red-700 dark:text-red-400">{reflectionError}</p>
			{/if}
			<button type="submit" class={primary} disabled={!unsavedReflection}>Save reflection</button>
			<p class="text-gray-600 dark:text-gray-400">Optional, and it stays on this device.</p>
		</form>
	</div>
</main>
