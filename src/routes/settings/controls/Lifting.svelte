<script lang="ts">
	/** Settings → Tool defaults: the weightlifting calculator's units and equipment sets. */
	import EquipmentSets from '../EquipmentSets.svelte';
	import { segmented } from '$lib/segmented';
	import { settings } from '$lib/settings.svelte';
	import { COMMERCIAL_GYM, WEIGHT_UNITS } from '$lib/utils/lifting';
</script>

<!-- Spaced from the tool above it in Tool defaults. -->
<div class="flex flex-col gap-3 not-first-of-type:mt-2">
	<h3 class="font-semibold">Weightlifting Calculator</h3>
	<div
		class="grid grid-cols-2 gap-2"
		role="radiogroup"
		use:segmented
		aria-label="Weightlifting units"
	>
		{#each WEIGHT_UNITS as unit (unit)}
			<button
				type="button"
				role="radio"
				aria-checked={settings.lifting.unit === unit}
				class="rounded-xl px-3 py-2 text-sm font-medium {settings.lifting.unit === unit
					? 'bg-blue-600 text-white'
					: 'bg-white/70 hover:not-disabled:bg-white active:bg-white dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700'}"
				onclick={() => (settings.lifting.unit = unit)}
			>
				{unit === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
			</button>
		{/each}
	</div>
	<label id="equipment" class="flex scroll-mt-20 flex-col gap-1 text-sm">
		<span>Equipment set</span>
		<select
			class="rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
			value={settings.lifting.activeSet}
			onchange={(e) => (settings.lifting.activeSet = e.currentTarget.value)}
		>
			<option value={COMMERCIAL_GYM}>Commercial gym ({settings.lifting.unit})</option>
			{#each settings.lifting.sets as set (set.id)}
				<option value={set.id}>{set.name} ({set.unit})</option>
			{/each}
		</select>
	</label>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		The calculator loads from this set. The commercial gym uses the units above; your own sets have
		their own.
	</p>
	<EquipmentSets />
</div>
