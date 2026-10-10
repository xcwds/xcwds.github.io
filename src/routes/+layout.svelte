<script lang="ts">
	import OfflineNotice from '@xcwds/plugin-offline/OfflineNotice.svelte';
	import Shell from '@xcwds/plugin-shell/Shell.svelte';
	import PluginTimerAlert from '@xcwds/plugin-timers/TimerAlert.svelte';
	import UpdateBanner from '@xcwds/plugin-update/UpdateBanner.svelte';
	import { App, settings as appSettings } from '@xcwds/sveltekit';
	import { onMount } from 'svelte';
	import BackOnline from '$lib/BackOnline.svelte';
	import TimerAlert from '$lib/TimerAlert.svelte';
	import { startShortcuts } from '$lib/home.svelte';
	import { startInstallSupport } from '$lib/install.svelte';
	import { startSettings } from '$lib/settings.svelte';
	import { provideCoffeeTimer } from '$lib/utils/coffee-timer.svelte';
	import { provideCookingTimers } from '$lib/utils/cooking-timers.svelte';
	import '../app.css';

	let { children } = $props();

	// Timers live here, not in their pages, so they keep counting and ring on every page (#66).
	provideCookingTimers();
	provideCoffeeTimer();

	// The app's reactive settings follow the kernel's once saved ones have loaded.
	$effect(() => {
		if (appSettings.ready) startSettings();
	});

	onMount(() => {
		startShortcuts();
		startInstallSupport();
	});
</script>

<App>
	<Shell>
		{@render children()}
		{#snippet notices()}
			<PluginTimerAlert openLabel="Open Cooking Timer" />
			<TimerAlert />
			<UpdateBanner />
			<OfflineNotice />
			<BackOnline />
		{/snippet}
	</Shell>
</App>
