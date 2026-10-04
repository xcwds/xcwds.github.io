<script lang="ts">
	import { stepText, stepTimer, type StepTimer } from '$lib/recipes';
	import { formatIngredient, formatYield, isScalable } from '$lib/recipes/scale';
	import { nativeSystem, systemOf } from '$lib/recipes/units';
	import RecipeUnitsToggle from '$lib/RecipeUnitsToggle.svelte';
	import { settings } from '$lib/settings.svelte';
	import { toast } from '$lib/toast.svelte';
	import { CookingTimers, MINUTE } from '$lib/utils/cooking-timers.svelte';
	import {
		adjustOvenTime,
		asRange,
		foodPreset,
		formatMinutes,
		formatMinutesRange,
		formatTemp
	} from '$lib/utils/oven';
	import OvenPanel from './OvenPanel.svelte';
	import TimerTray from './TimerTray.svelte';

	let { data } = $props();
	let recipe = $derived(data.recipe);

	// Servings target: starts at the recipe's yield (again whenever the recipe changes).
	let base = $derived(recipe.yield);
	let scalable = $derived(recipe.ingredients.some(isScalable));
	let stepSize = $derived(base.step ?? 1);
	let target = $derived(base.amount);
	let factor = $derived(target / base.amount);
	// US or metric: your choice (Settings → Tool defaults, or the toggle here), else as written.
	let measured = $derived(recipe.ingredients.filter(isScalable));
	let native = $derived(nativeSystem(measured.map((i) => i.unit)));
	let convertible = $derived(measured.some((i) => systemOf(i.unit)));
	let system = $derived(settings.recipeUnits ?? native);
	let ingredients = $derived(
		recipe.ingredients.map((i) => formatIngredient(i, factor, convertible ? system : undefined))
	);

	/** Steps to the next multiple of the step size, so 24 → 36 → 48 even from an odd yield. */
	function stepTarget(direction: 1 | -1) {
		const n = target / stepSize;
		const next = direction === 1 ? Math.floor(n + 1e-9) + 1 : Math.ceil(n - 1e-9) - 1;
		target = Math.max(1, next) * stepSize;
	}

	// Step timers go into the shared Cooking Timer list; the tray below shows and rings them.
	const timers = new CookingTimers();
	/** The oven panel's temperature while it's open and in use (°F); oven step timers follow it. */
	let ovenF = $state<number | undefined>();

	/** Whole minutes for a step timer: the low end of a range, adjusted for the oven panel. */
	function timerMinutes(timer: StepTimer): number {
		const low = asRange(timer.minutes)[0];
		const oven = recipe.oven;
		if (!timer.oven || !oven || ovenF === undefined) return low;
		const adjusted = adjustOvenTime({
			fromF: oven.temp,
			toF: ovenF,
			minutes: low,
			...foodPreset(oven.food)
		});
		return Math.max(1, Math.round(adjusted ?? low));
	}

	function startTimer(timer: StepTimer) {
		const minutes = timerMinutes(timer);
		const label = timer.label ?? recipe.name;
		timers.add(minutes * MINUTE, label);
		toast(`Started a ${formatMinutes(minutes)} timer: ${label}.`);
	}
</script>

<svelte:head>
	<title>{recipe.name}</title>
	<meta name="description" content={recipe.description} />
</svelte:head>

<main
	class="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-2 pb-6 text-gray-800 sm:px-12 sm:pb-12 dark:text-gray-200"
