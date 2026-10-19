<script lang="ts">
	import OvenWarnings from '#lib/OvenWarnings.svelte';
	import { saveSettings, settings, settingsStatus } from '#lib/settings.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import { toggle } from '../weightlifting/styles';
	import {
		DEFAULT_PACKAGE_WATTS,
		FOODS,
		POWER_LEVELS,
		WATTS,
		foodPackage,
		formatClock,
		microwaveProblem,
		microwaveTime,
		microwaveWarnings,
		parseWatts
	} from '#lib/utils/microwave.js';

	let minutes = $state<number | null>(3);
	let seconds = $state<number | null>(0);
	let packageWatts = $state<number | null>(DEFAULT_PACKAGE_WATTS);
	let yourWatts = $state<number | null>(settings.microwaveWatts);
	let level = $state(100);
	/** From the package's time, or by food when there's no package (#229). */
	let mode = $state<'package' | 'food'>('package');
	let foodId = $state(FOODS[0]!.id);
	let stateId = $state(FOODS[0]!.states[0]!.id);
	let amount = $state(1);

	// Start from your microwave's wattage once settings have loaded (Settings → Tool defaults).
	let seeded = false;
	$effect(() => {
		if (!settingsStatus.ready || seeded) return;
		seeded = true;
		yourWatts = settings.microwaveWatts;
	});

	// An emptied field binds as null: treat it as missing, so the inline error shows.
	const num = (n: number | null) => (typeof n === 'number' ? n : NaN);
	let food = $derived(FOODS.find((f) => f.id === foodId) ?? FOODS[0]!);
	// A food that has no such state starts from its first one.
	let foodState = $derived(food.states.find((s) => s.id === stateId) ?? food.states[0]!);
	function pickFood(id: string) {
		foodId = id;
		amount = Math.min(amount, (FOODS.find((f) => f.id === id) ?? FOODS[0]!).max);
	}

	let input = $derived(
		mode === 'food'
			? foodPackage({ food, state: foodState, amount, yourWatts: num(yourWatts) })
			: {
					// Seconds alone are fine ("90 sec"); an empty minutes field means 0.
					seconds: (minutes ?? 0) * 60 + num(seconds ?? 0),
					packageWatts: num(packageWatts),
					yourWatts: num(yourWatts),
					level
				}
	);
	// The fields' `min` isn't enforced, and -1 min + 90 s would still add up to a usable time.
	let negative = $derived(mode === 'package' && ((minutes ?? 0) < 0 || (seconds ?? 0) < 0));
	let problem = $derived(
		negative ? 'Minutes and seconds can’t be negative.' : microwaveProblem(input)
	);
	let warnings = $derived(negative ? [] : microwaveWarnings(input, mode === 'food'));
	let result = $derived(negative ? undefined : microwaveTime(input));
	let change = $derived(result === undefined ? 0 : result - Math.round(input.seconds));
	let shownLevel = $derived(mode === 'food' ? foodState.level : level);

	let canSave = $derived(
		parseWatts(yourWatts) !== undefined && yourWatts !== settings.microwaveWatts
	);
	function saveWatts() {
		const watts = parseWatts(yourWatts);
		if (watts === undefined || watts === settings.microwaveWatts) return;
		settings.microwaveWatts = watts;
		// A failed save is reported by saveSettings.
		if (saveSettings()) toast(`Saved: your microwave is ${watts} W.`);
	}

	const field =
		'rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
</script>

