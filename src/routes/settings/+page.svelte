<script lang="ts">
	/**
	 * Settings is @xcwds/plugin-settings' page: the fields with a `control` (theme, navigation,
	 * timer alarms), the app's own controls below, Install and What's new, Your data, Privacy and
	 * About. The app adds its acronym (and the Easter egg) to About.
	 */
	import { onDestroy } from 'svelte';
	import SettingsPage from '@xcwds/plugin-settings/SettingsPage.svelte';
	import { useApp } from '@xcwds/sveltekit';
	import Acronym from '#lib/Acronym.svelte';
	import { ACRONYM, SECRET_ACRONYM } from '#lib/brand.js';
	import Coffee from './controls/Coffee.svelte';
	import CookingPresets from './controls/CookingPresets.svelte';
	import Lifting from './controls/Lifting.svelte';
	import OvenUnit from './controls/OvenUnit.svelte';
	import PizzaDefaults from './controls/PizzaDefaults.svelte';
	import RecipeUnits from './controls/RecipeUnits.svelte';
	import WeekStart from './controls/WeekStart.svelte';

	// The app's fields have no `control`: these components show them. Registered before the page
	// renders, so the prerendered page has them too.
	const page = useApp().settingsPage;
	const stops = Object.entries({
		weekStart: WeekStart,
		lifting: Lifting,
		coffeeDefaultSeconds: Coffee,
		cookingPresets: CookingPresets,
		pizzaDefaults: PizzaDefaults,
		recipeUnits: RecipeUnits,
		ovenUnit: OvenUnit
	}).map(([name, component]) => page?.control(name, component));
	onDestroy(() => stops.forEach((stop) => stop?.()));

	// Easter egg: every third tap on the acronym flips it to the secret one and back.
	let acronymTaps = $state(0);
	let secret = $derived(Math.floor(acronymTaps / 3) % 2 === 1);
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<main class="page-split pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<SettingsPage {about} />
</main>

{#snippet about()}
	<p class="text-sm">
		<button
			type="button"
			class="text-left"
			data-testid="about-acronym"
			onclick={() => acronymTaps++}
		>
			<Acronym phrase={secret ? SECRET_ACRONYM : ACRONYM} />{#if secret}
				<span aria-hidden="true" class="ml-1">🧇🏋️🧼</span>{/if}
		</button>
	</p>
{/snippet}
