<script lang="ts">
	/**
	 * Photo Cleaner (#212): the URL Sanitizer, for photos. Each picked photo is redrawn from its
	 * pixels by `cleanImage`, so its location, camera and other details are left behind, and the
	 * page says in words what was removed. Nothing is saved: photos live in this page's memory
	 * and their object URLs are revoked when they're replaced, cleared or the page closes.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { cleanImage, type ImageMetadata } from '@xcwds/plugin-camera/image';
	import { SHARE_MESSAGES, canShareFiles, saveFile } from '@xcwds/plugin-camera/share';
	import { toast } from '#lib/toast.svelte.js';
	import { SIZES, cleanName, findings, formatBytes } from '#lib/utils/photo-cleaner.js';
	import { button, card, primary } from '../weightlifting/styles';

	type Item = {
		id: number;
		original: File;
		/** Bumped on every clean, so a slower earlier clean can't overwrite a newer one. */
		run: number;
		status: 'working' | 'ok' | 'error';
		blob?: Blob;
		type?: string;
		url?: string;
		width?: number;
		height?: number;
		removed?: ImageMetadata;
		error?: string;
	};

	let items = $state<Item[]>([]);
	let size = $state(0);
	let canShare = $state(false);
	let picker = $state<HTMLInputElement>();
	let nextId = 0;

	onMount(() => (canShare = canShareFiles()));
	// Emptied too, so a clean that finishes after leaving finds nothing to make a URL for.
	onDestroy(clear);

	const revoke = (item: Item) => item.url && URL.revokeObjectURL(item.url);
	let done = $derived(items.filter((i) => i.status === 'ok'));
	let working = $derived(items.some((i) => i.status === 'working'));

	// One photo at a time: each clean holds a full-size bitmap and canvas, and a phone that
	// decodes twenty at once runs out of memory.
	let queue = Promise.resolve();

	function clean(id: number) {
		const item = items.find((i) => i.id === id);
		if (!item) return;
		const run = ++item.run;
		item.status = 'working';
		queue = queue.then(() => work(id, run));
	}

	async function work(id: number, run: number) {
		const latest = () => items.find((i) => i.id === id && i.run === run);
		const item = latest();
		// Removed, cleared, or queued again at another size: skip the decode.
		if (!item) return;
		const result = await cleanImage(item.original, { maxSide: SIZES[size].maxSide });
		const current = latest();
		if (!current) return;
		revoke(current);
		if (result.ok) {
			Object.assign(current, {
				status: 'ok',
				blob: result.blob,
				type: result.type,
				url: URL.createObjectURL(result.blob),
				width: result.width,
				height: result.height,
				removed: result.removed,
				error: undefined
			});
		} else {
			Object.assign(current, { status: 'error', error: result.error, url: undefined });
		}
	}

	function add(files: FileList | null | undefined) {
		const added = [...(files ?? [])].map((original): Item => ({
			id: nextId++,
			original,
			run: 0,
			status: 'working'
		}));
		items.push(...added);
		for (const item of added) clean(item.id);
		if (picker) picker.value = '';
	}

	function resize(index: number) {
		size = index;
		for (const item of items) clean(item.id);
	}

	function clear() {
		items.forEach(revoke);
		items = [];
	}

	function remove(id: number) {
		const item = items.find((i) => i.id === id);
		if (item) revoke(item);
		items = items.filter((i) => i.id !== id);
	}

	/** Whether the share sheet takes these files (it may refuse several, or large ones). */
	function canShareThese(files: File[]): boolean {
		try {
			return canShare && navigator.canShare({ files });
		} catch {
			return false;
		}
	}

	/** Shares the clean copies, or downloads them where the browser can't share files. */
	function send(list: Item[]) {
		const files = list.map(
			(i) => new File([i.blob!], cleanName(i.original.name, i.type!), { type: i.type })
		);
		const one = files.length === 1;
		if (canShareThese(files)) {
			// Straight from the tap, with no await before it: Safari needs the tap's activation.
			navigator.share({ files }).then(
				() => toast(one ? 'Clean copy shared.' : 'Clean copies shared.'),
				(e: unknown) => {
					if (!(e instanceof DOMException && e.name === 'AbortError')) toast(SHARE_MESSAGES.failed);
				}
			);
			return;
		}
		const outcomes = files.map((file) => saveFile(file));
		toast(
			outcomes.includes('failed')
				? SHARE_MESSAGES.failed
				: one
					? 'Clean copy downloaded.'
					: `${files.length} clean copies downloaded.`
		);
	}
</script>

<svelte:head>
	<title>Photo Cleaner</title>
</svelte:head>