<svelte:head>
	<title>Microwave Time Converter</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<section
		aria-label="Estimated time"
		aria-live="polite"
		class="rounded-lg bg-white/80 p-4 text-center dark:bg-gray-900"
		data-testid="microwave-result"
	>
		{#if result !== undefined}
			<p class="text-sm text-gray-600 dark:text-gray-400">
				In your microwave{shownLevel < 100 ? ` at ${shownLevel}% power` : ''}, {mode === 'food'
					? 'start with'
					: 'about'}
			</p>
			<p class="text-4xl font-semibold tabular-nums" data-testid="microwave-time">
				{formatClock(result)}
			</p>
			{#if mode === 'food'}
				<p class="mt-1 text-sm" data-testid="microwave-tip">{foodState.tip}</p>
				{#if food.reheat}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Then check it's steaming hot all the way through (74 °C / 165 °F), and add 30 seconds at
						a time until it is.
					</p>
				{/if}
			{:else}
				<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="microwave-change">
					{change === 0
						? 'Same as the package'
						: `${formatClock(Math.abs(change))} ${change < 0 ? 'less' : 'more'} than the package`}
				</p>
			{/if}
		{:else}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{problem}</p>
		{/if}
	</section>

	<OvenWarnings {warnings} />

	<div class="grid grid-cols-2 gap-2" role="group" aria-label="Start from">
		<button
			type="button"
			class="{toggle(mode === 'package')} min-h-11"
			aria-pressed={mode === 'package'}
			onclick={() => (mode = 'package')}>The package</button
		>
		<button
			type="button"
			class="{toggle(mode === 'food')} min-h-11"
			aria-pressed={mode === 'food'}
			onclick={() => (mode = 'food')}>A food</button
		>
	</div>

	<form class="flex flex-col gap-4" onsubmit={(e) => e.preventDefault()}>
		{#if mode === 'food'}
			<fieldset class="flex flex-col gap-3">
				<legend class="mb-2 font-semibold">What you're heating</legend>
				<label class="flex flex-col gap-1 text-sm">
					<span>Food</span>
					<select value={foodId} onchange={(e) => pickFood(e.currentTarget.value)} class={field}>
						{#each FOODS as f (f.id)}
							<option value={f.id}>{f.name}</option>
						{/each}
					</select>
				</label>
				{#if food.states.length > 1}
					<div class="grid grid-cols-2 gap-2" role="group" aria-label="Starting from">
						{#each food.states as st (st.id)}
							<button
								type="button"
								class="{toggle(foodState.id === st.id)} min-h-11"
								aria-pressed={foodState.id === st.id}
								onclick={() => (stateId = st.id)}>{st.label}</button
							>
						{/each}
					</div>
				{/if}
				{#if food.max > 1}
					<div class="flex items-center gap-3">
						<button
							type="button"
							class="size-11 rounded-full bg-white/70 text-xl hover:not-disabled:bg-white active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700"
							aria-label="Less"
							disabled={amount <= 1}
							onclick={() => (amount = Math.max(1, amount - 1))}>−</button
						>
						<p class="flex-1 text-center" aria-live="polite" data-testid="microwave-amount">
							<span class="text-lg font-semibold tabular-nums">{amount}</span>
							{amount === 1 ? food.unit.one : food.unit.other}
							{#if food.unit.note}
								<span class="block text-sm text-gray-600 dark:text-gray-400">{food.unit.note}</span>
							{/if}
						</p>
						<button
							type="button"
							class="size-11 rounded-full bg-white/70 text-xl hover:not-disabled:bg-white active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700"
							aria-label="More"
							disabled={amount >= food.max}
							onclick={() => (amount = Math.min(food.max, amount + 1))}>+</button
						>
					</div>
				{:else}
					<p class="text-sm text-gray-600 dark:text-gray-400">
						One {food.unit.one} at a time{food.unit.note ? ` (${food.unit.note})` : ''}.
					</p>
				{/if}
			</fieldset>
		{:else}
			<fieldset class="flex flex-col gap-3">
				<legend class="mb-2 font-semibold">The package says</legend>
				<div class="grid grid-cols-2 gap-3">
					<label class="flex flex-col gap-1 text-sm">
						<span>Minutes</span>
						<input type="number" inputmode="numeric" min="0" bind:value={minutes} class={field} />
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span>Seconds</span>
						<input type="number" inputmode="numeric" min="0" bind:value={seconds} class={field} />
					</label>
					<label class="col-span-2 flex flex-col gap-1 text-sm">
						<span>For a microwave of (W)</span>
						<input
							type="number"
							inputmode="numeric"
							min={WATTS.min}
							max={WATTS.max}
							step={WATTS.step}
							bind:value={packageWatts}
							class={field}
						/>
					</label>
				</div>
			</fieldset>
		{/if}

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 font-semibold">Your microwave</legend>
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span>Wattage (W)</span>
					<input
						type="number"
						inputmode="numeric"
						min={WATTS.min}
						max={WATTS.max}
						step={WATTS.step}
						bind:value={yourWatts}
						class={field}
					/>
				</label>
				{#if mode === 'package'}
					<label class="flex flex-col gap-1 text-sm">
						<span>Power level</span>
						<select bind:value={level} class={field}>
							{#each POWER_LEVELS as l (l)}
								<option value={l}>{l === 100 ? 'High (100%)' : `${l}%`}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>
			<button
				type="button"
				disabled={!canSave}
				onclick={saveWatts}
				class="self-start rounded-md bg-white/70 px-4 py-2 text-sm hover:not-disabled:bg-white active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700"
			>
				Save as my microwave
			</button>
		</fieldset>
	</form>

	<div class="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
		{#if mode === 'food'}
			<p>
				Food times are cautious starting points, worked out for your wattage: microwaves, dishes and
				portions differ, and it's easier to add time than to take it back. More food takes longer,
				but not twice as long for twice as much.
			</p>
		{/if}
		<p>
			An estimate that keeps the energy the same: a weaker microwave, or a lower power level, needs
			longer. Stir or turn the food halfway, let it stand a minute or two, and check it's hot all
			the way through.
		</p>
		<p>
			Your microwave's wattage is on a label inside the door, on the back, or in its manual. Many
			packages give times for two wattages: use the one closest to yours.
		</p>
		<p>
			Lower power levels heat more gently and evenly, which helps when defrosting, softening butter
			or reheating dense food.
		</p>
	</div>
</main>
