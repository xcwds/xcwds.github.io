<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { markBusy } from '$lib/busy';
	import { persist, saveResult } from '$lib/persist.svelte';
	import { activeHabits, habitById, randomId, type Habit } from '$lib/self-control/habits';
	import {
		DEFAULT_SURF_MINUTES,
		NOTE_MAX,
		SURF_MINUTES,
		appendEntry,
		finish,
		rate,
		startSurf,
		surfPrompt,
		type Outcome,
		type SosSession
	} from '$lib/self-control/sos';
	import { settingsStatus } from '$lib/settings.svelte';
	import { entries, read, update } from '$lib/storage';
	import { toast } from '$lib/toast.svelte';
	import { beep, keepAwake, primeAudio } from '$lib/utils/alarm';
	import { formatDuration } from '$lib/utils/time';
	import { button, card, field, primary } from '../styles';
	import { toggle } from '../../weightlifting/styles';

	let habits = $state<Habit[]>([]);
	let session = $state<SosSession | undefined>();
	/** What you just saved, for the closing screen. */
	let done = $state<Outcome | undefined>();
	let now = $state(Date.now());

	// The check-in.
	let habit = $state<string | undefined>();
	let intensity = $state(5);
	let minutes = $state(DEFAULT_SURF_MINUTES);

	// While surfing: "Rate it now".
	let rating = $state<number | undefined>();
	// When it's over.
	let gaveIn = $state(false);
	let note = $state('');

	const surfing = $derived(session?.step === 'surf');
	const kind = $derived(session?.habit ? habitById(habits, session.habit)?.kind : undefined);
	const remaining = $derived(session ? session.endsAt - now : 0);

	// Per window: another tab's session is its own.
	persist(
		entries.selfControlSos,
		() => session,
		(value) => (session = value),
		{ sync: false, cleared: () => (session = undefined) }
	);

	$effect(() => {
		if (settingsStatus.ready) habits = read(entries.selfControlHabits) ?? [];
	});

	markBusy('self-control-sos', () => surfing);
	const awake = browser ? keepAwake(() => surfing) : undefined;
	$effect(() => {
		void surfing;
		void awake?.sync();
	});

	// Counts against the saved end time, so it stays right when the phone backgrounds the tab.
	$effect(() => {
		if (!surfing) return;
		const tick = () => {
			now = Date.now();
			if (session?.step === 'surf' && now >= session.endsAt) {
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
		now = Date.now();
		session = startSurf({ habit, intensity, minutes }, now);
	}

	function saveRating() {
		if (session && rating !== undefined) session = rate(session, rating);
		rating = undefined;
	}

	function passed() {
		if (session) session = { ...session, step: 'outcome' };
	}

	function save(outcome: Outcome) {
		if (!session) return;
		const entry = finish(session, outcome, randomId(), outcome === 'gave-in' ? note : undefined);
		const result = update(entries.selfControlLog, undefined, (latest) =>
			appendEntry(latest ?? [], entry)
		);
		if (!saveResult(entries.selfControlLog, result.saved, { explicit: true })) return;
		session = undefined;
		done = outcome;
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
					oninput={(e) => session && (session = rate(session, e.currentTarget.valueAsNumber))}
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
			<button type="button" class={primary} onclick={start}>Start surfing</button>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				You'll watch the urge rise and fall instead of acting on it, then note how it went.
			</p>
		</section>
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
