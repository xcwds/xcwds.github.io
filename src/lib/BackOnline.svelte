<script lang="ts">
	/** Says "Back online." with a toast when the connection returns (the offline notice goes). */
	import { useApp } from '@xcwds/sveltekit';
	import { toast } from '$lib/toast.svelte';

	const network = useApp().network;
	$effect(() => {
		let offline = false;
		return network?.subscribe((online) => {
			if (online && offline) toast('Back online.');
			offline = !online;
		});
	});
</script>