<!-- With room for two columns (#95): choosing on the left, the clean copies on the right. -->
<main class="page-split @container pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<div
		class="flex flex-col gap-6 @[50rem]:grid @[50rem]:grid-cols-2 @[50rem]:items-start @[50rem]:gap-x-10"
	>
		<div class="flex flex-col gap-4">
			<input
				bind:this={picker}
				type="file"
				accept="image/*"
				multiple
				class="hidden"
				data-testid="photo-file"
				onchange={(e) => add(e.currentTarget.files)}
			/>
			<button type="button" class="{primary} min-h-11 text-lg" onclick={() => picker?.click()}
				>Choose photos</button
			>
			<label class="flex flex-col gap-1 text-sm">
				<span>Size of the clean copy</span>
				<select
					value={size}
					onchange={(e) => resize(Number(e.currentTarget.value))}
					class="rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
				>
					{#each SIZES as s, i (s.label)}
						<option value={i}>{s.label}</option>
					{/each}
				</select>
				<span class="text-gray-600 dark:text-gray-400"
					>Smaller copies are quicker to send. Photos are never made bigger.</span
				>
			</label>
			<details class="{card} text-sm" data-testid="photo-cleaner-note">
				<summary class="flex min-h-11 cursor-pointer items-center font-semibold"
					>What gets removed</summary
				>
				<ul class="mt-2 flex list-disc flex-col gap-2 pl-5 text-gray-700 dark:text-gray-300">
					<li>
						The clean copy is redrawn from the photo's pixels alone, so nothing hidden in the file
						comes with it: GPS location, phone or camera model, date taken, editing history,
						comments and captions.
					</li>
					<li>
						What's in the picture itself stays: faces, street signs, screens and anything else
						someone could recognise.
					</li>
					<li>
						Everything happens on this device. Photos aren't sent anywhere or saved in the app, and
						are gone when you leave this page.
					</li>
				</ul>
			</details>
		</div>

		<section class="flex flex-col gap-3" aria-label="Clean copies" aria-busy={working}>
			{#if items.length}
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-lg font-semibold">
						{items.length === 1 ? '1 photo' : `${items.length} photos`}
					</h2>
					<button type="button" class="{button} min-h-11 text-sm" onclick={clear}>Clear</button>
				</div>
				{#if done.length > 1}
					<button
						type="button"
						class="{primary} min-h-11"
						disabled={working}
						onclick={() => send(done)}
						>{canShare ? 'Share all' : 'Download all'} ({done.length})</button
					>
				{/if}
				<ul class="flex flex-col gap-3">
					{#each items as item (item.id)}
						{@const lines = item.removed ? findings(item.removed) : []}
						<li class="{card} flex flex-col gap-3" data-testid="photo">
							<div class="flex items-start gap-3">
								{#if item.url}
									<img
										src={item.url}
										alt="Clean copy of {item.original.name}"
										class="size-20 shrink-0 rounded-lg object-cover"
									/>
								{:else}
									<div
										class="size-20 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-800"
										aria-hidden="true"
									></div>
								{/if}
								<div class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
									<p class="font-medium break-all">{item.original.name}</p>
									{#if item.status === 'working'}
										<p class="text-gray-600 dark:text-gray-400">Cleaning…</p>
									{:else if item.status === 'error'}
										<p class="text-red-700 dark:text-red-400" role="alert">{item.error}</p>
									{:else}
										<p class="text-gray-600 dark:text-gray-400" data-testid="photo-size">
											{formatBytes(item.original.size)} → {formatBytes(item.blob!.size)}, {item.width}
											× {item.height} px
										</p>
									{/if}
								</div>
							</div>
							{#if item.status === 'ok'}
								<ul class="flex flex-col gap-1 text-sm" data-testid="photo-findings">
									{#each lines as line (line)}
										<li class="text-green-800 dark:text-green-300">✓ {line}</li>
									{:else}
										<li class="text-gray-600 dark:text-gray-400">
											No hidden details found. The copy is clean either way.
										</li>
									{/each}
								</ul>
							{/if}
							<div class="grid grid-cols-2 gap-2">
								{#if item.status === 'ok'}
									<button type="button" class="{primary} min-h-11" onclick={() => send([item])}
										>{canShare ? 'Share' : 'Download'}</button
									>
								{/if}
								<button
									type="button"
									class="{button} min-h-11 {item.status === 'ok' ? '' : 'col-span-2'}"
									aria-label="Remove {item.original.name}"
									onclick={() => remove(item.id)}>Remove</button
								>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Choose photos to see what they give away, and get copies without it.
				</p>
			{/if}
		</section>
	</div>
</main>
