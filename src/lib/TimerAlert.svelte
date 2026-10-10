<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useCoffeeTimer } from '$lib/utils/coffee-timer.svelte';

	/**
	 * A finished coffee timer, on pages other than its own (the alarm rings everywhere). Cooking
	 * timers have `@xcwds/plugin-timers`' alert.
	 */
	const coffee = useCoffeeTimer();
	let coffeeDone = $derived(coffee.over && page.route.id !== '/utils/coffee-timer');

	const action = 'min-h-11 rounded-xl px-3 font-semibold';
</script>

{#if coffeeDone}
	<div
		role="alert"
		data-testid="timer-alert"
		class="flex w-full max-w-md items-center gap-2 rounded-2xl bg-amber-300 py-1 pr-1 pl-4 text-sm text-gray-900 shadow-lg dark:bg-amber-700 dark:text-white"
	>
		<p class="min-w-0 flex-1 truncate">☕ Coffee timer is done</p>
		<button type="button" class="{action} bg-white/50" onclick={() => coffee.reset()}>Stop</button>
		<a
			href={resolve('/utils/coffee-timer')}
			class="{action} flex items-center underline"
			aria-label="Open Coffee Timer">Open</a
		>
	</div>
{/if}
