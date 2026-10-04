<script lang="ts">
	import { persist } from '$lib/persist.svelte';
	import { entries } from '$lib/storage';
	import PlateCalculator from './PlateCalculator.svelte';
	import WorkoutTracker from './Workout.svelte';
	import { toggle } from './styles';

	let tab = $state<'plates' | 'workout'>('plates');
	let total = $state(0);

	persist(
		entries.liftingTab,
		() => tab,
		(saved) => (tab = saved)
	);

	function show(next: 'plates' | 'workout') {
		tab = next;
	}
</script>

<svelte:head>
	<title>Weightlifting Calculator</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
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
