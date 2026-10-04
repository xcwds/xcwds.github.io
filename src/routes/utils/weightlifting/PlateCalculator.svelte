<script lang="ts">
	import { onMount } from 'svelte';
	import {
		EQUIPMENT,
		PLATES,
		implementWeight,
		lb,
		platesForTarget,
		totalWeight,
		type Plate,
		type PlateCounts
	} from '$lib/utils/lifting';
	import { button, card, field, primary, toggle } from './styles';

	let { total = $bindable(0) }: { total?: number } = $props();

	const STORAGE_KEY = 'lifting-calculator';
	const PLATE_STYLE: Record<Plate, { height: string; color: string }> = {
		45: { height: 'h-24', color: 'bg-blue-700' },
		35: { height: 'h-21', color: 'bg-yellow-500' },
		25: { height: 'h-18', color: 'bg-green-600' },
		10: { height: 'h-14', color: 'bg-gray-100 border border-gray-400' },
		5: { height: 'h-11', color: 'bg-red-600' },
		2.5: { height: 'h-9', color: 'bg-gray-600' },
		1.25: { height: 'h-7', color: 'bg-gray-400' }
	};

	let equipmentId = $state(EQUIPMENT[0].id);
	let mode = $state<'load' | 'target'>('load');
	let symmetric = $state(true);
	let sides = $state<PlateCounts[]>([{}, {}]);
	let target = $state<number | null>(null);
	let available = $state<Plate[]>([...PLATES]);
	let loaded = false;

	let equipment = $derived(EQUIPMENT.find((e) => e.id === equipmentId) ?? EQUIPMENT[0]);
	let oneSided = $derived(equipment.sides === 1);
	let effectiveSides = $derived(symmetric || oneSided ? [sides[0], sides[0]] : sides);
	let result = $derived(target === null ? null : platesForTarget(equipment, target, available));

	$effect(() => {
		total = totalWeight(equipment, effectiveSides);
	});

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
			if (saved) {
				equipmentId = saved.equipmentId ?? equipmentId;
				mode = saved.mode ?? mode;
				symmetric = saved.symmetric ?? symmetric;
				sides = saved.sides ?? sides;
				available = saved.available ?? available;
			}
		} catch {
			// Ignore unreadable storage.
		}
		loaded = true;
	});

	$effect(() => {
		const snapshot = JSON.stringify({ equipmentId, mode, symmetric, sides, available });
		if (!loaded) return;
		try {
			localStorage.setItem(STORAGE_KEY, snapshot);
		} catch {
			// Not persisted; fine.
		}
	});

	function change(side: number, plate: Plate, delta: number) {
		sides[side][plate] = Math.max(0, (sides[side][plate] ?? 0) + delta);
	}

	/** Symmetric mode only edits the left side, so both switches start the right as a copy of it. */
	function setSymmetric(on: boolean) {
		sides[1] = { ...sides[0] };
		symmetric = on;
	}

	function load(perSide: PlateCounts) {
		sides = [{ ...perSide }, { ...perSide }];
		symmetric = true;
		mode = 'load';
	}

	function toggleAvailable(plate: Plate) {
		available = available.includes(plate)
			? available.filter((p) => p !== plate)
			: PLATES.filter((p) => p === plate || available.includes(p));
	}

	/** Plates for the diagram, heaviest nearest the bar. */
	const stack = (counts: PlateCounts) =>
		PLATES.flatMap((plate) => Array.from({ length: counts[plate] ?? 0 }, () => plate));
	const plateList = (counts: PlateCounts) =>
		PLATES.filter((p) => counts[p])
			.map((p) => `${p}${(counts[p] ?? 0) > 1 ? ` × ${counts[p]}` : ''}`)
			.join(', ') || 'no plates';
</script>

