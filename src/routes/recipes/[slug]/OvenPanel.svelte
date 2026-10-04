<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { RecipeOven } from '$lib/recipes';
	import OvenWarnings from '$lib/OvenWarnings.svelte';
	import TempInput from '$lib/TempInput.svelte';
	import TempUnitToggle from '$lib/TempUnitToggle.svelte';
	import { settings } from '$lib/settings.svelte';
	import {
		adjustOvenTime,
		asRange,
		foodPreset,
		formatMinutesRange,
		formatTemp,
		ovenProblem,
		ovenWarnings
	} from '$lib/utils/oven';

	/**
	 * `activeF` reports the oven temperature to use for the recipe's oven step timers: the one
	 * the user entered here, while the panel is open and gives an estimate; otherwise undefined.
	 * The pre-filled suggestion doesn't count until it's edited.
	 */
	// `timeScale`: the bake time multiplier for another pan (1 for the recipe's own).
	let {
		oven,
		timeScale = 1,
		activeF = $bindable()
	}: { oven: RecipeOven; timeScale?: number; activeF?: number | undefined } = $props();

	let open = $state(false);
	let edited = $state(false);

	// °F, shown in the oven converter's unit. Starts 25°F under the recipe: the common case is an
	// oven that's already busy with something cooler, or a dish that's browning too fast. The
	// page re-creates this panel per recipe, so the starting value is read once.
	let yourF = $state(untrack(() => oven.temp) - 25);

	let unit = $derived(settings.ovenUnit);
	let range = $derived(asRange(oven.minutes).map((m) => m * timeScale) as [number, number]);
	let input = $derived((minutes: number) => ({
		fromF: oven.temp,
		toF: yourF,
		minutes,
		...foodPreset(oven.food)
	}));
	let problem = $derived(ovenProblem(input(range[0])));
	let warnings = $derived(ovenWarnings(input(range[0]), unit));
	let adjusted = $derived(
		problem
			? undefined
			: ([adjustOvenTime(input(range[0]))!, adjustOvenTime(input(range[1]))!] as const)
	);
	$effect(() => {
		activeF = open && edited && !problem && yourF !== oven.temp ? yourF : undefined;
	});
</script>

<details class="rounded-lg bg-white/70 dark:bg-gray-900" data-testid="oven-panel" bind:open>
	<summary class="cursor-pointer px-4 py-3 font-medium">Cooking at a different temperature?</summary
	>
	<div class="flex flex-col gap-3 px-4 pb-4">
		<p class="text-sm">
			{timeScale === 1 ? 'The recipe says' : 'For your pan, about'}
			{formatTemp(oven.temp, unit)} for {formatMinutesRange(range)}.
		</p>
		<TempUnitToggle />
		<div class="grid grid-cols-2 items-end gap-3">
			<TempInput label="Your oven" bind:valueF={yourF} {unit} onedit={() => (edited = true)} />
			<p aria-live="polite" class="pb-2 text-lg font-semibold" data-testid="oven-panel-time">
				{#if adjusted}
					about {formatMinutesRange(adjusted)}
				{/if}
			</p>
		</div>
		{#if problem}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{problem}</p>
		{/if}
		<OvenWarnings {warnings} />
		<p class="text-sm text-gray-600 dark:text-gray-400">
			An estimate: start checking early and go by the doneness cues in the steps. Once you enter
			your temperature, the steps' oven timers use it while this panel is open. More options in the
			<a class="underline" href={resolve('/utils/oven-time')}>Oven Time Converter</a>.
		</p>
	</div>
</details>
