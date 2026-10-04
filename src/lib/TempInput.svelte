<script lang="ts">
	import { untrack } from 'svelte';
	import { fromF, toF, type TempUnit } from '$lib/utils/oven';

	/** A temperature field shown in `unit` but read and written in °F, so switching units keeps it. */
	let {
		label,
		valueF = $bindable(),
		unit,
		onedit
	}: {
		label: string;
		valueF: number;
		unit: TempUnit;
		/** Called when the user types in the field (not when the value changes from outside). */
		onedit?: () => void;
	} = $props();

	const display = () => (Number.isFinite(valueF) ? String(Math.round(fromF(valueF, unit))) : '');

	// What the field shows. While it has focus it keeps exactly what was typed (so "350.5" isn't
	// rounded under the cursor); otherwise it follows the value and unit, rounded.
	let text = $state(untrack(display));
	let focused = $state(false);
	$effect(() => {
		const next = display();
		if (!focused) text = next;
	});
</script>

<label class="flex flex-col gap-1 text-sm">
	<span>{label} (°{unit})</span>
	<input
		type="number"
		inputmode="decimal"
		step="any"
		value={text}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		oninput={(e) => {
			text = e.currentTarget.value;
			valueF = text === '' ? NaN : toF(Number(text), unit);
			onedit?.();
		}}
		class="rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
	/>
</label>
