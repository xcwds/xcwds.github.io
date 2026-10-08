<script lang="ts">
	import { settings } from '$lib/settings.svelte';
	import {
		SETUP_LIMITS,
		UNITS,
		findEquipment,
		formatWeight,
		kind,
		type Equipment,
		type EquipmentId,
		type EquipmentSetup
	} from '$lib/utils/lifting';

	/**
	 * Your own bars, handles and their limits for the weightlifting calculator (#71). A blank field
	 * keeps the commercial-gym default; numbers are saved once they're valid (on change, like the
	 * other tool defaults), and an invalid one shows why next to it instead.
	 */

	type NumberField = 'bar' | 'maxLoad' | 'maxPlatesPerSide';

	let unit = $derived(settings.lifting.unit);
	let setups = $derived(settings.lifting.setups[unit]);
	let errors = $state<Record<string, string>>({});
	/** Text that couldn't be saved, kept in its field (next to the error) until it's fixed. */
	let drafts = $state<Record<string, string>>({});

	const weight = (w: number) => formatWeight(w, unit);

	function save(id: EquipmentId, next: EquipmentSetup) {
		const clean = Object.fromEntries(
			Object.entries(next).filter(([, v]) => v !== undefined)
		) as EquipmentSetup;
		if (Object.keys(clean).length) settings.lifting.setups[unit][id] = clean;
		else delete settings.lifting.setups[unit][id];
	}

	/** Why `value` can't be saved for `field` ('' when it can). Mirrors `parseEquipmentSetup`. */
	function problem(field: NumberField, value: number | undefined): string {
		if (value === undefined) return '';
		if (field === 'maxPlatesPerSide')
			return Number.isInteger(value) && value >= 1 && value <= SETUP_LIMITS.maxPlatesPerSide
				? ''
				: `Enter a whole number from 1 to ${SETUP_LIMITS.maxPlatesPerSide}.`;
		if (!(value >= 0 && value <= SETUP_LIMITS.maxWeight))
			return `Enter a weight from 0 to ${weight(SETUP_LIMITS.maxWeight)}.`;
		return '';
	}

	function setNumber(id: EquipmentId, field: NumberField, input: HTMLInputElement) {
		const key = `${id}:${field}`;
		const text = input.value.trim();
		const next = { ...setups[id], [field]: text === '' ? undefined : Number(text) };
		const error = input.validity.badInput ? 'Enter a number.' : problem(field, next[field]);
		errors[key] = error;
		if (error) {
			drafts[key] = input.value;
			return;
		}
		delete drafts[key];
		save(id, next);
	}

	function togglePlate(id: EquipmentId, plate: number) {
		const sizes = UNITS[unit].plates;
		const fit = setups[id]?.plates ?? sizes;
		const next = fit.includes(plate)
			? fit.filter((p) => p !== plate)
			: sizes.filter((p) => p === plate || fit.includes(p));
		save(id, { ...setups[id], plates: next.length === sizes.length ? undefined : next });
	}

	function reset(id: EquipmentId) {
		delete settings.lifting.setups[unit][id];
		for (const field of ['bar', 'maxLoad', 'maxPlatesPerSide']) {
			errors[`${id}:${field}`] = '';
			delete drafts[`${id}:${field}`];
		}
	}

	const noun = (e: Equipment) => (kind(e) === 'bar' ? 'bar' : 'handle');

	/** One line for the closed row: "35 lb bar · max 300 lb · 4 plates per side · 10, 5 only". */
	function describe(e: Equipment): string {
		const parts = [`${weight(e.bar)} ${noun(e)}`];
		if (e.maxLoad !== undefined)
			parts.push(`max load ${weight(e.maxLoad)}${e.count === 2 ? ' each' : ''}`);
		if (e.maxPlatesPerSide !== undefined)
			parts.push(`${e.maxPlatesPerSide} ${e.sides === 1 ? 'on the post' : 'per side'}`);
		if (e.plates) parts.push(e.plates.length ? `${e.plates.join(', ')} only` : 'no plates');
		return parts.join(' · ');
	}

	const field =
		'rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
	const button =
		'rounded-xl bg-white/70 px-3 py-2 font-medium active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:active:bg-gray-700';
</script>

{#snippet numberInput(
	id: EquipmentId,
	name: NumberField,
	label: string,
	placeholder: string,
	step: string
)}
	{@const error = errors[`${id}:${name}`]}
	<label class="flex flex-col gap-1 text-sm">
		<span>{label}</span>
		<input
			type="number"
			inputmode="decimal"
			min={name === 'maxPlatesPerSide' ? 1 : 0}
			{step}
			class={field}
			{placeholder}
			value={drafts[`${id}:${name}`] ?? setups[id]?.[name] ?? ''}
			aria-invalid={error ? 'true' : undefined}
			onchange={(e) => setNumber(id, name, e.currentTarget)}
		/>
	</label>
	{#if error}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>
	{/if}
{/snippet}

<div id="equipment" class="flex scroll-mt-20 flex-col gap-2">
	<p class="text-sm">Your equipment ({unit})</p>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		For a home gym: set your own bar weights, how much each one takes and which plates fit. Blank
		fields keep the commercial-gym default.
	</p>
	{#each UNITS[unit].equipment as base (base.id)}
		{@const item = findEquipment(unit, base.id, settings.lifting.setups)}
		{@const setup = setups[base.id]}
		<details class="rounded-xl bg-white/60 dark:bg-gray-800/60" data-testid="setup-{base.id}">
			<summary class="flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2">
				<span class="font-medium">{base.id.startsWith('barbell') ? item.name : base.name}</span>
				<span class="text-sm text-gray-600 dark:text-gray-400">
					{setup ? describe(item) : 'Standard'}
				</span>
			</summary>
			<div class="flex flex-col gap-3 px-3 pb-3">
				{@render numberInput(
					base.id,
					'bar',
					`${noun(base) === 'bar' ? 'Bar' : 'Handle'} weight (${unit})`,
					String(base.bar),
					'any'
				)}
				{@render numberInput(
					base.id,
					'maxLoad',
					`Max load (${unit} of plates${base.count === 2 ? ', per dumbbell' : ''})`,
					'No limit',
					'any'
				)}
				{@render numberInput(
					base.id,
					'maxPlatesPerSide',
					base.sides === 1 ? 'Max plates on the post' : 'Max plates per side',
					'No limit',
					'1'
				)}
				<fieldset class="flex flex-col gap-1 text-sm">
					<legend class="mb-1">Plates that fit</legend>
					<div class="flex flex-wrap gap-2">
						{#each UNITS[unit].plates as plate (plate)}
							{@const on = !setup?.plates || setup.plates.includes(plate)}
							<button
								type="button"
								aria-pressed={on}
								aria-label="{plate} {unit} fits"
								class="rounded-xl px-3 py-2 text-sm font-medium {on
									? 'bg-blue-600 text-white'
									: 'bg-white/70 active:bg-white dark:bg-gray-800 dark:active:bg-gray-700'}"
								onclick={() => togglePlate(base.id, plate)}>{plate}</button
							>
						{/each}
					</div>
				</fieldset>
				<button type="button" class={button} disabled={!setup} onclick={() => reset(base.id)}>
					Back to standard
				</button>
			</div>
		</details>
	{/each}
</div>
