<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { startUpdateChecks } from '$lib/app-update.svelte';
	import { install, startInstallSupport } from '$lib/install.svelte';
	import { startNetworkStatus } from '$lib/network.svelte';
	import OfflineNotice from '$lib/OfflineNotice.svelte';
	import TimerAlert from '$lib/TimerAlert.svelte';
	import Toaster from '$lib/Toaster.svelte';
	import UpdateBanner from '$lib/UpdateBanner.svelte';
	import { BRAND } from '$lib/brand';
	import { activeSection, errorInfo, pageWidth, routeInfo, sections } from '$lib/nav';
	import { recordVisit, startShortcuts } from '$lib/home.svelte';
	import { startSettings } from '$lib/settings.svelte';
	import { share, shareTarget } from '$lib/share';
	import { provideCoffeeTimer } from '$lib/utils/coffee-timer.svelte';
	import { provideCookingTimers } from '$lib/utils/cooking-timers.svelte';
	import '../app.css';

	let { children } = $props();

	// Timers live here, not in their pages, so they keep counting and ring on every page (#66).
	provideCookingTimers();
	provideCoffeeTimer();

	let info = $derived(page.error ? errorInfo(page.status) : routeInfo(page.url.pathname));
	let active = $derived(activeSection(page.url.pathname));
	/**
	 * The header lines up with the page's container (#95): wide pages from `md`, narrow ones only
	 * beside the sidebar, since the header links need more room than a narrow page has.
	 */
	let headerWidth = $derived(
		!page.error && pageWidth(page.url.pathname) === 'wide'
			? 'md:px-12'
			: 'sidebar:max-w-md sidebar:px-8'
	);
	let parentLabel = $derived(sections.find((s) => s.path === info.parent)?.label ?? 'Home');
	/**
	 * The installed app has no browser toolbar to share from, so it gets a Share button (#89); in
	 * a browser tab the browser's own share does the job.
	 */
	let shareable = $derived(install.installed && !page.error ? shareTarget(page.url) : null);

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
	<!-- Tablets and computers: a sidebar instead of the header links, per Settings → Appearance.
	     First in the DOM so keyboard users reach it before the page, like the header links. -->
	<nav
		aria-label="Main"
		class="fixed inset-y-0 left-0 z-10 hidden w-[calc(14rem+env(safe-area-inset-left))] flex-col gap-1 border-r border-black/5 bg-blue-100/95 pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-3 pb-3 pl-[calc(env(safe-area-inset-left)+0.75rem)] backdrop-blur sidebar:flex dark:border-white/10 dark:bg-gray-900/95"
	>
		<p class="px-3 py-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{BRAND}</p>
		<ul class="flex flex-col gap-1">
			{#each sections as section (section.path)}
				<li>
					<a
						href={resolve(section.path)}
						aria-current={active === section.path ? 'page' : undefined}
						class="flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium {active ===
						section.path
							? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100'
							: 'text-gray-700 hover:bg-white/60 dark:text-gray-300 dark:hover:bg-gray-800'}"
					>
						<span aria-hidden="true" class="text-xl">{section.emoji}</span>
						{section.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Not sticky: long recipe titles wrap, and the tab bar or sidebar keeps navigation in reach. -->
	<header class="pt-[env(safe-area-inset-top)] sidebar:pl-[calc(14rem+env(safe-area-inset-left))]">
		<div class="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 {headerWidth}">
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
			{#if shareable}
				{@const target = shareable}
				<button
					type="button"
					aria-label="Share {target.title}"
					class="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-white/60 md:order-last md:mr-0 dark:text-gray-300 dark:hover:bg-gray-800"
					onclick={() => share(target)}
				>
					<svg
						viewBox="0 0 24 24"
						class="size-6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path
							d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			{/if}
			<nav aria-label="Main" class="hidden gap-1 md:flex sidebar:hidden">
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

	<div
		class="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 sidebar:pl-[calc(14rem+env(safe-area-inset-left))]"
	>
		{@render children()}
	</div>

	<!-- Finished timers, toasts, the update banner and the offline notice stack above the tab bar
	     (top right on wider screens, clear of the page title). -->
	<div
		class="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2 px-4 md:top-[calc(1rem+env(safe-area-inset-top))] md:right-[calc(1rem+env(safe-area-inset-right))] md:bottom-auto md:left-auto md:w-full md:max-w-md md:items-end md:px-0"
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