<section class="flex flex-col gap-4">
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Equipment">
		{#each EQUIPMENT as item (item.id)}
			<button
				type="button"
				aria-pressed={equipmentId === item.id}
				class={toggle(equipmentId === item.id)}
				onclick={() => (equipmentId = item.id)}
			>
				{item.name}
			</button>
		{/each}
	</div>

	<div class="{card} flex flex-col items-center gap-3 text-center">
		<p class="text-5xl font-semibold tabular-nums" data-testid="total">{lb(total)}</p>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{#if equipment.count === 2}
				2 dumbbells × {lb(implementWeight(equipment, effectiveSides))} each
			{:else}
				{lb(equipment.bar)}
				{equipment.bar < 25 ? 'handle' : 'bar'} + {lb(total - equipment.bar)} plates
			{/if}
		</p>
		<div class="flex h-24 items-center justify-center" aria-hidden="true">
			{#if !oneSided}
				{#each stack(effectiveSides[0]).toReversed() as plate, i (i)}
					<span
						class="mx-px w-2.5 rounded-sm {PLATE_STYLE[plate].height} {PLATE_STYLE[plate].color}"
					></span>
				{/each}
			{/if}
			<span class="h-2 rounded-full bg-gray-500 {equipment.bar >= 25 ? 'w-24' : 'w-10'}"></span>
			{#each stack(effectiveSides[oneSided ? 0 : 1]) as plate, i (i)}
				<span class="mx-px w-2.5 rounded-sm {PLATE_STYLE[plate].height} {PLATE_STYLE[plate].color}"
				></span>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-2 gap-2" role="group" aria-label="Mode">
		<button
			type="button"
			aria-pressed={mode === 'load'}
			class={toggle(mode === 'load')}
			onclick={() => (mode = 'load')}
		>
			Load plates
		</button>
		<button
			type="button"
			aria-pressed={mode === 'target'}
			class={toggle(mode === 'target')}
			onclick={() => (mode = 'target')}
		>
			Target weight
		</button>
	</div>

	{#if mode === 'load'}
		<div class="{card} flex flex-col gap-3">
			{#if !oneSided}
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						class="size-5"
						checked={symmetric}
						onchange={(e) => setSymmetric(e.currentTarget.checked)}
					/>
					Same plates on both sides
				</label>
			{/if}
			<table class="w-full">
				<thead class="text-sm text-gray-600 dark:text-gray-400">
					<tr>
						<th class="text-left font-normal">Plate</th>
						{#if symmetric || oneSided}
							<th class="font-normal">{oneSided ? 'On the post' : 'Per side'}</th>
						{:else}
							<th class="font-normal">Left</th>
							<th class="font-normal">Right</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each PLATES as plate (plate)}
						<tr>
							<th scope="row" class="py-1 text-left font-medium">{lb(plate)}</th>
							{#each symmetric || oneSided ? [0] : [0, 1] as side (side)}
								{@const label =
									symmetric || oneSided ? `${plate} lb` : `${plate} lb ${side ? 'right' : 'left'}`}
								<td class="py-1">
									<div class="flex items-center justify-center gap-2">
										<button
											type="button"
											aria-label="Remove {label}"
											class="{button} size-10 p-0 text-xl"
											disabled={!sides[side][plate]}
											onclick={() => change(side, plate, -1)}>−</button
										>
										<span
											class="w-6 text-center text-lg tabular-nums"
											data-testid="count-{plate}-{side}">{sides[side][plate] ?? 0}</span
										>
										<button
											type="button"
											aria-label="Add {label}"
											class="{button} size-10 p-0 text-xl"
											onclick={() => change(side, plate, 1)}>+</button
										>
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
			<button type="button" class={button} onclick={() => (sides = [{}, {}])}>Clear plates</button>
		</div>
	{:else}
		<div class="{card} flex flex-col gap-3">
			<label class="flex flex-col gap-1 text-sm">
				<span>{equipment.count === 2 ? 'Total for both dumbbells (lb)' : 'Target weight (lb)'}</span
				>
				<input
					type="number"
					inputmode="decimal"
					min="0"
					step="any"
					bind:value={target}
					class="{field} text-lg"
				/>
			</label>
			<fieldset class="flex flex-col gap-1 text-sm">
				<legend class="mb-1">Plates available</legend>
				<div class="flex flex-wrap gap-2">
					{#each PLATES as plate (plate)}
						<button
							type="button"
							aria-pressed={available.includes(plate)}
							class={toggle(available.includes(plate))}
							onclick={() => toggleAvailable(plate)}>{plate}</button
						>
					{/each}
				</div>
			</fieldset>
			{#if target !== null}
				{#if result}
					<div class="flex flex-col gap-1" data-testid="target-result">
						<p class="text-lg">
							<span class="font-semibold">{oneSided ? 'On the post' : 'Per side'}:</span>
							{plateList(result.perSide)}
						</p>
						{#if equipment.count === 2}
							<p class="text-sm">Same on both dumbbells.</p>
						{/if}
						{#if !result.exact}
							<p class="text-sm text-amber-800 dark:text-amber-300">
								{lb(target)} can't be loaded exactly; closest under is {lb(result.total)}.
							</p>
						{/if}
					</div>
					<button type="button" class={primary} onclick={() => load(result.perSide)}>
						Load these plates
					</button>
				{:else}
					<p class="text-sm text-amber-800 dark:text-amber-300">
						That's lighter than the empty {equipment.count === 2 ? 'handles' : 'bar'} ({lb(
							equipment.count * equipment.bar
						)}).
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</section>
