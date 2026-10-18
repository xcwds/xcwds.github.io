<script lang="ts">
	import { browser } from '$app/env';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { markBusy } from '#lib/busy.js';
	import { persist, saveResult } from '#lib/persist.svelte.js';
	import {
		activeHabits,
		habitById,
		NAME_MAX,
		randomId,
		type Habit
	} from '#lib/self-control/habits.js';
	import {
		ANSWER_MAX,
		DEFAULT_SURF_MINUTES,
		NOTE_MAX,
		SESSION_TECHNIQUES,
		SURF_MINUTES,
		TECHNIQUE_LABELS,
		appendEntry,
		finish,
		rate,
		startSession,
		surfPrompt,
		techniquePrompts,
		isTimed,
		startDelay,
		DELAY_MINUTES,
		SPRINT_ACTIONS,
		type Outcome,
		type SessionTechnique,
		type SosSession
	} from '#lib/self-control/sos.js';
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { entries, read, update } from '#lib/storage.js';
	import { toast } from '#lib/toast.svelte.js';
	import { beep, keepAwake, primeAudio } from '#lib/utils/alarm.js';
	import { formatDuration } from '#lib/utils/time.js';
	import { button, card, field, primary } from '../styles';
	import PlanCard from './PlanCard.svelte';
	import SeesawCard from './SeesawCard.svelte';
	import WhyCard from './WhyCard.svelte';
	import { toggle } from '../../weightlifting/styles';

	let habits = $state<Habit[]>([]);
	let session = $state<SosSession | undefined>();
	/** What you just saved, for the closing screen, and its log entry. */
	let done = $state<Outcome | undefined>();
	let doneId = $state<string | undefined>();
	let now = $state(Date.now());

	// The check-in.
	let habit = $state<string | undefined>();
	let intensity = $state(5);
	let minutes = $state(DEFAULT_SURF_MINUTES);
	let technique = $state<SessionTechnique>('surf');

	// Your name for self-talk (asked once, optional, kept in `app:self-control:prefs`).
	let name = $state<string | undefined>();
	let nameDraft = $state('');
	let nameError = $state<string | undefined>();
	let editingName = $state(false);

	// While surfing: "Rate it now".
	let rating = $state<number | undefined>();
	// When it's over.
	let gaveIn = $state(false);
	let note = $state('');

	/** Surfing or waiting out a sprint's delay: a timer is counting. */
	const timed = $derived(isTimed(session?.step));
	const kind = $derived(session?.habit ? habitById(habits, session.habit)?.kind : undefined);
	const remaining = $derived(session ? session.endsAt - now : 0);
	const writing = $derived(
		session && session.technique !== 'surf' && session.technique !== 'sprint'
			? techniquePrompts(session.technique, { name, kind })
			: undefined
	);

	// Per window: another tab's session is its own.
	persist(
		entries.selfControlSos,
		() => session,
		(value) => (session = value),
		{ sync: false, cleared: () => (session = undefined) }
	);

	$effect(() => {
		if (!settingsStatus.ready) return;
		habits = read(entries.selfControlHabits) ?? [];
		name = read(entries.selfControlPrefs)?.name;
	});

	markBusy('self-control-sos', () => timed);
	const awake = browser ? keepAwake(() => timed) : undefined;
	$effect(() => {
		void timed;
		void awake?.sync();
	});

	// Counts against the saved end time, so it stays right when the phone backgrounds the tab.
	$effect(() => {
		if (!timed) return;
		const tick = () => {
			now = Date.now();
			if (session && isTimed(session.step) && now >= session.endsAt) {
				beep(3);
				session = { ...session, step: 'outcome' };
			}
		};
		tick();
		const interval = setInterval(tick, 500);
		return () => clearInterval(interval);
	});

	onMount(() => () => awake?.destroy());

	function start() {
		primeAudio();
		done = undefined;
		rating = undefined;
		gaveIn = false;
		note = '';
		editingName = false;
		nameError = undefined;
		now = Date.now();
		session = startSession({ habit, intensity, technique, minutes }, now);
	}

	function saveRating() {
		if (session && rating !== undefined) session = rate(session, rating);
		rating = undefined;
	}

	function answer(i: number, text: string) {
		if (!session) return;
		const answers = [...(session.answers ?? [])];
		answers[i] = text;
		session = { ...session, answers: Array.from(answers, (a) => a ?? '') };
	}

	function saveName() {
		const trimmed = nameDraft.trim();
		nameError = !trimmed
			? 'Type your name first.'
			: [...trimmed].length > NAME_MAX
				? `Keep it to ${NAME_MAX} characters.`
				: undefined;
		if (nameError) return;
		const result = update(entries.selfControlPrefs, undefined, (latest) => ({
			...latest,
			name: trimmed
		}));
		if (!saveResult(entries.selfControlPrefs, result.saved, { explicit: true })) return;
		name = trimmed;
		editingName = false;
		toast('Name saved.');
	}

	function forgetName() {
		const result = update(entries.selfControlPrefs, undefined, (latest) => {
			const next = { ...latest };
			delete next.name;
			return next;
		});
		if (!saveResult(entries.selfControlPrefs, result.saved, { explicit: true })) return;
		name = undefined;
		nameDraft = '';
		editingName = false;
		toast('Name forgotten.');
	}

	function pickAction(action: string) {
		primeAudio();
		now = Date.now();
		if (session) session = startDelay(session, action, now);
	}

	function passed() {
		if (session) session = { ...session, step: 'outcome' };
	}

	function save(outcome: Outcome) {
		if (!session) return;
		const saved = read(entries.selfControlHabits) ?? [];
		const entry = finish(
			session,
			outcome,
			randomId(),
			outcome === 'gave-in' ? note : undefined,
			(id) => habitById(saved, id) !== undefined
		);
		const result = update(entries.selfControlLog, undefined, (latest) =>
			appendEntry(latest ?? [], entry)
		);
		if (!saveResult(entries.selfControlLog, result.saved, { explicit: true })) return;
		session = undefined;
		done = outcome;
		doneId = entry.id;
		toast('Saved to your log.');
	}
