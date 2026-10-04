<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import PlateCalculator from './PlateCalculator.svelte';
	import WorkoutTracker from './Workout.svelte';
	import { toggle } from './styles';

	const TAB_KEY = 'lifting-tab';
	let tab = $state<'plates' | 'workout'>('plates');
	let total = $state(0);

	onMount(() => {
		try {
			if (localStorage.getItem(TAB_KEY) === 'workout') tab = 'workout';
		} catch {
			// Default tab.
		}
	});

	function show(next: 'plates' | 'workout') {
		tab = next;
		try {
			localStorage.setItem(TAB_KEY, next);
		} catch {
			// Not remembered; fine.
		}
	}
</script>

<svelte:head>
	<title>Weightlifting Calculator</title>
</svelte:head>

<main class="mx-auto flex max-w-md flex-col gap-6 p-4 text-gray-800 sm:p-8 dark:text-gray-200">
	<a href={resolve('/utils')} class="text-sm text-gray-600 hover:underline dark:text-gray-400">
		← Utils
	</a>
	<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">🏋️ Weightlifting</h1>

	<div class="grid grid-cols-2 gap-2" role="tablist">
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'plates'}
			class="{toggle(tab === 'plates')} py-3 text-base"
			onclick={() => show('plates')}>Plates</button
		>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'workout'}
			class="{toggle(tab === 'workout')} py-3 text-base"
			onclick={() => show('workout')}>Workout</button
		>
	</div>

	<!-- Both stay mounted so the calculator total is available to the workout tab. -->
	<div hidden={tab !== 'plates'}><PlateCalculator bind:total /></div>
	<div hidden={tab !== 'workout'}><WorkoutTracker calculatorWeight={total} /></div>
</main>
