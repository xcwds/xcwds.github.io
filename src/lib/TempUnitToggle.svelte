<script lang="ts">
	import { settings } from '$lib/settings.svelte';
	import { TEMP_UNITS } from '$lib/utils/oven';
</script>

<!-- The oven converter's unit (a tool default in Settings); recipes' oven panel shares it. -->
<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Temperature units">
	{#each TEMP_UNITS as unit (unit)}
		<button
			type="button"
			role="radio"
			aria-checked={settings.ovenUnit === unit}
			class="rounded-xl px-3 py-2 text-sm font-medium {settings.ovenUnit === unit
				? 'bg-blue-600 text-white'
				: 'bg-white/70 active:bg-white dark:bg-gray-800 dark:active:bg-gray-700'}"
			onclick={() => (settings.ovenUnit = unit)}
		>
			{unit === 'F' ? 'Fahrenheit (°F)' : 'Celsius (°C)'}
		</button>
	{/each}
</div>
