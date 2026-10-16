<script lang="ts">
	import AppCatalog from '@xcwds/plugin-tools/AppCatalog.svelte';
</script>

<svelte:head>
	<title>Apps</title>
</svelte:head>

<!-- The apps people turn on and off (#223): @xcwds/plugin-tools' catalog. -->
<main class="page-wide flex flex-col gap-4 pt-2 pb-6 sm:pb-12">
	<AppCatalog />
</main>
