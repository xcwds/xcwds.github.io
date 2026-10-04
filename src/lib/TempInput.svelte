<script lang="ts">
	import { fromF, toF, type TempUnit } from '$lib/utils/oven';

	/** A temperature field shown in `unit` but read and written in °F, so switching units keeps it. */
	let {
		label,
		valueF = $bindable(),
		unit
	}: { label: string; valueF: number; unit: TempUnit } = $props();

	let shown = $derived(Number.isFinite(valueF) ? Math.round(fromF(valueF, unit)) : '');
</script>

<label class="flex flex-col gap-1 text-sm">
	<span>{label} (°{unit})</span>
	<input
		type="number"
		inputmode="numeric"
		step="5"
		value={shown}
		oninput={(e) => {
			const raw = e.currentTarget.value;
			valueF = raw === '' ? NaN : toF(Number(raw), unit);
		}}
		class="rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
	/>
</label>
