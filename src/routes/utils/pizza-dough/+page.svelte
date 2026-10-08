<script lang="ts">
	import { resolve } from '$app/paths';
	import { saveSettings, settings, settingsStatus } from '$lib/settings.svelte';
	import { toast } from '$lib/toast.svelte';
	import {
		computeDough,
		DOUGH_MAX,
		doughDefaults,
		isDoughValue,
		type DoughInput
	} from '$lib/utils/dough';

	let input = $state<DoughInput>({ ...doughDefaults });

	// Start from your saved defaults once settings have loaded (Settings → Tool defaults).
	let seeded = false;
	$effect(() => {
		if (!settingsStatus.ready || seeded) return;
		seeded = true;
		input = { ...settings.pizzaDefaults };
	});

	// Saving uses storage's rules, so a saved default is never swapped out on the next load (#67).
	let invalid = $derived(
		(Object.keys(input) as (keyof DoughInput)[]).filter((k) => !isDoughValue(input[k]))
	);

	function saveDefaults() {
		if (invalid.length) return;
		settings.pizzaDefaults = { ...input };
		// A failed save is reported by saveSettings.
		if (saveSettings()) toast('Saved as your pizza dough defaults.');
	}

	let isDefault = $derived(
		(Object.keys(input) as (keyof DoughInput)[]).every(
			(k) => input[k] === settings.pizzaDefaults[k]
		)
	);
	let result = $derived(computeDough(input));

	const fields: { key: keyof DoughInput; label: string; unit: string; step: number }[] = [
		{ key: 'balls', label: 'Dough balls', unit: '', step: 1 },
		{ key: 'ballWeight', label: 'Weight per ball', unit: 'g', step: 5 },
		{ key: 'hydration', label: 'Hydration', unit: '%', step: 1 },
		{ key: 'salt', label: 'Salt', unit: '%', step: 0.1 },
		{ key: 'yeast', label: 'Active dry yeast', unit: '%', step: 0.1 },
		{ key: 'oil', label: 'Olive oil', unit: '%', step: 0.1 },
		{ key: 'sugar', label: 'Honey / sugar', unit: '%', step: 0.1 }
	];

	let rows = $derived([
		{ name: 'Flour', grams: result.flour },
		{ name: 'Water', grams: result.water },
		{ name: 'Salt', grams: result.salt },
		{ name: 'Active dry yeast', grams: result.yeast },
		{ name: 'Olive oil', grams: result.oil },
		{ name: 'Honey / sugar', grams: result.sugar }
	]);

	const grams = (g: number) => (g < 20 ? g.toFixed(1) : Math.round(g).toString());
</script>

<svelte:head>
	<title>Pizza Dough Calculator</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
	<section
		aria-label="Ingredients"
		class="rounded-lg bg-white/80 p-4 dark:bg-gray-900"
		data-testid="dough-result"
	>
		<table class="w-full text-lg">
			<tbody>
				{#each rows as row (row.name)}
					<tr class="border-b border-gray-200 last:border-0 dark:border-gray-800">
						<th scope="row" class="py-2 text-left font-normal">{row.name}</th>
						<td class="py-2 text-right font-semibold tabular-nums">{grams(row.grams)} g</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="mt-2 text-right text-sm text-gray-600 dark:text-gray-400">
			Total {Math.round(result.total)} g
		</p>
	</section>

	<form class="grid grid-cols-2 gap-3" onsubmit={(e) => e.preventDefault()}>
		{#each fields as field (field.key)}
			{@const bad = invalid.includes(field.key)}
			<div class="flex flex-col gap-1 text-sm">
				<label class="flex flex-col gap-1">
					<span>{field.label}{field.unit ? ` (${field.unit})` : ''}</span>
					<input
						type="number"
						inputmode="decimal"
						min="0"
						max={DOUGH_MAX}
						step={field.step}
						bind:value={input[field.key]}
						aria-invalid={bad}
						aria-describedby={bad ? `${field.key}-error` : undefined}
						class="rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
					/>
				</label>
				{#if bad}
					<p id="{field.key}-error" class="text-red-700 dark:text-red-400">
						Enter a number from 0 to {DOUGH_MAX.toLocaleString('en-US')}.
					</p>
				{/if}
			</div>
		{/each}
		<button
			type="button"
			disabled={isDefault}
			onclick={() => (input = { ...settings.pizzaDefaults })}
			class="rounded-md bg-white/70 px-4 py-2 text-sm hover:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:bg-gray-700"
		>
			Reset to my defaults
		</button>
		<button
			type="button"
			disabled={isDefault || invalid.length > 0}
			onclick={saveDefaults}
			class="rounded-md bg-white/70 px-4 py-2 text-sm hover:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:bg-gray-700"
		>
			Save as my defaults
		</button>
	</form>

	<p class="text-sm text-gray-600 dark:text-gray-400">
		Weights are in grams. Percentages are baker's percentages (relative to flour weight). The
		built-in defaults match the
		<a class="underline" href={resolve('/recipes/[slug]', { slug: 'pizza-dough' })}
			>pizza dough recipe</a
		>.
	</p>
</main>