>
	<header class="flex flex-col gap-2">
		<p>{recipe.description}</p>
		<dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
			<div class="flex gap-1">
				<dt class="font-medium">Yield:</dt>
				<dd>{formatYield(base.amount, base)}</dd>
			</div>
			{#if recipe.time}
				<div class="flex gap-1">
					<dt class="font-medium">Time:</dt>
					<dd>{recipe.time}</dd>
				</div>
			{/if}
			{#if recipe.oven}
				<div class="flex gap-1">
					<dt class="font-medium">Oven:</dt>
					<dd>
						{formatTemp(recipe.oven.temp, settings.ovenUnit)} ·
						{formatMinutesRange(asRange(recipe.oven.minutes))}
					</dd>
				</div>
			{/if}
		</dl>
		{#if recipe.tags.length}
			<ul class="flex flex-wrap gap-2">
				{#each recipe.tags as tag (tag)}
					<li class="rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-gray-800">{tag}</li>
				{/each}
			</ul>
		{/if}
	</header>

	{#if recipe.notes?.length}
		<ul class="flex flex-col gap-1 text-sm">
			{#each recipe.notes as note (note)}
				<li>{note}</li>
			{/each}
		</ul>
	{/if}

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold">Ingredients</h2>
		{#if scalable}
			<div class="flex flex-wrap items-center gap-2" data-testid="servings">
				<button
					type="button"
					class="size-11 rounded-full bg-white/70 text-xl hover:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:bg-gray-700"
					aria-label="Fewer {base.unit}"
					disabled={target <= stepSize}
					onclick={() => stepTarget(-1)}>−</button
				>
				<output
					class="min-w-28 text-center font-semibold tabular-nums"
					aria-live="polite"
					data-testid="servings-target">{formatYield(target, base)}</output
				>
				<button
					type="button"
					class="size-11 rounded-full bg-white/70 text-xl hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
					aria-label="More {base.unit}"
					onclick={() => stepTarget(1)}>+</button
				>
				{#if factor !== 1}
					<button
						type="button"
						class="rounded-md bg-white/70 px-3 py-2 text-sm hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
						onclick={() => (target = base.amount)}
					>
						Reset to {formatYield(base.amount, base)}
					</button>
				{/if}
			</div>
			{#if factor !== 1}
				<p class="text-sm text-amber-800 dark:text-amber-300" data-testid="scaled-note">
					Quantities scaled ×{Math.round(factor * 100) / 100}. Times and pan sizes are not; check
					doneness as you go.
				</p>
			{/if}
		{/if}
		{#if convertible}
			<RecipeUnitsToggle {native} />
			{#if system !== native}
				<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="units-note">
					Converted from {native === 'us' ? 'US' : 'metric'} measures; amounts in the steps are as written.
					Spoon measures stay as spoons.
				</p>
			{/if}
		{/if}
		<ul class="list-disc pl-6" data-testid="ingredients">
			{#each ingredients as ingredient, i (i)}
				<li>
					{#if ingredient.quantity}<strong class="font-semibold">{ingredient.quantity}</strong
						>{/if}{ingredient.quantity ? ' ' : ''}{ingredient.text}
				</li>
			{/each}
		</ul>
	</section>

	{#if recipe.oven}
		{#key recipe.slug}
			<OvenPanel oven={recipe.oven} bind:activeF={ovenF} />
		{/key}
	{/if}

	<section class="flex flex-col gap-2">
		<h2 class="text-lg font-semibold">Instructions</h2>
		<ol class="flex list-decimal flex-col gap-2 pl-6">
			{#each recipe.instructions as step, i (i)}
				{@const timer = stepTimer(step)}
				<li>
					{stepText(step)}
					{#if timer}
						<button
							type="button"
							class="mt-2 flex min-h-11 items-center gap-2 rounded-full bg-white/70 px-4 text-sm font-medium hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
							onclick={() => startTimer(timer)}
						>
							<span aria-hidden="true">⏲️</span>
							Start {formatMinutes(timerMinutes(timer))} timer{timer.oven && ovenF !== undefined
								? ` (at ${formatTemp(ovenF, settings.ovenUnit)})`
								: ''}
						</button>
					{/if}
				</li>
			{/each}
		</ol>
	</section>

	{#if recipe.tips?.length}
		<section class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">Tips</h2>
			<ul class="flex list-disc flex-col gap-1 pl-6">
				{#each recipe.tips as tip, i (i)}
					<li>{tip}</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if recipe.source}
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Source: <a href={recipe.source} class="underline" rel="external noopener">{recipe.source}</a>
		</p>
	{/if}

	<!-- Last in the page so it sticks to the bottom of the screen while you scroll the steps. -->
	<TimerTray {timers} />
</main>
