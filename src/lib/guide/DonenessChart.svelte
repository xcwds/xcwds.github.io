<script lang="ts">
	import { settings } from '$lib/settings.svelte';
	import TempUnitToggle from '$lib/TempUnitToggle.svelte';
	import { toast } from '$lib/toast.svelte';
	import { MINUTE, useCookingTimers } from '$lib/utils/cooking-timers.svelte';
	import { doneness, formatInternal, MEATS } from './doneness';

	const timers = useCookingTimers();

	let meatId = $state(MEATS[0].id);
	let meat = $derived(MEATS.find((m) => m.id === meatId)!);
	// Size and doneness reset to the first choice that fits whenever the meat changes.
	let sizeId = $derived(meat.sizes[0].id);
	let levelId = $derived(
		(meat.levels.find((l) => l.targetF >= meat.usdaF && !l.tender) ?? meat.levels[0]).id
	);
	let size = $derived(meat.sizes.find((s) => s.id === sizeId) ?? meat.sizes[0]);
	let level = $derived(meat.levels.find((l) => l.id === levelId) ?? meat.levels[0]);
	let result = $derived(doneness(meat, size, level));
	let temp = (f: number) => formatInternal(f, settings.ovenUnit);

	function startRest() {
		const label = `${meat.name} resting`;
		timers.add(result.restMinutes * MINUTE, label);
		toast(`Started a ${result.restMinutes} min timer: ${label}.`);
	}

	const choice = (selected: boolean) =>
		`min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium ${
			selected
				? 'bg-blue-600 text-white'
				: 'bg-white/70 hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700'
		}`;
</script>

<div
	class="flex flex-col gap-4 rounded-xl bg-white/40 p-4 dark:bg-gray-900/60"
	data-testid="doneness"
>
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Meat">
		{#each MEATS as m (m.id)}
			<button
				type="button"
				role="radio"
				aria-checked={m.id === meatId}
				class={choice(m.id === meatId)}
				onclick={() => (meatId = m.id)}
			>
				<span aria-hidden="true">{m.emoji}</span>
				{m.name}
			</button>
		{/each}
	</div>

	{#if meat.sizes.length > 1}
		<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Size">
			{#each meat.sizes as s (s.id)}
				<button
					type="button"
					role="radio"
					aria-checked={s.id === size.id}
					class={choice(s.id === size.id)}
					onclick={() => (sizeId = s.id)}
				>
					{s.name}
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex flex-col gap-2" role="radiogroup" aria-label="Doneness">
		{#each meat.levels as l (l.id)}
			<button
				type="button"
				role="radio"
				aria-checked={l.id === level.id}
				class="{choice(l.id === level.id)} flex items-center justify-between gap-3"
				onclick={() => (levelId = l.id)}
			>
				<span>{l.name}</span>
				<span class="tabular-nums">{temp(l.targetF)}</span>
			</button>
		{/each}
	</div>

	<div class="flex flex-col gap-2" aria-live="polite" data-testid="doneness-result">
		<dl class="grid grid-cols-2 gap-2">
			<div class="rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-800">
				<dt class="text-xs text-gray-600 dark:text-gray-400">Take it off the heat at</dt>
				<dd class="text-2xl font-semibold tabular-nums" data-testid="doneness-pull">
					{temp(result.pullF)}
				</dd>
			</div>
			<div class="rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-800">
				<dt class="text-xs text-gray-600 dark:text-gray-400">Done at</dt>
				<dd class="text-2xl font-semibold tabular-nums" data-testid="doneness-target">
					{temp(result.targetF)}
				</dd>
			</div>
		</dl>
		<p class="text-sm">
			{level.looks}.
			{#if result.pullF < result.targetF}
				It keeps rising about {settings.ovenUnit === 'F'
					? `${result.targetF - result.pullF}°F`
					: `${Math.round(((result.targetF - result.pullF) * 5) / 9)}°C`} while it rests.
			{/if}
			{#if result.restMinutes}
				Rest {result.restMinutes} minutes before cutting.
			{/if}
		</p>
		{#if result.belowUsda}
			<p
				class="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100"
				data-testid="doneness-below-usda"
			>
				<span aria-hidden="true">⚠️</span>
				Below the USDA safe minimum: {meat.usdaNote} Many people eat it this way; it carries more risk,
				especially for anyone pregnant, young, older or with a weakened immune system.
			</p>
		{:else}
			<p class="text-sm text-gray-600 dark:text-gray-400">USDA safe minimum: {meat.usdaNote}</p>
		{/if}
		{#if result.restMinutes}
			<button
				type="button"
				class="flex min-h-11 items-center gap-2 self-start rounded-full bg-white/70 px-4 text-sm font-medium hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
				onclick={startRest}
			>
				<span aria-hidden="true">⏲️</span>
				Start {result.restMinutes} min rest timer
			</button>
		{/if}
	</div>

	<TempUnitToggle />
</div>
