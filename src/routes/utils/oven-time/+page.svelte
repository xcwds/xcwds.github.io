<script lang="ts">
	import { resolve } from '$app/paths';
	import OvenWarnings from '$lib/OvenWarnings.svelte';
	import TempInput from '$lib/TempInput.svelte';
	import TempUnitToggle from '$lib/TempUnitToggle.svelte';
	import { settings } from '$lib/settings.svelte';
	import {
		FOOD_PRESETS,
		adjustOvenTime,
		foodPreset,
		formatMinutes,
		fromF as inUnit,
		ovenProblem,
		ovenWarnings,
		type FoodId
	} from '$lib/utils/oven';

	// Temperatures are kept in °F; the fields show them in the chosen unit.
	let fromF = $state(350);
	let toF = $state(400);
	let minutes = $state(60);
	let food = $state<FoodId | 'custom'>('meat');
	let customStartF = $state(40);
	let customDoneF = $state(165);

	let unit = $derived(settings.ovenUnit);
	let preset = $derived(food === 'custom' ? undefined : foodPreset(food));
	let input = $derived({
		fromF,
		toF,
		minutes,
		startF: preset?.startF ?? customStartF,
		doneF: preset?.doneF ?? customDoneF
	});
	let problem = $derived(ovenProblem(input));
	let warnings = $derived(ovenWarnings(input, unit));
	let result = $derived(adjustOvenTime(input));
	const deg = (f: number) => `${Math.round(inUnit(f, unit))}°${unit}`;
	let change = $derived(result === undefined ? 0 : Math.round(result) - Math.round(minutes));
</script>

<svelte:head>
	<title>Oven Time Converter</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
	<section
		aria-label="Estimated time"
		aria-live="polite"
		class="rounded-lg bg-white/80 p-4 text-center dark:bg-gray-900"
		data-testid="oven-result"
	>
		{#if result !== undefined}
			<p class="text-sm text-gray-600 dark:text-gray-400">At your temperature, about</p>
			<p class="text-4xl font-semibold tabular-nums" data-testid="oven-time">
				{formatMinutes(result)}
			</p>
			<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="oven-change">
				{change === 0
					? 'Same as the recipe'
					: `${formatMinutes(Math.abs(change))} ${change < 0 ? 'less' : 'more'} than the recipe`}
			</p>
		{:else}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{problem}</p>
		{/if}
	</section>

	<OvenWarnings {warnings} />

	<form class="flex flex-col gap-4" onsubmit={(e) => e.preventDefault()}>
		<TempUnitToggle />

		<label class="flex flex-col gap-1 text-sm">
			<span>What's cooking</span>
			<select
				bind:value={food}
				class="rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
			>
				{#each FOOD_PRESETS as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
				<option value="custom">Custom</option>
			</select>
		</label>
		{#if food === 'custom'}
			<div class="grid grid-cols-2 gap-3">
				<TempInput label="Starts at" bind:valueF={customStartF} {unit} />
				<TempInput label="Done at" bind:valueF={customDoneF} {unit} />
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<TempInput label="Recipe oven" bind:valueF={fromF} {unit} />
			<label class="flex flex-col gap-1 text-sm">
				<span>Recipe time (min)</span>
				<input
					type="number"
					inputmode="numeric"
					min="1"
					bind:value={minutes}
					class="rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
				/>
			</label>
			<TempInput label="Your oven" bind:valueF={toF} {unit} />
		</div>
	</form>

	<div class="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
		<p>
			An estimate from how fast heat reaches the center of the food{preset
				? ` (from ${deg(preset.startF)} to ${deg(preset.doneF)} inside)`
				: ''}. Start checking early and go by doneness, ideally with a thermometer.
		</p>
		<p>
			Baked goods are fussier than roasts: much hotter can brown the outside before the middle sets,
			and much cooler can stop them rising. Stay within about 25°F (15°C) of the recipe when you
			can.
		</p>
		<p>
			Convection (fan) oven? Many recipes suggest setting it about 25°F (15°C) lower than the recipe
			says, then using the recipe time.
		</p>
		<p>
			Classic recipes with this built in are in <a class="underline" href={resolve('/recipes')}
				>Recipes</a
			>.
		</p>
	</div>
</main>
