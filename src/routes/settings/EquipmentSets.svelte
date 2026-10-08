<script lang="ts">
	import { settings } from '$lib/settings.svelte';
	import { entries, read, write } from '$lib/storage';
	import { toast } from '$lib/toast.svelte';
	import {
		BAR_TYPES,
		COMMERCIAL_GYM,
		SETUP_LIMITS,
		UNITS,
		WEIGHT_UNITS,
		barName,
		commercialGym,
		copySet,
		formatWeight,
		newBar,
		newSet,
		numberProblem,
		type Bar,
		type BarType,
		type EquipmentSet,
		type NumberRule,
		type WeightUnit
	} from '$lib/utils/lifting';

	/**
	 * Your equipment sets (#82, #84): make, copy, rename and delete them, and edit their bars and
	 * plate counts. The commercial gym is built in and only offers a copy. Numbers are saved once
	 * they're valid (on change, like the other tool defaults); an invalid one keeps its text and
	 * shows why next to it.
	 */

	let sets = $derived(settings.lifting.sets);
	let errors = $state<Record<string, string>>({});
	/** Text that couldn't be saved, kept in its field (next to the error) until it's fixed. */
	let drafts = $state<Record<string, string>>({});
	/** Sets shown open: new and copied ones open so you can fill them in. */
	let open = $state<Record<string, boolean>>({});
	let confirmingDelete = $state<string | null>(null);

	let creating = $state(false);
	let newName = $state('');
	let newUnit = $state<WeightUnit>('lb');

	const TYPE_LABELS: Record<BarType, string> = {
		barbell: 'Barbell',
		dumbbell: 'Dumbbell handle',
		kettlebell: 'Kettlebell handle'
	};

	const takenIds = () => [COMMERCIAL_GYM, ...sets.map((s) => s.id)];
	const atLimit = $derived(sets.length >= SETUP_LIMITS.maxSets);

	function add(set: EquipmentSet, message: string) {
		settings.lifting.sets.push(set);
		open[set.id] = true;
		toast(message);
	}

	function create() {
		add(newSet(newName, newUnit, takenIds()), 'Set added. Fill in your bars and plates.');
		creating = false;
		newName = '';
	}

	function duplicate(set: EquipmentSet) {
		add(copySet(set, takenIds()), `Copied ${set.name}.`);
	}

	/**
	 * Forgets the errors and rejected text of a removed set or bar. Ids are reused (`set-1` again
	 * after deleting it), so they'd otherwise show up in the next one.
	 */
	function forgetFields(prefix: string) {
		for (const key of Object.keys(drafts)) if (key.startsWith(prefix)) delete drafts[key];
		for (const key of Object.keys(errors)) if (key.startsWith(prefix)) delete errors[key];
	}

	function remove(set: EquipmentSet) {
		settings.lifting.sets = settings.lifting.sets.filter((s) => s.id !== set.id);
		forgetFields(`${set.id}:`);
		delete open[set.id];
		if (settings.lifting.activeSet === set.id) settings.lifting.activeSet = COMMERCIAL_GYM;
		// Forget the station the calculator remembered for it.
		const calc = read(entries.liftingCalculator);
		if (calc?.stations && set.id in calc.stations) {
			const stations = { ...calc.stations };
			delete stations[set.id];
			write(entries.liftingCalculator, { ...calc, stations });
		}
		confirmingDelete = null;
		toast(`Deleted ${set.name}.`);
	}

	function rename(set: EquipmentSet, input: HTMLInputElement) {
		const key = `${set.id}:name`;
		const name = input.value.trim();
		if (!name) {
			errors[key] = 'Enter a name.';
			drafts[key] = input.value;
			return;
		}
		errors[key] = '';
		delete drafts[key];
		set.name = name.slice(0, SETUP_LIMITS.maxName);
	}

	/**
	 * Saves a number field. Blank means `blank` (unlimited, none, or not allowed when undefined);
	 * anything else must pass `rule`.
	 */
	function setNumber(
		key: string,
		input: HTMLInputElement,
		rule: NumberRule,
		unit: WeightUnit,
		blank: { value: number | null | undefined } | undefined,
		apply: (value: number | null | undefined) => void
	) {
		const text = input.value.trim();
		let error = '';
		if (input.validity.badInput) error = 'Enter a number.';
		else if (text === '' && !blank) error = 'Enter a number.';
		else if (text !== '') error = numberProblem(rule, Number(text), unit);
		errors[key] = error;
		if (error) {
			drafts[key] = input.value;
			return;
		}
		delete drafts[key];
		apply(text === '' ? blank!.value : Number(text));
	}

	/** Keeps a bar's default name in step with its type and weight; a name you typed stays. */
	function editBar(set: EquipmentSet, bar: Bar, change: Partial<Bar>) {
		const wasDefault = bar.name === barName(bar.type, bar.weight, set.unit);
		Object.assign(bar, change);
		if (wasDefault) bar.name = barName(bar.type, bar.weight, set.unit);
	}

	function setLimit(bar: Bar, field: 'maxLoad' | 'maxPlatesPerSide', value: number | undefined) {
		if (value === undefined) delete bar[field];
		else bar[field] = value;
	}

	function renameBar(set: EquipmentSet, bar: Bar, input: HTMLInputElement) {
		bar.name =
			input.value.trim().slice(0, SETUP_LIMITS.maxName) || barName(bar.type, bar.weight, set.unit);
		input.value = bar.name;
	}

	function toggleFit(set: EquipmentSet, bar: Bar, plate: number) {
		const sizes = UNITS[set.unit].plates;
		const fit = bar.plates ?? sizes;
		const next = fit.includes(plate)
			? fit.filter((p) => p !== plate)
			: sizes.filter((p) => p === plate || fit.includes(p));
		if (next.length === sizes.length) delete bar.plates;
		else bar.plates = [...next];
	}

	function addBar(set: EquipmentSet) {
		set.bars.push(newBar(set));
	}

	function removeBar(set: EquipmentSet, bar: Bar) {
		set.bars = set.bars.filter((b) => b.id !== bar.id);
		forgetFields(`${set.id}:${bar.id}:`);
	}

	/** One line for a closed set: "35 lb barbell, 2 dumbbell handles · 2 × 45, 8 × 10, …". */
	function describe(set: EquipmentSet): string {
		const bars = set.bars.map((b) => (b.count > 1 ? `${b.count} × ${b.name}` : b.name));
		const plates = UNITS[set.unit].plates
			.filter((p) => set.plates[p] !== 0 && set.plates[p] !== undefined)
			.map((p) => (set.plates[p] === null ? `${p}s` : `${set.plates[p]} × ${p}`));
		return `${bars.join(', ')} · ${plates.length ? plates.join(', ') : 'no plates'}`;
	}

	const field =
		'w-full rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
	const button =
		'rounded-xl bg-white/70 px-3 py-2 text-sm font-medium active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:active:bg-gray-700';
	const toggleClass = (on: boolean) =>
		`rounded-xl px-3 py-2 text-sm font-medium ${
			on
				? 'bg-blue-600 text-white'
				: 'bg-white/70 active:bg-white dark:bg-gray-800 dark:active:bg-gray-700'
		}`;
