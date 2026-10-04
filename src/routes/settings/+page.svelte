<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/environment';
	import { reloadSettings, settings } from '$lib/settings.svelte';
	import {
		clear,
		defaultSettings,
		exportData,
		groups,
		importData,
		parseBackup,
		read,
		type Group,
		type ParsedBackup,
		type Theme
	} from '$lib/storage';

	const themes: { value: Theme; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	const toggles = [
		{ key: 'sound', label: 'Alarm sound', hint: 'Beep when a timer finishes.' },
		{ key: 'vibration', label: 'Vibration', hint: "Android only; iPhones don't allow it." },
		{ key: 'keepAwake', label: 'Keep screen on', hint: 'While a timer is running.' }
	] as const;

	let message = $state('');
	let pending = $state<Extract<ParsedBackup, { ok: true }> | null>(null);
	let importError = $state('');
	let canShareFiles = $state(false);
	// Bumped after imports and clears so "has data" re-checks storage.
	let dataVersion = $state(0);
	let fileInput: HTMLInputElement | undefined = $state();

	const hasData = (group: Group) => {
		void dataVersion;
		// Changed settings are saved by an effect after this runs, so compare in memory too.
		if (group.id === 'settings' && JSON.stringify(settings) !== JSON.stringify(defaultSettings))
			return true;
		return group.entries.some((e) => read(e) !== undefined);
	};
	let anyData = $derived(groups.some(hasData));

	const built = /^\d+$/.test(version)
		? new Date(Number(version)).toLocaleString(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short'
			})
		: version;

	onMount(() => {
		try {
			canShareFiles = navigator.canShare?.({ files: [backupFile()] }) ?? false;
		} catch {
			canShareFiles = false;
		}
	});

	function backupFile() {
		const now = new Date();
		const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
			.map((n) => String(n).padStart(2, '0'))
			.join('-');
		return new File([JSON.stringify(exportData(now), null, '\t')], `xcwds-backup-${date}.json`, {
			type: 'application/json'
		});
	}

	function download() {
		const file = backupFile();
		const url = URL.createObjectURL(file);
		const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		message = 'Backup downloaded.';
	}

	async function share() {
		try {
			await navigator.share({ files: [backupFile()], title: 'xcwds backup' });
			message = 'Backup shared.';
		} catch {
			// Share sheet dismissed.
		}
	}

	async function chooseFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		importError = '';
		pending = null;
		message = '';
		if (!file) return;
		const parsed = parseBackup(await file.text());
		if (parsed.ok) pending = parsed;
		else importError = parsed.error;
	}

	function apply(mode: 'replace' | 'merge') {
		if (!pending) return;
		const ok = importData(pending.backup, mode);
		const count = pending.found.length;
		pending = null;
		reloadSettings();
		dataVersion++;
		message = ok
			? `Imported ${count} ${count === 1 ? 'item' : 'items'}.`
			: 'Some data could not be saved (storage may be full or blocked).';
	}

	function clearGroup(group: Group) {
		if (!confirm(`Clear saved data for ${group.label}?`)) return;
		clear(group.entries);
		if (group.id === 'settings') reloadSettings();
		dataVersion++;
		message = `Cleared ${group.label}.`;
	}

	function clearAll() {
		if (!confirm('Clear all data saved by this app on this device? This cannot be undone.')) return;
		clear();
		reloadSettings();
		dataVersion++;
		message = 'All data cleared.';
	}

	const card = 'flex flex-col gap-3 rounded-2xl bg-white/80 p-4 dark:bg-gray-900';
	const button =
		'rounded-xl bg-white/70 px-3 py-2 font-medium active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:active:bg-gray-700';
	const primary =
		'rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white active:bg-blue-700 disabled:opacity-40';
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
>
	<section class={card} aria-labelledby="appearance">
		<h2 id="appearance" class="text-lg font-semibold">Appearance</h2>
		<div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
			{#each themes as theme (theme.value)}
				<button
					type="button"
					role="radio"
					aria-checked={settings.theme === theme.value}
					class="rounded-xl px-3 py-2 text-sm font-medium {settings.theme === theme.value
						? 'bg-blue-600 text-white'
						: 'bg-white/70 active:bg-white dark:bg-gray-800 dark:active:bg-gray-700'}"
					onclick={() => (settings.theme = theme.value)}
				>
					{theme.label}
				</button>
			{/each}
		</div>
	</section>

	<section class={card} aria-labelledby="timers">
		<h2 id="timers" class="text-lg font-semibold">Timers</h2>
		{#each toggles as toggle (toggle.key)}
			<label class="flex items-center justify-between gap-3">
				<span class="flex flex-col">
					<span class="font-medium">{toggle.label}</span>
					<span class="text-sm text-gray-600 dark:text-gray-400">{toggle.hint}</span>
				</span>
				<input type="checkbox" class="size-6 shrink-0" bind:checked={settings[toggle.key]} />
			</label>
		{/each}
	</section>

	<section class={card} aria-labelledby="data">
		<h2 id="data" class="text-lg font-semibold">Your data</h2>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Everything is saved only on this device. Back it up to move it to another phone or keep a
			copy.
		</p>

		<div class="grid gap-2 {canShareFiles ? 'grid-cols-2' : 'grid-cols-1'}">
			<button type="button" class={primary} onclick={download}>Download backup</button>
			{#if canShareFiles}
				<button type="button" class={primary} onclick={share}>Share backup</button>
			{/if}
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept="application/json,.json"
			class="hidden"
			aria-label="Backup file"
			onchange={chooseFile}
		/>
		<button type="button" class={button} onclick={() => fileInput?.click()}>Import backup…</button>

		{#if importError}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{importError}</p>
		{/if}

		{#if pending}
			<div
				class="flex flex-col gap-2 rounded-xl bg-blue-50 p-3 dark:bg-gray-800"
				data-testid="import-preview"
			>
				<p class="font-medium">
					Backup{pending.backup.exportedAt
						? ` from ${new Date(pending.backup.exportedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
						: ''}
				</p>
				{#if pending.found.length}
					<ul class="list-disc pl-5 text-sm">
						{#each pending.found as e (e.key)}
							<li>{e.label}</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm">It has no data this app can use.</p>
				{/if}
				{#if pending.skipped.length}
					<p class="text-sm text-amber-800 dark:text-amber-300">
						{pending.skipped.length} unrecognized or invalid {pending.skipped.length === 1
							? 'item'
							: 'items'} will be skipped.
					</p>
				{/if}
				<div class="grid grid-cols-2 gap-2 text-sm">
					<button
						type="button"
						class={primary}
						disabled={!pending.found.length}
						onclick={() => apply('merge')}
					>
						Merge
					</button>
					<button
						type="button"
						class={button}
						disabled={!pending.found.length}
						onclick={() => apply('replace')}
					>
						Replace everything
					</button>
				</div>
				<p class="text-xs text-gray-600 dark:text-gray-400">
					Merge keeps data that isn't in the backup. Replace clears everything first.
				</p>
				<button type="button" class="{button} text-sm" onclick={() => (pending = null)}
					>Cancel</button
				>
			</div>
		{/if}

		<h3 class="mt-2 font-semibold">Clear data</h3>
		<ul class="flex flex-col gap-2">
			{#each groups as group (group.id)}
				<li class="flex items-center justify-between gap-3">
					<span>{group.label}</span>
					<button
						type="button"
						class="{button} text-sm"
						disabled={!hasData(group)}
						aria-label="Clear {group.label}"
						onclick={() => clearGroup(group)}>Clear</button
					>
				</li>
			{/each}
		</ul>
		<button
			type="button"
			class="rounded-xl bg-red-600 px-3 py-2 font-semibold text-white active:bg-red-700 disabled:opacity-40"
			disabled={!anyData}
			onclick={clearAll}
		>
			Clear all data
		</button>

		<p class="min-h-5 text-sm font-medium text-green-800 dark:text-green-400" role="status">
			{message}
		</p>
	</section>

	<section class={card} aria-labelledby="about">
		<h2 id="about" class="text-lg font-semibold">About</h2>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-gray-600 dark:text-gray-400">Version</dt>
			<dd data-testid="version">{built}</dd>
			<dt class="text-gray-600 dark:text-gray-400">Source</dt>
			<dd>
				<a class="underline" href="https://github.com/xcwds/xcwds.github.io" rel="external noopener"
					>github.com/xcwds/xcwds.github.io</a
				>
			</dd>
		</dl>
	</section>
</main>
