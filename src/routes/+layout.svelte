<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.ico';
	import '../app.css';

	let { children } = $props();

	// Lets e2e tests wait until inputs are interactive (see e2e/helpers.ts).
	onMount(() => {
		document.documentElement.dataset.hydrated = '';
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="bg-blue-200 dark:bg-gray-950 min-h-svh">
	{@render children()}
</div>
