<script lang="ts">
	/**
	 * QR codes (#211): scan a code (camera or image) without a scanner app logging it, see where a
	 * link really goes with its trackers removed before opening it, and show any text as a code.
	 * Made and read on the device by @xcwds/plugin-qr; nothing is saved (no scan history).
	 */
	import QrCode from '@xcwds/plugin-qr/QrCode.svelte';
	import QrScanner from '@xcwds/plugin-qr/QrScanner.svelte';
	import { encodeQr, saveQr } from '@xcwds/plugin-qr/make';
	import { scan, type ScanResult } from '@xcwds/plugin-qr/scan';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from '$lib/toast.svelte';
	import { cleanLink, textFromFragment } from '$lib/utils/qr';
	import { button, card, field, primary } from '../weightlifting/styles';

	/** The last code read; null when an image had none. Shown, never opened by itself. */
	let found = $state<ScanResult | null>();
	let reading = $state(false);
	let error = $state('');
	let picker = $state<HTMLInputElement>();
	let canShare = $state(false);
	/** What "Make a code" shows. */
	let text = $state('');

	let cleaned = $derived(found?.kind === 'url' ? cleanLink(found.text) : null);
	let fits = $derived.by(() => {
		try {
			encodeQr(text);
			return true;
		} catch {
			return false;
		}
	});

	/** Text to show as a code, from the URL sanitizer's "Show as QR code" (`#text=…`). */
	function fromFragment() {
		const shared = textFromFragment(location.hash);
		if (shared === null) return;
		text = shared;
		// Off the address bar and out of history, like a link shared in.
		replaceState(resolve('/utils/qr'), {});
	}

	onMount(() => {
		canShare = typeof navigator.share === 'function';
		fromFragment();
		addEventListener('hashchange', fromFragment);
		return () => removeEventListener('hashchange', fromFragment);
	});

	function show(result: ScanResult | null) {
		error = '';
		found = result;
	}

	async function read(file: File | undefined) {
		if (!file) return;
		reading = true;
		error = '';
		found = undefined;
		try {
			show(await scan(file));
		} catch {
			error = "That image couldn't be read.";
		} finally {
			reading = false;
			if (picker) picker.value = '';
		}
	}

	async function copy(value: string, done: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast(done);
		} catch {
			toast("Couldn't copy. Select it and copy it instead.");
		}
	}

	async function share(url: string) {
		try {
			await navigator.share({ url });
		} catch {
			// Share sheet dismissed.
		}
	}

	async function download(format: 'svg' | 'png') {
		try {
			await saveQr(text, { format });
		} catch {
			toast("Couldn't make the file.");
		}
	}
</script>

<main class="page-narrow flex flex-col gap-6 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<section class="flex flex-col gap-3" aria-labelledby="scan-heading">
		<h2 id="scan-heading" class="text-lg font-semibold">Scan a code</h2>
		<QrScanner onResult={show} />
		<input
			bind:this={picker}
			type="file"
			accept="image/*"
			class="hidden"
			data-testid="qr-file"
			onchange={(e) => read(e.currentTarget.files?.[0])}
		/>
		<button
			type="button"
			class="{button} min-h-11 self-start"
			disabled={reading}
			onclick={() => picker?.click()}>{reading ? 'Reading…' : 'Scan from an image'}</button
		>
		{#if error}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>
		{:else if found === null}
			<p class="text-sm" data-testid="qr-result">No code found in that image.</p>
		{:else if found}
			<div class="{card} flex flex-col gap-3" data-testid="qr-result" data-kind={found.kind}>
				{#if found.kind === 'url' && cleaned}
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{#if cleaned.removed}
							Removed {cleaned.removed}
							{cleaned.removed === 1 ? 'tracker' : 'trackers'}{cleaned.via
								? `, and unwrapped it from ${cleaned.via}`
								: ''}. It opens only when you tap Open.
						{:else if cleaned.via}
							Unwrapped from {cleaned.via}. It opens only when you tap Open.
						{:else}
							No trackers found. It opens only when you tap Open.
						{/if}
					</p>
					<p class="text-base break-all" data-testid="qr-link">{cleaned.link}</p>
					{#if cleaned.link !== found.text}
						<details class="text-sm">
							<summary class="flex min-h-11 cursor-pointer items-center">What the code said</summary
							>
							<p class="break-all text-gray-600 dark:text-gray-400">{found.text}</p>
						</details>
					{/if}
					<div class="grid gap-2 {canShare ? 'grid-cols-3' : 'grid-cols-2'}">
						<a
							href={cleaned.link}
							target="_blank"
							rel="noopener noreferrer external"
							class="{primary} flex min-h-11 items-center justify-center">Open</a
						>
						<button
							type="button"
							class="{button} min-h-11"
							onclick={() => copy(cleaned!.link, 'Link copied.')}>Copy</button
						>
						{#if canShare}
							<button type="button" class="{button} min-h-11" onclick={() => share(cleaned!.link)}
								>Share</button
							>
						{/if}
					</div>
				{:else if found.kind === 'wifi' && found.wifi}
					<p class="text-sm text-gray-600 dark:text-gray-400">Wi-Fi network</p>
					<p class="text-lg font-semibold break-all" data-testid="qr-wifi">{found.wifi.ssid}</p>
					<p class="text-sm">
						{found.wifi.security === 'nopass'
							? 'Open network, no password'
							: found.wifi.security}{found.wifi.hidden ? ', hidden' : ''}
					</p>
					{#if found.wifi.password}
						<button
							type="button"
							class="{button} min-h-11 self-start"
							onclick={() => copy(found!.wifi!.password, 'Password copied.')}>Copy password</button
						>
					{/if}
				{:else}
					{#if found.kind === 'contact'}
						<p class="text-sm text-gray-600 dark:text-gray-400">
							Contact{found.name ? `: ${found.name}` : ''}
						</p>
					{/if}
					<p class="text-base break-all whitespace-pre-wrap" data-testid="qr-text">{found.text}</p>
					<button
						type="button"
						class="{button} min-h-11 self-start"
						onclick={() => copy(found!.text, 'Copied.')}>Copy</button
					>
				{/if}
			</div>
		{/if}
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="make-heading">
		<h2 id="make-heading" class="text-lg font-semibold">Make a code</h2>
		<label class="flex flex-col gap-1 text-sm">
			Text or link
			<textarea
				class="{field} text-base"
				rows="3"
				bind:value={text}
				placeholder="https://example.com"
				autocapitalize="off"
				autocomplete="off"
				spellcheck="false"></textarea>
		</label>
		{#if text}
			<QrCode value={text} class="w-64 max-w-full self-center rounded-xl" />
			{#if fits}
				<div class="flex gap-2 self-center">
					<button type="button" class="{button} min-h-11" onclick={() => download('svg')}
						>Download SVG</button
					>
					<button type="button" class="{button} min-h-11" onclick={() => download('png')}
						>Download PNG</button
					>
				</div>
			{/if}
		{/if}
	</section>
</main>