</script>

<svelte:head>
	<title>Urge SOS</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	{#if session?.step === 'surf'}
		<section aria-labelledby="surf-heading" class="flex flex-col gap-4" data-testid="surf">
			<h2 id="surf-heading" class="text-lg font-semibold">Surf it</h2>
			<div class="wave {card} flex flex-col items-center gap-2 overflow-hidden" aria-hidden="true">
				<svg viewBox="0 0 200 40" class="h-16 w-full text-blue-500">
					<path
						class="wave-path"
						fill="currentColor"
						d="M0 25 Q25 5 50 25 T100 25 T150 25 T200 25 T250 25 T300 25 V40 H0 Z"
					/>
				</svg>
			</div>
			<p class="text-center font-mono text-4xl tabular-nums" role="timer" data-testid="surf-time">
				{formatDuration(remaining)}
			</p>
			<p class="text-center" aria-live="polite" data-testid="surf-prompt">
				{surfPrompt(now - session.startedAt)}
			</p>
			{#if rating === undefined}
				<button type="button" class={button} onclick={() => (rating = session?.last ?? 5)}
					>Rate it now</button
				>
			{:else}
				<div class="{card} flex flex-col gap-3">
					<label class="flex flex-col gap-2">
						<span>How strong is it now? <strong>{rating}</strong> / 10</span>
						<input type="range" min="0" max="10" step="1" bind:value={rating} class="min-h-11" />
					</label>
					<button type="button" class={primary} onclick={saveRating}>Save rating</button>
				</div>
			{/if}
			<button type="button" class={primary} onclick={passed}>It passed</button>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Urges rise, peak and fade, often within minutes. Watching one without acting on it, like a
				wave you ride instead of fight, is called urge surfing.
			</p>
		</section>
	{:else if session?.step === 'prompts' && writing}
		<section aria-labelledby="prompts-heading" class="flex flex-col gap-4" data-testid="prompts">
			<h2 id="prompts-heading" class="text-lg font-semibold">
				{TECHNIQUE_LABELS[session.technique]}
			</h2>
			<p>{writing.intro}</p>
			{#if session.technique === 'friend' && name !== undefined && !editingName}
				<p class="flex flex-wrap items-center gap-2 text-sm" data-testid="your-name">
					Using your name, {name}.
					<button
						type="button"
						class="{button} text-sm"
						onclick={() => {
							nameDraft = name ?? '';
							nameError = undefined;
							editingName = true;
						}}>Change</button
					>
				</p>
			{:else if session.technique === 'friend'}
				<div class="{card} flex flex-col gap-2" data-testid="your-name">
					<label class="flex flex-col gap-1">
						<span>Your name, for these prompts (optional, saved on this device)</span>
						<input
							type="text"
							class={field}
							bind:value={nameDraft}
							aria-invalid={nameError ? true : undefined}
							aria-describedby={nameError ? 'name-error' : undefined}
						/>
					</label>
					{#if nameError}
						<p id="name-error" role="alert" class="text-sm text-red-700 dark:text-red-400">
							{nameError}
						</p>
					{/if}
					<div class="grid {name === undefined ? 'grid-cols-1' : 'grid-cols-2'} gap-2">
						<button type="button" class={button} onclick={saveName}>Use my name</button>
						{#if name !== undefined}
							<button type="button" class={button} onclick={forgetName}>Forget my name</button>
						{/if}
					</div>
				</div>
			{/if}
			{#each writing.prompts as prompt, i (i)}
				<label class="flex flex-col gap-1">
					<span>{prompt}{writing.optional ? ' (optional)' : ''}</span>
					<textarea
						rows="3"
						class={field}
						maxlength={ANSWER_MAX}
						value={session.answers?.[i] ?? ''}
						oninput={(e) => answer(i, e.currentTarget.value)}></textarea>
				</label>
			{/each}
			<p class="text-sm text-gray-600 dark:text-gray-400">
				What you write here stays on this page until you finish; it isn't saved to your log.
			</p>
			<button type="button" class={primary} onclick={passed}>Done</button>
		</section>
	{:else if session?.step === 'sprint'}
		<section aria-labelledby="sprint-heading" class="flex flex-col gap-4" data-testid="sprint">
			<h2 id="sprint-heading" class="text-lg font-semibold">Sprint</h2>
			<p>Do one of these in the next 20 seconds. Moving breaks the pull of the cue.</p>
			<div class="grid gap-2">
				{#each SPRINT_ACTIONS as action (action)}
					<button type="button" class={button} onclick={() => pickAction(action)}>{action}</button>
				{/each}
			</div>
		</section>
	{:else if session?.step === 'delay'}
		<section aria-labelledby="delay-heading" class="flex flex-col gap-4" data-testid="delay">
			<h2 id="delay-heading" class="text-lg font-semibold">Now wait it out</h2>
			<p>
				{session.action ? `${session.action}: done.` : ''} If you still want it in {DELAY_MINUTES} minutes,
				decide then.
			</p>
			<p class="text-center font-mono text-4xl tabular-nums" role="timer" data-testid="delay-time">
				{formatDuration(remaining)}
			</p>
			<button type="button" class={primary} onclick={passed}>Decide now</button>
		</section>
	{:else if session?.step === 'outcome'}
		<section aria-labelledby="outcome-heading" class="flex flex-col gap-4" data-testid="outcome">
			<h2 id="outcome-heading" class="text-lg font-semibold">Did you ride it out?</h2>
			<label class="{card} flex flex-col gap-2">
				<span>How strong is it now? <strong>{session.last}</strong> / 10</span>
				<input
					type="range"
					min="0"
					max="10"
					step="1"
					value={session.last}
					oninput={(e) =>
						session && (session = { ...session, last: e.currentTarget.valueAsNumber })}
					class="min-h-11"
				/>
			</label>
			{#if !gaveIn}
				<div class="grid grid-cols-3 gap-2">
					<button type="button" class={primary} onclick={() => save('rode-out')}>Yes</button>
					<button type="button" class={button} onclick={() => save('partly')}>Partly</button>
					<button type="button" class={button} onclick={() => (gaveIn = true)}
						>{kind === 'start' ? 'Skipped it' : 'Gave in'}</button
					>
				</div>
			{:else}
				<div class="{card} flex flex-col gap-3" data-testid="gave-in">
					<p>
						That's okay. One slip is one moment, not a verdict; noticing it is part of how this gets
						easier.
					</p>
					<label class="flex flex-col gap-1">
						<span>What might help next time? (optional)</span>
						<input type="text" class={field} maxlength={NOTE_MAX} bind:value={note} />
					</label>
					<div class="grid grid-cols-2 gap-2">
						<button type="button" class={button} onclick={() => (gaveIn = false)}>Back</button>
						<button type="button" class={primary} onclick={() => save('gave-in')}>Save</button>
					</div>
				</div>
			{/if}
		</section>
	{:else if done}
		<section class="{card} flex flex-col gap-3" data-testid="sos-done">
			<p>
				{#if done === 'rode-out'}
					You rode it out. Nice work.
				{:else if done === 'partly'}
					You held some of it off. That counts.
				{:else}
					Saved. Next time is a fresh start.
				{/if}
			</p>
			{#if doneId}
				<a
					href="{resolve('/utils/self-control/cues' as '/')}#edit={encodeURIComponent(doneId)}"
					class="{button} text-center">Add what set it off</a
				>
			{/if}
			<a href={resolve('/utils/self-control')} class="{button} text-center">Done</a>
		</section>
	{:else}
		<section aria-labelledby="check-in-heading" class="flex flex-col gap-4" data-testid="check-in">
			<h2 id="check-in-heading" class="text-lg font-semibold">Check in</h2>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2">What's the urge about?</legend>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class={toggle(habit === undefined)}
						aria-pressed={habit === undefined}
						onclick={() => (habit = undefined)}>Just a craving</button
					>
					{#each activeHabits(habits) as h (h.id)}
						<button
							type="button"
							class={toggle(habit === h.id)}
							aria-pressed={habit === h.id}
							onclick={() => (habit = h.id)}>{h.emoji} {h.name}</button
						>
					{/each}
				</div>
			</fieldset>
			<label class="flex flex-col gap-2">
				<span>How strong is it? <strong>{intensity}</strong> / 10</span>
				<input type="range" min="0" max="10" step="1" bind:value={intensity} class="min-h-11" />
			</label>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2">Pick a technique</legend>
				<div class="grid grid-cols-2 gap-2">
					{#each SESSION_TECHNIQUES as t (t)}
						<button
							type="button"
							class={toggle(technique === t)}
							aria-pressed={technique === t}
							onclick={() => (technique = t)}>{TECHNIQUE_LABELS[t]}</button
						>
					{/each}
				</div>
			</fieldset>
			{#if technique === 'surf'}
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-2">Surf it for</legend>
					<div class="grid grid-cols-4 gap-2">
						{#each SURF_MINUTES as m (m)}
							<button
								type="button"
								class={toggle(minutes === m)}
								aria-pressed={minutes === m}
								onclick={() => (minutes = m)}>{m} min</button
							>
						{/each}
					</div>
				</fieldset>
			{/if}
			<button type="button" class={primary} onclick={start}
				>{technique === 'surf' ? 'Start surfing' : 'Start'}</button
			>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				{technique === 'surf'
					? "You'll watch the urge rise and fall instead of acting on it, then note how it went."
					: technique === 'sprint'
						? `You'll do one quick action, then wait ${DELAY_MINUTES} minutes before deciding.`
						: "You'll answer a few short prompts, then note how it went."}
			</p>
		</section>
	{/if}
	{#if session && session.step !== 'outcome'}
		<PlanCard habit={session.habit} />
		<WhyCard habit={session.habit} />
		<SeesawCard habit={session.habit} />
	{/if}
</main>

<style>
	.wave-path {
		animation: wave 6s ease-in-out infinite;
	}
	@keyframes wave {
		0%,
		100% {
			transform: translate(0, 4px);
		}
		50% {
			transform: translate(-100px, -6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wave-path {
			animation: none;
		}
	}
</style>