</script>

{#snippet error(key: string)}
	{#if errors[key]}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{errors[key]}</p>
	{/if}
{/snippet}

{#snippet numberInput(
	key: string,
	label: string,
	current: number | null | undefined,
	placeholder: string,
	rule: NumberRule,
	unit: WeightUnit,
	blank: { value: number | null | undefined } | undefined,
	apply: (value: number | null | undefined) => void
)}
	<label class="flex flex-col gap-1 text-sm">
		<span>{label}</span>
		<input
			type="number"
			inputmode="decimal"
			min={rule === 'weight' || rule === 'plateCount' ? 0 : 1}
			step={rule === 'weight' ? 'any' : '1'}
			class={field}
			{placeholder}
			value={drafts[key] ?? current ?? ''}
			aria-invalid={errors[key] ? 'true' : undefined}
			onchange={(e) => setNumber(key, e.currentTarget, rule, unit, blank, apply)}
		/>
	</label>
	{@render error(key)}
{/snippet}

{#snippet barEditor(set: EquipmentSet, bar: Bar)}
	{@const key = `${set.id}:${bar.id}`}
	<fieldset
		class="flex flex-col gap-3 rounded-xl border border-gray-300 p-3 dark:border-gray-700"
		data-testid="bar-{bar.id}"
	>
		<legend class="px-1 font-medium">{bar.name}</legend>
		<label class="flex flex-col gap-1 text-sm">
			<span>Name</span>
			<input
				class={field}
				value={bar.name}
				onchange={(e) => renameBar(set, bar, e.currentTarget)}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>Type</span>
			<select
				class={field}
				value={bar.type}
				onchange={(e) => editBar(set, bar, { type: e.currentTarget.value as BarType })}
			>
				{#each BAR_TYPES as type (type)}
					<option value={type}>{TYPE_LABELS[type]}</option>
				{/each}
			</select>
		</label>
		{@render numberInput(
			`${key}:weight`,
			`Weight (${set.unit})`,
			bar.weight,
			'',
			'weight',
			set.unit,
			undefined,
			(v) => editBar(set, bar, { weight: v as number })
		)}
		{@render numberInput(
			`${key}:count`,
			bar.type === 'dumbbell'
				? 'How many you have (2 or more: also as a pair)'
				: 'How many you have',
			bar.count,
			'',
			'barCount',
			set.unit,
			undefined,
			(v) => (bar.count = v as number)
		)}
		{@render numberInput(
			`${key}:maxLoad`,
			`Max load (${set.unit} of plates${bar.type === 'dumbbell' ? ', per dumbbell' : ''})`,
			bar.maxLoad,
			'No limit',
			'weight',
			set.unit,
			{ value: undefined },
			(v) => setLimit(bar, 'maxLoad', v ?? undefined)
		)}
		{@render numberInput(
			`${key}:maxPlatesPerSide`,
			bar.type === 'kettlebell' ? 'Max plates on the post' : 'Max plates per side',
			bar.maxPlatesPerSide,
			'No limit',
			'platesPerSide',
			set.unit,
			{ value: undefined },
			(v) => setLimit(bar, 'maxPlatesPerSide', v ?? undefined)
		)}
		<div class="flex flex-col gap-1 text-sm" role="group" aria-label="Plates that fit {bar.name}">
			<span>Plates that fit</span>
			<div class="flex flex-wrap gap-2">
				{#each UNITS[set.unit].plates as plate (plate)}
					{@const on = !bar.plates || bar.plates.includes(plate)}
					<button
						type="button"
						aria-pressed={on}
						aria-label="{plate} {set.unit} fits"
						class={toggleClass(on)}
						onclick={() => toggleFit(set, bar, plate)}>{plate}</button
					>
				{/each}
			</div>
		</div>
		<button
			type="button"
			class={button}
			disabled={set.bars.length === 1}
			onclick={() => removeBar(set, bar)}
		>
			Remove {bar.name}
		</button>
	</fieldset>
{/snippet}

<div class="flex flex-col gap-2" data-testid="equipment-sets">
	<p class="text-sm">Equipment sets</p>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Where you lift: its bars and how many plates of each size you have. Copy the commercial gym or
		start a new set for a home gym.
	</p>

	<div
		class="flex flex-col rounded-xl bg-white/60 px-3 py-2 dark:bg-gray-800/60"
		data-testid="set-{COMMERCIAL_GYM}"
	>
		<span class="font-medium">
			Commercial gym ({settings.lifting.unit}){settings.lifting.activeSet === COMMERCIAL_GYM
				? ' · in use'
				: ''}
		</span>
		<span class="text-sm text-gray-600 dark:text-gray-400">
			{commercialGym(settings.lifting.unit).bars[0].name} · every plate, no limits · built in
		</span>
	</div>

	{#each sets as set (set.id)}
		<details
			class="rounded-xl bg-white/60 dark:bg-gray-800/60"
			data-testid="set-{set.id}"
			bind:open={open[set.id]}
		>
			<summary class="flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2">
				<span class="font-medium">
					{set.name} ({set.unit}){settings.lifting.activeSet === set.id ? ' · in use' : ''}
				</span>
				<span class="text-sm text-gray-600 dark:text-gray-400">{describe(set)}</span>
			</summary>
			<div class="flex flex-col gap-4 px-3 pb-3">
				<label class="flex flex-col gap-1 text-sm">
					<span>Set name</span>
					<input
						class={field}
						value={drafts[`${set.id}:name`] ?? set.name}
						aria-invalid={errors[`${set.id}:name`] ? 'true' : undefined}
						onchange={(e) => rename(set, e.currentTarget)}
					/>
				</label>
				{@render error(`${set.id}:name`)}

				<fieldset class="flex flex-col gap-2 text-sm">
					<legend class="mb-1 font-medium">Plates you have ({set.unit}, in total)</legend>
					<p class="text-gray-600 dark:text-gray-400">Leave blank for unlimited; 0 for none.</p>
					<div class="grid grid-cols-2 gap-2">
						{#each UNITS[set.unit].plates as plate (plate)}
							<div class="flex flex-col gap-1">
								{@render numberInput(
									`${set.id}:plates:${plate}`,
									`${formatWeight(plate, set.unit)} plates`,
									// null is unlimited (a blank field); a missing size is none.
									set.plates[plate] === undefined ? 0 : set.plates[plate],
									'Unlimited',
									'plateCount',
									set.unit,
									{ value: null },
									(v) => (set.plates[plate] = v as number | null)
								)}
							</div>
						{/each}
					</div>
				</fieldset>

				<div class="flex flex-col gap-2">
					<p class="text-sm font-medium">Bars</p>
					{#each set.bars as bar (bar.id)}
						{@render barEditor(set, bar)}
					{/each}
					<button
						type="button"
						class={button}
						disabled={set.bars.length >= SETUP_LIMITS.maxBars}
						onclick={() => addBar(set)}
					>
						Add a bar
					</button>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						class={button}
						disabled={atLimit}
						aria-label="Copy {set.name}"
						onclick={() => duplicate(set)}
					>
						Copy set
					</button>
					<button
						type="button"
						class={button}
						aria-label="Delete {set.name}"
						onclick={() => (confirmingDelete = set.id)}
					>
						Delete set
					</button>
				</div>
				{#if confirmingDelete === set.id}
					<div class="flex flex-col gap-2 rounded-xl bg-red-50 p-3 text-sm dark:bg-red-950">
						<p>Delete {set.name} and its bars and plates?</p>
						<div class="grid grid-cols-2 gap-2">
							<button type="button" class={button} onclick={() => (confirmingDelete = null)}>
								Keep it
							</button>
							<button
								type="button"
								class="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white active:bg-red-700"
								onclick={() => remove(set)}
							>
								Delete
							</button>
						</div>
					</div>
				{/if}
			</div>
		</details>
	{/each}

	{#if creating}
		<div class="flex flex-col gap-3 rounded-xl bg-white/60 p-3 dark:bg-gray-800/60">
			<label class="flex flex-col gap-1 text-sm">
				<span>New set name</span>
				<input class={field} placeholder="Home gym" bind:value={newName} />
			</label>
			<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="New set units">
				{#each WEIGHT_UNITS as unit (unit)}
					<button
						type="button"
						role="radio"
						aria-checked={newUnit === unit}
						class={toggleClass(newUnit === unit)}
						onclick={() => (newUnit = unit)}
					>
						{unit === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
					</button>
				{/each}
			</div>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				A set's units can't change later: its plates are what they are.
			</p>
			<div class="grid grid-cols-2 gap-2">
				<button type="button" class={button} onclick={() => (creating = false)}>Cancel</button>
				<button
					type="button"
					class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white active:bg-blue-700"
					onclick={create}
				>
					Add set
				</button>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class={button}
				disabled={atLimit}
				onclick={() => {
					newUnit = settings.lifting.unit;
					creating = true;
				}}
			>
				New set
			</button>
			<button
				type="button"
				class={button}
				disabled={atLimit}
				onclick={() => duplicate(commercialGym(settings.lifting.unit))}
			>
				Copy Commercial gym
			</button>
		</div>
	{/if}
</div>
