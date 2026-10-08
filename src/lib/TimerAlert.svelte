<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useCoffeeTimer } from '$lib/utils/coffee-timer.svelte';
	import { MINUTE, useCookingTimers } from '$lib/utils/cooking-timers.svelte';

	/** Finished timers, shown on pages that don't already show them (the alarm rings everywhere). */
	const cooking = useCookingTimers();
	const coffee = useCoffeeTimer();

	// The Cooking Timer page and recipe pages (their timer tray) list every cooking timer.
	let showsCooking = $derived(
		page.route.id === '/utils/cooking-timer' || page.route.id === '/recipes/[slug]'
	);
	let ringing = $derived(showsCooking ? [] : cooking.items.filter((i) => cooking.ringing(i)));
	let coffeeDone = $derived(coffee.over && page.route.id !== '/utils/coffee-timer');

	const box =
		'pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl bg-amber-300 py-1 pr-1 pl-4 text-sm text-gray-900 shadow-lg dark:bg-amber-700 dark:text-white';
	const action = 'min-h-11 rounded-xl px-3 font-semibold';
</script>

{#each ringing as item (item.id)}
	<div role="alert" data-testid="timer-alert" class={box}>
		<p class="min-w-0 flex-1 truncate">⏲️ {item.label} is done</p>
		<button type="button" class="{action} bg-white/50" onclick={() => item.timer.add(MINUTE)}>
			+1 min
		</button>
		<button type="button" class="{action} bg-white/50" onclick={() => cooking.remove(item)}>
			Stop
		</button>
		<a
			href={resolve('/utils/cooking-timer')}
			class="{action} flex items-center underline"
			aria-label="Open Cooking Timer">Open</a
		>
	</div>
{/each}
{#if coffeeDone}
	<div role="alert" data-testid="timer-alert" class={box}>
		<p class="min-w-0 flex-1 truncate">☕ Coffee timer is done</p>
		<button type="button" class="{action} bg-white/50" onclick={() => coffee.reset()}>Stop</button>
		<a
			href={resolve('/utils/coffee-timer')}
			class="{action} flex items-center underline"
			aria-label="Open Coffee Timer">Open</a
		>
	</div>
{/if}
