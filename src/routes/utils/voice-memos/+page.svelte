<script lang="ts">
	/**
	 * Voice memos (#214): recordings that stay on this device. The recorder and the list are
	 * @xcwds/plugin-recorder's; recordings go in its `app.recordings`, named by when they were
	 * recorded until renamed.
	 */
	import Recorder from '@xcwds/plugin-recorder/Recorder.svelte';
	import Recordings from '@xcwds/plugin-recorder/Recordings.svelte';
	import { card } from '../self-control/styles';
</script>

<main class="page-narrow flex flex-col gap-4 pt-2">
	<section class="{card} py-6">
		<Recorder />
	</section>
	<p class="text-sm text-gray-700 dark:text-gray-300" data-testid="voice-memos-background">
		On iPhone, recording stops if you leave the app; what was recorded so far is saved.
	</p>
	<details class="{card} text-sm" data-testid="voice-memos-note">
		<summary class="flex min-h-11 cursor-pointer items-center font-semibold"
			>What stays private</summary
		>
		<ul class="mt-2 flex list-disc flex-col gap-2 pl-5 text-gray-700 dark:text-gray-300">
			<li>
				The microphone is on only while you record, and nothing is sent anywhere. Recordings stay
				out of your phone's recorder app, your cloud backup and this app's backups.
			</li>
			<li>Your phone may still clean up the sound the way it does for calls.</li>
			<li>Sharing a recording hands it to wherever you share it, which may keep or back it up.</li>
			<li>
				With a passcode set in Settings → Privacy, Voice memos opens only after unlocking and its
				recordings are encrypted on this device. Without one, anyone who can open this app here can
				hear them.
			</li>
		</ul>
	</details>
	<Recordings />
</main>
