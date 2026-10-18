<script lang="ts">
	import OvenWarnings from '#lib/OvenWarnings.svelte';
	import { saveSettings, settings, settingsStatus } from '#lib/settings.svelte.js';
	import { toast } from '#lib/toast.svelte.js';
	import {
		DEFAULT_PACKAGE_WATTS,
		POWER_LEVELS,
		WATTS,
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

	// Start from your microwave's wattage once settings have loaded (Settings → Tool defaults).
	let seeded = false;
	$effect(() => {
		if (!settingsStatus.ready || seeded) return;
		seeded = true;
		yourWatts = settings.microwaveWatts;
	});

	// An emptied field binds as null: treat it as missing, so the inline error shows.
	const num = (n: number | null) => (typeof n === 'number' ? n : NaN);
	let input = $derived({
		// Seconds alone are fine ("90 sec"); an empty minutes field means 0.
		seconds: (minutes ?? 0) * 60 + num(seconds ?? 0),
		packageWatts: num(packageWatts),
		yourWatts: num(yourWatts),
		level
	});
	let problem = $derived(microwaveProblem(input));
	let warnings = $derived(microwaveWarnings(input));
	let result = $derived(microwaveTime(input));
	let change = $derived(result === undefined ? 0 : result - Math.round(input.seconds));

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
				In your microwave{level < 100 ? ` at ${level}% power` : ''}, about
			</p>
			<p class="text-4xl font-semibold tabular-nums" data-testid="microwave-time">
				{formatClock(result)}
			</p>
			<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="microwave-change">
				{change === 0
					? 'Same as the package'
					: `${formatClock(Math.abs(change))} ${change < 0 ? 'less' : 'more'} than the package`}
			</p>
		{:else}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{problem}</p>
		{/if}
	</section>

	<OvenWarnings {warnings} />

	<form class="flex flex-col gap-4" onsubmit={(e) => e.preventDefault()}>
		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 font-semibold">The package says</legend>
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span>Minutes</span>
					<input type="number" inputmode="numeric" min="0" bind:value={minutes} class={field} />
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span>Seconds</span>
					<input
						type="number"
						inputmode="numeric"
						min="0"
						max="59"
						bind:value={seconds}
						class={field}
					/>
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
				<label class="flex flex-col gap-1 text-sm">
					<span>Power level</span>
					<select bind:value={level} class={field}>
						{#each POWER_LEVELS as l (l)}
							<option value={l}>{l === 100 ? 'High (100%)' : `${l}%`}</option>
						{/each}
					</select>
				</label>
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
