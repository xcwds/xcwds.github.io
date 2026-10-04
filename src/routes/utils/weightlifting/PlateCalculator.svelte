<script lang="ts">
	import { persist } from '$lib/persist.svelte';
	import { settings, settingsStatus } from '$lib/settings.svelte';
	import { entries } from '$lib/storage';
	import {
		UNITS,
		WEIGHT_UNITS,
		findEquipment,
		formatWeight,
		implementWeight,
		platesForTarget,
		totalWeight,
		type EquipmentId,
		type PlateCounts,
		type WeightUnit
	} from '$lib/utils/lifting';
	import { button, card, field, primary, toggle } from './styles';

	let { total = $bindable(0) }: { total?: number } = $props();

	type PlateStyle = { height: string; color: string };
	const WHITE = 'bg-gray-100 border border-gray-400';
	const PLATE_STYLE: Record<WeightUnit, Record<number, PlateStyle>> = {
		lb: {
			45: { height: 'h-24', color: 'bg-blue-700' },
			35: { height: 'h-21', color: 'bg-yellow-500' },
			25: { height: 'h-18', color: 'bg-green-600' },
			10: { height: 'h-14', color: WHITE },
			5: { height: 'h-11', color: 'bg-red-600' },
			2.5: { height: 'h-9', color: 'bg-gray-600' },
			1.25: { height: 'h-7', color: 'bg-gray-400' }
		},
		// Competition (IWF) colors.
		kg: {
			25: { height: 'h-24', color: 'bg-red-600' },
			20: { height: 'h-24', color: 'bg-blue-700' },
			15: { height: 'h-21', color: 'bg-yellow-500' },
			10: { height: 'h-18', color: 'bg-green-600' },
			5: { height: 'h-14', color: WHITE },
			2.5: { height: 'h-11', color: 'bg-red-400' },
			1.25: { height: 'h-9', color: 'bg-gray-400' }
		}
	};

	let unit = $derived(settings.lifting.unit);
	let system = $derived(UNITS[unit]);
	/** The plates you have, per unit (Settings → Tool defaults, or the toggles in target mode). */
	let available = $derived(settings.lifting.plates[unit]);

	let equipmentId = $state<EquipmentId>('barbell');
	let mode = $state<'load' | 'target'>('load');
	let symmetric = $state(true);
	let sides = $state<PlateCounts[]>([{}, {}]);
	/** Unit the plate counts in `sides` are in; they're cleared when the unit changes. */
	let sidesUnit = $state<WeightUnit>('lb');
	let target = $state<number | null>(null);

	let equipment = $derived(findEquipment(unit, equipmentId));
	let oneSided = $derived(equipment.sides === 1);
	let effectiveSides = $derived(symmetric || oneSided ? [sides[0], sides[0]] : sides);
	let result = $derived(target === null ? null : platesForTarget(equipment, target, available));

	$effect(() => {
		total = totalWeight(equipment, effectiveSides);
	});

	let hadSaved = false;
	persist(
		entries.liftingCalculator,
		() => ({ unit: sidesUnit, equipmentId, mode, symmetric, sides }),
		(saved) => {
			hadSaved = true;
			equipmentId = saved.equipmentId ?? equipmentId;
			mode = saved.mode ?? mode;
			symmetric = saved.symmetric ?? symmetric;
			if (saved.unit && saved.sides) {
				sidesUnit = saved.unit;
				sides = saved.sides;
			}
		}
	);

	// Settings load after this page mounts: then apply the default equipment (if nothing was
	// saved) and clear plate counts saved in the other unit.
	let seeded = false;
	$effect(() => {
		if (!settingsStatus.ready) return;
		if (!seeded) {
			seeded = true;
			if (!hadSaved) equipmentId = settings.lifting.equipment;
		}
		if (sidesUnit !== unit) {
			sides = [{}, {}];
			sidesUnit = unit;
			target = null;
		}
	});

	function setUnit(next: WeightUnit) {
		settings.lifting.unit = next;
	}

	function change(side: number, plate: number, delta: number) {
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

	function toggleAvailable(plate: number) {
		settings.lifting.plates[unit] = available.includes(plate)
			? available.filter((p) => p !== plate)
			: system.plates.filter((p) => p === plate || available.includes(p));
	}

	const weight = (w: number) => formatWeight(w, unit);

	/** Plates for the diagram, heaviest nearest the bar. */
	const stack = (counts: PlateCounts) =>
		system.plates.flatMap((plate) => Array.from({ length: counts[plate] ?? 0 }, () => plate));
	const plateList = (counts: PlateCounts) =>
		system.plates
			.filter((p) => counts[p])
			.map((p) => `${p}${(counts[p] ?? 0) > 1 ? ` × ${counts[p]}` : ''}`)
			.join(', ') || 'no plates';
</script>

<section class="flex flex-col gap-4">
	<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Units">
		{#each WEIGHT_UNITS as u (u)}
			<button
				type="button"
				role="radio"
				aria-checked={unit === u}
				class={toggle(unit === u)}
				onclick={() => setUnit(u)}>{u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}</button
			>
		{/each}
	</div>

	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Equipment">
		{#each system.equipment as item (item.id)}
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
		<p class="text-5xl font-semibold tabular-nums" data-testid="total">{weight(total)}</p>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{#if equipment.count === 2}
				2 dumbbells × {weight(implementWeight(equipment, effectiveSides))} each
			{:else}
				{weight(equipment.bar)}
				{equipment.id.startsWith('barbell') ? 'bar' : 'handle'} + {weight(total - equipment.bar)} plates
			{/if}
		</p>
		<div class="flex h-24 items-center justify-center" aria-hidden="true">
			{#if !oneSided}
				{#each stack(effectiveSides[0]).toReversed() as plate, i (i)}
					<span
						class="mx-px w-2.5 rounded-sm {PLATE_STYLE[unit][plate].height} {PLATE_STYLE[unit][
							plate
						].color}"
					></span>
				{/each}
			{/if}
			<span class="h-2 rounded-full bg-gray-500 {equipment.bar >= 25 ? 'w-24' : 'w-10'}"></span>
			{#each stack(effectiveSides[oneSided ? 0 : 1]) as plate, i (i)}
				<span
					class="mx-px w-2.5 rounded-sm {PLATE_STYLE[unit][plate].height} {PLATE_STYLE[unit][plate]
						.color}"
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
				<label class="flex min-h-11 items-center gap-2">
					<input
						type="checkbox"
						class="size-6"
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
					{#each system.plates as plate (plate)}
						<tr>
							<th scope="row" class="py-1 text-left font-medium">{weight(plate)}</th>
							{#each symmetric || oneSided ? [0] : [0, 1] as side (side)}
								{@const label =
									symmetric || oneSided
										? `${plate} ${unit}`
										: `${plate} ${unit} ${side ? 'right' : 'left'}`}
								<td class="py-1">
									<div class="flex items-center justify-center gap-2">
										<button
											type="button"
											aria-label="Remove {label}"
											class="{button} size-11 p-0 text-xl"
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
											class="{button} size-11 p-0 text-xl"
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
				<span
					>{equipment.count === 2
						? `Total for both dumbbells (${unit})`
						: `Target weight (${unit})`}</span
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
					{#each system.plates as plate (plate)}
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
								{weight(target)} can't be loaded exactly; closest under is {weight(result.total)}.
							</p>
						{/if}
					</div>
					<button type="button" class={primary} onclick={() => load(result.perSide)}>
						Load these plates
					</button>
				{:else}
					<p class="text-sm text-amber-800 dark:text-amber-300">
						That's lighter than the empty {equipment.count === 2 ? 'handles' : 'bar'} ({weight(
							equipment.count * equipment.bar
						)}).
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</section>
