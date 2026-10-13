<script lang="ts">
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { markBusy } from '$lib/busy';
	import { isTimed, type SosSession } from '$lib/self-control/sos';
	import { settingsStatus } from '$lib/settings.svelte';
	import { entries, read, write } from '$lib/storage';
	import { beep, keepAwake } from '$lib/utils/alarm';

	/**
	 * Urge SOS's timer (surfing, or a sprint's delay) when you've left its page (#149): it rings
	 * when it runs out and says so here, discreetly, since Self-Control is private. The page saves
	 * its session as it changes; this reads it on every other page and, when the time is up, moves
	 * it on to "Did you ride it out?" so the page opens there without ringing again.
	 */
	const SOS = '/utils/self-control/sos';
	const here = $derived(page.route.id === SOS);

	let session = $state<SosSession | undefined>();
	/** The timer ran out while you were away; cleared by Open or Dismiss. */
	let ended = $state(false);
	const timed = $derived(!here && isTimed(session?.step));

	// Read on arrival at each page (and once saved data has loaded).
	$effect(() => {
		if (!settingsStatus.ready) return;
		void page.url.pathname;
		if (here) {
			session = undefined;
			ended = false;
		} else session = read(entries.selfControlSos);
	});

	markBusy('self-control-sos-away', () => timed);
	// Keeps the screen on while it counts, as the page does, so it can ring.
	const awake = browser ? keepAwake(() => timed) : undefined;
	$effect(() => {
		void timed;
		void awake?.sync();
	});
	onMount(() => () => awake?.destroy());

	// Counts against the saved end time, like the page.
	$effect(() => {
		if (!timed) return;
		/** Seen counting, so ringing now is news (not a relaunch long after the end). */
		let counting = false;
		const tick = () => {
			const latest = read(entries.selfControlSos);
			if (!latest || !isTimed(latest.step)) {
				session = latest;
				return;
			}
			if (Date.now() < latest.endsAt) {
				counting = true;
				return;
			}
			if (counting) beep(3);
			session = { ...latest, step: 'outcome' };
			write(entries.selfControlSos, session);
			ended = true;
		};
		tick();
		const interval = setInterval(tick, 500);
		return () => clearInterval(interval);
	});

	const action = 'min-h-11 rounded-xl px-3 font-semibold';
</script>

{#if ended && !here}
	<div
		role="alert"
		data-testid="sos-alert"
		class="flex w-full max-w-md items-center gap-2 rounded-2xl bg-amber-300 py-1 pr-1 pl-4 text-sm text-gray-900 shadow-lg dark:bg-amber-700 dark:text-white"
	>
		<p class="min-w-0 flex-1 truncate">⏲️ Your timer is done</p>
		<button
			type="button"
			class="{action} bg-white/50 hover:not-disabled:bg-white/60 active:bg-white/60"
			onclick={() => (ended = false)}>Dismiss</button
		>
		<a
			href={resolve(SOS)}
			class="{action} flex items-center underline"
			aria-label="Open timer"
			onclick={() => (ended = false)}>Open</a
		>
	</div>
{/if}
