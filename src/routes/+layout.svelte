<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { startUpdateChecks } from '$lib/app-update.svelte';
	import { startInstallSupport } from '$lib/install.svelte';
	import { startNetworkStatus } from '$lib/network.svelte';
	import OfflineNotice from '$lib/OfflineNotice.svelte';
	import TimerAlert from '$lib/TimerAlert.svelte';
	import Toaster from '$lib/Toaster.svelte';
	import UpdateBanner from '$lib/UpdateBanner.svelte';
	import { activeSection, errorInfo, routeInfo, sections } from '$lib/nav';
	import { recordVisit, startShortcuts } from '$lib/home.svelte';
	import { startSettings } from '$lib/settings.svelte';
	import { provideCoffeeTimer } from '$lib/utils/coffee-timer.svelte';
	import { provideCookingTimers } from '$lib/utils/cooking-timers.svelte';
	import '../app.css';

	let { children } = $props();

	// Timers live here, not in their pages, so they keep counting and ring on every page (#66).
	provideCookingTimers();
	provideCoffeeTimer();

	let info = $derived(page.error ? errorInfo(page.status) : routeInfo(page.url.pathname));
	let active = $derived(activeSection(page.url.pathname));
	let parentLabel = $derived(sections.find((s) => s.path === info.parent)?.label ?? 'Home');

	// Tools opened become "Recently used" on Home (error pages and non-tools are ignored).
	afterNavigate(({ to }) => {
		startShortcuts();
		if (to && !page.error) recordVisit(to.url.pathname);
	});

	// Lets e2e tests wait until inputs are interactive (see e2e/helpers.ts).
	onMount(() => {
		startSettings();
		void startUpdateChecks();
		startNetworkStatus();
		startInstallSupport();
		document.documentElement.dataset.hydrated = '';
	});
</script>

<div class="min-h-svh bg-blue-200 dark:bg-gray-950">
	<!-- Not sticky: long recipe titles wrap, and the tab bar keeps navigation in reach. -->
	<header class="pt-[env(safe-area-inset-top)]">
		<div class="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
			{#if info.parent}
				<a
					href={resolve(info.parent)}
					aria-label="Back to {parentLabel}"
					class="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-white/60 dark:text-gray-300 dark:hover:bg-gray-800"
				>
					<svg
						viewBox="0 0 24 24"
						class="size-6"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</a>
			{/if}
			<h1
				class="min-w-0 flex-1 text-xl font-semibold text-balance text-gray-900 dark:text-gray-100"
			>
				{#if info.emoji}<span aria-hidden="true">{info.emoji}</span>{/if}
				{info.title}
			</h1>
			<nav aria-label="Main" class="hidden gap-1 md:flex">
				{#each sections as section (section.path)}
					<a
						href={resolve(section.path)}
						aria-current={active === section.path ? 'page' : undefined}
						class="rounded-full px-3 py-1.5 text-sm font-medium {active === section.path
							? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100'
							: 'text-gray-700 hover:bg-white/60 dark:text-gray-300 dark:hover:bg-gray-800'}"
					>
						{section.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<div class="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
		{@render children()}
	</div>

	<!-- Finished timers, toasts, the update banner and the offline notice stack above the tab bar
	     (top on desktop). -->
	<div
		class="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2 px-4 md:top-4 md:bottom-auto"
	>
		<TimerAlert />
		<Toaster />
		<UpdateBanner />
		<OfflineNotice />
	</div>

	<nav
		aria-label="Main"
		class="fixed inset-x-0 bottom-0 z-10 border-t border-black/5 bg-blue-100/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-white/10 dark:bg-gray-900/95"
	>
		<ul class="mx-auto grid max-w-md" style="grid-template-columns: repeat({sections.length}, 1fr)">
			{#each sections as section (section.path)}
				<li>
					<a
						href={resolve(section.path)}
						aria-current={active === section.path ? 'page' : undefined}
						class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium {active ===
						section.path
							? 'text-blue-700 dark:text-blue-400'
							: 'text-gray-600 dark:text-gray-400'}"
					>
						<span aria-hidden="true" class="text-xl {active === section.path ? '' : 'opacity-70'}"
							>{section.emoji}</span
						>
						{section.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
