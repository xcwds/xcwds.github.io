<script lang="ts">
	/**
	 * Camera (#210): photos that stay in the app, out of the gallery and cloud backups. The
	 * viewfinder and grid are @xcwds/plugin-camera's; photos go in its `app.photos`.
	 */
	import Camera from '@xcwds/plugin-camera/Camera.svelte';
	import Photos from '@xcwds/plugin-camera/Photos.svelte';
	import type { Photo } from '@xcwds/plugin-camera/client';
	import { useApp } from '@xcwds/sveltekit';
	import { toast } from '$lib/toast.svelte';
	import { card } from '../self-control/styles';

	const app = useApp();
	let error = $state('');

	async function keep(photo: Photo) {
		error = '';
		const saved = await app.photos?.save(photo);
		if (!saved) return;
		if (saved.ok) toast('Photo saved in the app.');
		else error = saved.error;
	}
</script>

<main class="page-narrow flex flex-col gap-4 pt-2">
	<Camera onCapture={keep} />
	{#if error}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>
	{/if}
	<details class="{card} text-sm" data-testid="camera-note">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold"
			>What stays private</summary
		>
		<ul class="mt-2 flex list-disc flex-col gap-2 pl-5 text-gray-700 dark:text-gray-300">
			<li>
				Photos taken or added here carry no location or device details, and nothing is sent
				anywhere. They stay out of your gallery, your cloud backup and this app's backups.
			</li>
			<li>Your phone still processes the picture the way its camera always does.</li>
			<li>Sharing a photo hands it to wherever you share it, which may keep or back it up.</li>
			<li>
				Photos aren't encrypted on this device yet, so anyone who can open this app here can see
				them.
			</li>
		</ul>
	</details>
	<Photos />
</main>
