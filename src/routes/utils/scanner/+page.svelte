<script lang="ts">
	/**
	 * Document scanner (#215): paper to a PDF on this device. The viewfinder is
	 * @xcwds/plugin-camera's; the crop screen, the page list and Export are @xcwds/plugin-scanner's,
	 * and the scan in progress is its `app.scanner.pages`, so an unfinished scan survives a reload.
	 */
	import Camera from '@xcwds/plugin-camera/Camera.svelte';
	import type { Photo } from '@xcwds/plugin-camera/client';
	import Crop from '@xcwds/plugin-scanner/Crop.svelte';
	import Pages from '@xcwds/plugin-scanner/Pages.svelte';
	import type { Filter, Paper } from '@xcwds/plugin-scanner/client';
	import { onMount } from 'svelte';
	import { localPaper } from '#lib/utils/scanner.js';
	import { card } from '../self-control/styles';

	/** The photo being cropped; the viewfinder shows again once its page is added or it's cancelled. */
	let photo = $state<Blob>();
	let filter = $state<Filter>('original');
	/** The page a Retake replaces, until its photo is cropped or cancelled. */
	let retake = $state<string>();

	// The PDF's paper: the locale's until a page is snapped to A4 or Letter, and the person's own
	// choice once they pick one. Only for this visit, not an app-wide setting.
	let paper = $state<Paper>('a4');
	let chosen = false;
	onMount(() => {
		paper = localPaper(navigator.languages?.length ? navigator.languages : [navigator.language]);
	});

	const done = (page?: { paper: Paper | null }) => {
		if (page?.paper && !chosen) paper = page.paper;
		photo = undefined;
		retake = undefined;
	};
</script>

<!-- With room for two columns (#95): the camera and crop on the left, the pages on the right. -->
<main class="page-split @container pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<div
		class="flex flex-col gap-6 @[50rem]:grid @[50rem]:grid-cols-2 @[50rem]:items-start @[50rem]:gap-x-10"
	>
		<div class="flex flex-col gap-4">
			{#if photo}
				<Crop {photo} {retake} bind:filter onDone={done} onCancel={() => done()} />
			{:else}
				{#if retake}
					<p class="flex flex-wrap items-center gap-3" data-testid="retaking">
						Take the page again.
						<button
							type="button"
							class="min-h-11 rounded-xl bg-(--xcwds-shell-card) px-4 font-medium hover:not-disabled:bg-(--xcwds-shell-hover-bg) active:bg-(--xcwds-shell-hover-bg)"
							onclick={() => (retake = undefined)}>Cancel retake</button
						>
					</p>
				{/if}
				<Camera onCapture={(p: Photo) => void (photo = p.blob)} />
			{/if}
			<details class="{card} text-sm" data-testid="scanner-note">
				<summary class="flex min-h-11 cursor-pointer items-center font-semibold"
					>What stays private</summary
				>
				<ul class="mt-2 flex list-disc flex-col gap-2 pl-5 text-gray-700 dark:text-gray-300">
					<li>
						Pages are straightened and made into a PDF on this device, and nothing is sent anywhere.
						The scan stays out of your gallery, your cloud backup and this app's backups.
					</li>
					<li>
						The PDF and images carry no location, device details or dates inside them, only what's
						on the page. Their names say when the scan was made.
					</li>
					<li>
						Sharing or saving a scan hands it to wherever it goes, which may keep or back it up.
					</li>
					<li>
						With a passcode set in Settings → Privacy, the Document scanner opens only after
						unlocking and the scan is encrypted on this device. Without one, anyone who can open
						this app here can see it.
					</li>
				</ul>
			</details>
		</div>
		<!-- No Retake while a photo is being cropped: it would turn that photo's Add page into a Replace. -->
		<Pages
			bind:paper={
				() => paper,
				(next) => {
					paper = next;
					chosen = true;
				}
			}
			onRetake={photo ? undefined : (id) => (retake = id)}
		/>
	</div>
</main>
