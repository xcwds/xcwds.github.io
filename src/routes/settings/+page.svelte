<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/environment';
	import Acronym from '$lib/Acronym.svelte';
	import { ACRONYM, BRAND, SECRET_ACRONYM } from '$lib/brand';
	import { changelog, latestChangelogId } from '$lib/changelog';
	import { install, promptInstall } from '$lib/install.svelte';
	import { reloadSettings, settings } from '$lib/settings.svelte';
	import { toast } from '$lib/toast.svelte';
	import { doughDefaults } from '$lib/utils/dough';
	import { UNITS, WEIGHT_UNITS, type EquipmentId } from '$lib/utils/lifting';
	import { formatDuration } from '$lib/utils/time';
	import {
		COFFEE_SECONDS,
		COOKING_PRESETS,
		clear,
		defaultSettings,
		entries,
		exportData,
		forgetLiftingEquipment,
		groups,
		importData,
		parseBackup,
		parseCookingPresets,
		read,
		remove,
		write,
		type Group,
		type ParsedBackup,
		type Theme
	} from '$lib/storage';

	const themes: { value: Theme; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	// --- Tool defaults ---
	let lifting = $derived(UNITS[settings.lifting.unit]);

	function adjustCoffee(deltaSeconds: number) {
		// Forget a length picked in the timer, so the new default is what it opens with.
		remove(entries.coffeeDuration);
		settings.coffeeDefaultSeconds = Math.min(
			COFFEE_SECONDS.max,
			Math.max(COFFEE_SECONDS.min, settings.coffeeDefaultSeconds + deltaSeconds)
		);
	}

	function setDefaultEquipment(id: EquipmentId) {
		settings.lifting.equipment = id;
		// Forget the equipment last picked in the calculator, so it opens with the new default.
		forgetLiftingEquipment();
	}

	function toggleOwnedPlate(plate: number) {
		const unit = settings.lifting.unit;
		const owned = settings.lifting.plates[unit];
		settings.lifting.plates[unit] = owned.includes(plate)
			? owned.filter((p) => p !== plate)
			: UNITS[unit].plates.filter((p) => p === plate || owned.includes(p));
	}

	// Editable copy of the presets; resets whenever the saved presets change.
	let presetsText = $derived(settings.cookingPresets.join(', '));
	let presetsError = $state('');

	function savePresets() {
		const parts = presetsText
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number);
		// The same check storage uses on load, so a saved list is never rejected later.
		const presets = parseCookingPresets(parts);
		if (!presets) {
			presetsError = `Enter 1–${COOKING_PRESETS.max} numbers of minutes, each from ${COOKING_PRESETS.minMinutes} to ${COOKING_PRESETS.maxMinutes}, separated by commas.`;
			return;
		}
		presetsError = '';
		settings.cookingPresets = presets;
		presetsText = presets.join(', ');
	}

	let pizza = $derived(settings.pizzaDefaults);
	let pizzaIsBuiltIn = $derived(
		(Object.keys(doughDefaults) as (keyof typeof doughDefaults)[]).every(
			(k) => pizza[k] === doughDefaults[k]
		)
	);

	const toggles = [
		{ key: 'sound', label: 'Alarm sound', hint: 'Beep when a timer finishes.' },
		{ key: 'vibration', label: 'Vibration', hint: "Android only; iPhones don't allow it." },
		{ key: 'keepAwake', label: 'Keep screen on', hint: 'While a timer is running.' }
	] as const;

	let pending = $state<Extract<ParsedBackup, { ok: true }> | null>(null);
	let importError = $state('');
	let canShareFiles = $state(false);
	// Bumped after imports and clears so "has data" re-checks storage.
	let dataVersion = $state(0);
	let fileInput: HTMLInputElement | undefined = $state();
	// Easter egg: every third tap on the acronym flips it to the secret one and back.
	let acronymTaps = $state(0);
	let secret = $derived(Math.floor(acronymTaps / 3) % 2 === 1);

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

	// --- What's new ---
	/** Entries newer than this get a "New" badge for this visit (none on a fresh install). */
	let seenBefore = $state(latestChangelogId);
	const RECENT = 10;

	onMount(() => {
		seenBefore = read(entries.whatsNewSeen) ?? latestChangelogId;
		if (seenBefore < latestChangelogId) write(entries.whatsNewSeen, latestChangelogId);
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
		toast('Backup downloaded.');
	}

	async function share() {
		try {
			await navigator.share({ files: [backupFile()], title: 'xcwds backup' });
			toast('Backup shared.');
		} catch {
			// Share sheet dismissed.
		}
	}

	async function chooseFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		importError = '';
		pending = null;
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
		toast(
			ok
				? `Imported ${count} ${count === 1 ? 'item' : 'items'}.`
				: 'Some data could not be saved (storage may be full or blocked).'
		);
	}

	function clearGroup(group: Group) {
		if (!confirm(`Clear saved data for ${group.label}?`)) return;
		clear(group.entries);
		if (group.id === 'settings') reloadSettings();
		dataVersion++;
		toast(`Cleared ${group.label}.`);
	}

	function clearAll() {
		if (!confirm('Clear all data saved by this app on this device? This cannot be undone.')) return;
		clear();
		reloadSettings();
		dataVersion++;
		toast('All data cleared.');
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
	{#if install.checked && !install.installed}
		<section class={card} aria-labelledby="install" data-testid="install">
			<h2 id="install" class="text-lg font-semibold">Install the app</h2>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Get xcwds on your home screen. It opens full-screen and works offline.
			</p>
			{#if install.canPrompt}
				<button type="button" class={primary} onclick={promptInstall}>Install xcwds</button>
			{:else if install.ios}
				<ol class="list-decimal pl-5 text-sm">
					<li>Open this page in <strong>Safari</strong>.</li>
					<li>Tap <strong>Share</strong> (the square with an arrow).</li>
					<li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
				</ol>
			{:else}
				<p class="text-sm">
					Use your browser's menu and choose <strong>Install app</strong> or
					<strong>Add to Home screen</strong>.
				</p>
			{/if}
		</section>
	{/if}

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
			<label class="flex min-h-11 items-center justify-between gap-3">
				<span class="flex flex-col">
					<span class="font-medium">{toggle.label}</span>
					<span class="text-sm text-gray-600 dark:text-gray-400">{toggle.hint}</span>
				</span>
				<input type="checkbox" class="size-6 shrink-0" bind:checked={settings[toggle.key]} />
			</label>
		{/each}
	</section>

	<section class={card} aria-labelledby="tool-defaults" data-testid="tool-defaults">
		<h2 id="tool-defaults" class="text-lg font-semibold">Tool defaults</h2>

		<h3 class="font-semibold">Weightlifting Calculator</h3>
		<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Weightlifting units">
			{#each WEIGHT_UNITS as unit (unit)}
				<button
					type="button"
					role="radio"
					aria-checked={settings.lifting.unit === unit}
					class="rounded-xl px-3 py-2 text-sm font-medium {settings.lifting.unit === unit
						? 'bg-blue-600 text-white'
						: 'bg-white/70 active:bg-white dark:bg-gray-800 dark:active:bg-gray-700'}"
					onclick={() => (settings.lifting.unit = unit)}
				>
					{unit === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
				</button>
			{/each}
		</div>
		<label class="flex flex-col gap-1 text-sm">
			<span>Default equipment</span>
			<select
				class="rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
				value={settings.lifting.equipment}
				onchange={(e) => setDefaultEquipment(e.currentTarget.value as EquipmentId)}
			>
				{#each lifting.equipment as item (item.id)}
					<option value={item.id}>{item.name}</option>
				{/each}
			</select>
		</label>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			The calculator remembers the equipment you pick; changing the default resets that.
		</p>
		<fieldset class="flex flex-col gap-1 text-sm">
			<legend class="mb-1">Plates you have ({settings.lifting.unit})</legend>
			<div class="flex flex-wrap gap-2">
				{#each lifting.plates as plate (plate)}
					{@const owned = settings.lifting.plates[settings.lifting.unit].includes(plate)}
					<button
						type="button"
						aria-pressed={owned}
						class="rounded-xl px-3 py-2 text-sm font-medium {owned
							? 'bg-blue-600 text-white'
							: 'bg-white/70 active:bg-white dark:bg-gray-800 dark:active:bg-gray-700'}"
						onclick={() => toggleOwnedPlate(plate)}>{plate}</button
					>
				{/each}
			</div>
		</fieldset>

		<h3 class="mt-2 font-semibold">Coffee Timer</h3>
		<div class="flex items-center justify-between gap-3">
			<span>Default length</span>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class={button}
					aria-label="15 seconds shorter"
					disabled={settings.coffeeDefaultSeconds <= COFFEE_SECONDS.min}
					onclick={() => adjustCoffee(-15)}>−15s</button
				>
				<span class="w-14 text-center text-lg tabular-nums" data-testid="coffee-default"
					>{formatDuration(settings.coffeeDefaultSeconds * 1000)}</span
				>
				<button
					type="button"
					class={button}
					aria-label="15 seconds longer"
					disabled={settings.coffeeDefaultSeconds >= COFFEE_SECONDS.max}
					onclick={() => adjustCoffee(15)}>+15s</button
				>
			</div>
		</div>

		<p class="text-sm text-gray-600 dark:text-gray-400">
			A length you pick in the timer is remembered; changing the default resets that.
		</p>

		<h3 class="mt-2 font-semibold">Cooking Timer</h3>
		<label class="flex flex-col gap-1 text-sm">
			<span>Quick-start buttons (minutes, separated by commas)</span>
			<input
				class="rounded-md border border-gray-300 bg-white px-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
				inputmode="decimal"
				bind:value={presetsText}
				onchange={savePresets}
			/>
		</label>
		{#if presetsError}
			<p class="text-sm text-red-700 dark:text-red-400" role="alert">{presetsError}</p>
		{/if}

		<h3 class="mt-2 font-semibold">Pizza Dough Calculator</h3>
		<p class="text-sm" data-testid="pizza-defaults">
			{pizza.balls} × {pizza.ballWeight} g · {pizza.hydration}% hydration · {pizza.salt}% salt ·
			{pizza.yeast}% yeast · {pizza.oil}% oil · {pizza.sugar}% sugar
		</p>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Always in grams. Change these with <strong>Save as my defaults</strong> in the calculator.
		</p>
		<button
			type="button"
			class="{button} text-sm"
			disabled={pizzaIsBuiltIn}
			onclick={() => (settings.pizzaDefaults = { ...doughDefaults })}
		>
			Restore built-in pizza defaults
		</button>
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
	</section>

	<section class={card} aria-labelledby="about">
		<h2 id="about" class="text-lg font-semibold">About</h2>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-gray-600 dark:text-gray-400">{BRAND}</dt>
			<dd>
				<button
					type="button"
					class="text-left"
					data-testid="about-acronym"
					onclick={() => acronymTaps++}
				>
					<Acronym phrase={secret ? SECRET_ACRONYM : ACRONYM} />{#if secret}
						<span aria-hidden="true" class="ml-1">🧇🏋️🧼</span>{/if}
				</button>
			</dd>
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

	<section class={card} aria-labelledby="whats-new" data-testid="whats-new">
		<h2 id="whats-new" class="text-lg font-semibold">What's new</h2>
		<ol class="flex flex-col gap-3 text-sm">
			{#each changelog.slice(0, RECENT) as entry (entry.id)}
				<li data-testid="whats-new-entry">
					<p class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
						<time datetime={entry.date}
							>{new Date(`${entry.date}T12:00`).toLocaleDateString(undefined, {
								dateStyle: 'medium'
							})}</time
						>
						{#if entry.id > seenBefore}
							<span
								data-testid="whats-new-badge"
								class="rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">New</span
							>
						{/if}
					</p>
					<ul class="list-disc pl-5">
						{#each entry.items as item (item)}
							<li>{item}</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>
	</section>
</main>
