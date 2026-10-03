<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { buildLink, parseLink, readParams, type Param } from '$lib/utils/url';

	let input = $state('');
	let url = $state<URL | null>(null);
	let params = $state<Param[]>([]);
	let copied = $state(false);
	let canPaste = $state(false);
	let canShare = $state(false);

	let cleaned = $derived(url ? buildLink(url, params) : '');
	let removed = $derived(params.filter((p) => !p.keep).length);
	let trackingKept = $derived(params.filter((p) => p.tracking && p.keep).length);
	let invalid = $derived(input.trim() !== '' && !url);

	onMount(() => {
		canPaste = typeof navigator.clipboard?.readText === 'function';
		canShare = typeof navigator.share === 'function';
	});

	function load(text: string) {
		input = text;
		url = parseLink(text);
		params = url ? readParams(url) : [];
		copied = false;
	}

	async function paste() {
		try {
			load(await navigator.clipboard.readText());
		} catch {
			// Permission denied; the user can still paste into the box.
		}
	}

	function setAll(keep: (param: Param) => boolean) {
		for (const param of params) param.keep = keep(param);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(cleaned);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked; the link is selectable below.
		}
	}

	async function share() {
		try {
			await navigator.share({ url: cleaned });
		} catch {
			// Share sheet dismissed.
		}
	}

	const nestedLink = (value: string) => (/^https?:\/\//i.test(value) ? parseLink(value) : null);

	const button =
		'rounded-xl bg-white/70 px-3 py-2 font-medium active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:active:bg-gray-700';
	const primary =
		'rounded-xl bg-blue-600 px-3 py-3 text-lg font-semibold text-white active:bg-blue-700';
	const field =
		'w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
</script>

<svelte:head>
	<title>URL Sanitizer</title>
</svelte:head>

<main class="mx-auto flex max-w-xl flex-col gap-6 p-4 text-gray-800 sm:p-8 dark:text-gray-200">
	<a href={resolve('/utils')} class="text-sm text-gray-600 hover:underline dark:text-gray-400">
		← Utils
	</a>
	<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">🧼 URL Sanitizer</h1>

	<section class="flex flex-col gap-2">
		<label for="link" class="text-sm">Paste a link</label>
		<textarea
			id="link"
			rows="3"
			value={input}
			oninput={(e) => load(e.currentTarget.value)}
			placeholder="https://example.com/page?utm_source=…"
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
			class="{field} text-base break-all"
		></textarea>
		<div class="flex gap-2">
			{#if canPaste}
				<button type="button" class="{button} flex-1" onclick={paste}>Paste</button>
			{/if}
			<button type="button" class="{button} flex-1" onclick={() => load('')} disabled={!input}>
				Clear
			</button>
		</div>
		{#if invalid}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">
				That doesn't look like a link.
			</p>
		{/if}
	</section>

	{#if url}
		<section
			class="flex flex-col gap-3 rounded-2xl bg-white/80 p-4 dark:bg-gray-900"
			aria-label="Clean link"
		>
			<h2 class="text-lg font-semibold">Clean link</h2>
			<p class="text-base break-all" data-testid="cleaned">{cleaned}</p>
			<div class="grid gap-2 {canShare ? 'grid-cols-3' : 'grid-cols-2'}">
				<button type="button" class={primary} onclick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
				{#if canShare}
					<button type="button" class={primary} onclick={share}>Share</button>
				{/if}
				<a
					href={cleaned}
					target="_blank"
					rel="noopener noreferrer external"
					class="{button} flex items-center justify-center text-lg">Open</a
				>
			</div>
			{#if trackingKept}
				<p class="text-sm text-amber-800 dark:text-amber-300">
					{trackingKept} known tracking {trackingKept === 1 ? 'param is' : 'params are'} still in the
					link.
				</p>
			{/if}
		</section>

		{#if params.length}
			<section class="flex flex-col gap-3">
				<div class="flex items-baseline justify-between">
					<h2 class="text-lg font-semibold">Params</h2>
					<span class="text-sm text-gray-600 dark:text-gray-400">
						{removed} of {params.length} removed
					</span>
				</div>
				<div class="grid grid-cols-3 gap-2 text-sm">
					<button type="button" class={button} onclick={() => setAll((p) => !p.tracking)}>
						Remove tracking
					</button>
					<button type="button" class={button} onclick={() => setAll(() => false)}>
						Remove all
					</button>
					<button type="button" class={button} onclick={() => setAll(() => true)}>Keep all</button>
				</div>

				<ul class="flex flex-col gap-2">
					{#each params as param (param.id)}
						{@const nested = nestedLink(param.value)}
						<li
							class="flex flex-col gap-2 rounded-xl p-3 {param.keep
								? 'bg-white/80 dark:bg-gray-900'
								: 'bg-white/30 dark:bg-gray-900/40'}"
							data-testid="param"
						>
							<div class="flex items-center gap-2">
								<label class="flex items-center gap-2">
									<input type="checkbox" bind:checked={param.keep} class="size-5" />
									<span class="sr-only">Keep {param.key}</span>
								</label>
								<input
									aria-label="Name"
									bind:value={param.key}
									autocapitalize="off"
									spellcheck="false"
									class="{field} font-mono text-sm {param.keep ? '' : 'line-through opacity-60'}"
								/>
								{#if param.tracking}
									<span
										class="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-800 dark:text-amber-100"
									>
										tracking
									</span>
								{/if}
							</div>
							<input
								aria-label="Value of {param.key}"
								bind:value={param.value}
								autocapitalize="off"
								spellcheck="false"
								class="{field} font-mono text-sm {param.keep ? '' : 'line-through opacity-60'}"
							/>
							{#if nested}
								<button type="button" class="{button} text-sm" onclick={() => load(nested.href)}>
									This is a link to {nested.hostname} — clean that instead
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="text-sm text-gray-600 dark:text-gray-400">This link has no query params.</p>
		{/if}
	{/if}

	<p class="text-sm text-gray-600 dark:text-gray-400">
		Known tracking params are removed automatically; tap a checkbox to put one back. Edit a name or
		value to change it. Everything happens in your browser — links are never sent anywhere.
	</p>
</main>
