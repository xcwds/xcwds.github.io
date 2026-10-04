<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// The layout header shows the title (see errorInfo in src/lib/nav.ts); this is the body.
	let notFound = $derived(page.status === 404);

	const links = [
		{ path: '/', label: 'Home', emoji: '🏠' },
		{ path: '/recipes', label: 'Recipes', emoji: '📖' },
		{ path: '/utils', label: 'Utils', emoji: '🧰' }
	] as const;
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · xcwds</title>
</svelte:head>

<main
	class="mx-auto flex max-w-md flex-col gap-6 px-4 pt-2 pb-4 text-gray-800 sm:px-8 sm:pb-8 dark:text-gray-200"
	data-testid="error-page"
>
	<div class="flex flex-col gap-2 rounded-2xl bg-white/80 p-4 dark:bg-gray-900">
		{#if notFound}
			<p>There's nothing at this address. The link may be mistyped, or the page has moved.</p>
		{:else}
			<p>This page couldn't load.{page.error?.message ? ` (${page.error.message})` : ''}</p>
			<button
				type="button"
				class="rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white active:bg-blue-700"
				onclick={() => location.reload()}
			>
				Try again
			</button>
		{/if}
	</div>

	<nav aria-label="Go to">
		<ul class="grid grid-cols-3 gap-2">
			{#each links as link (link.path)}
				<li>
					<a
						href={resolve(link.path)}
						class="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/70 py-3 font-medium hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700"
					>
						<span aria-hidden="true" class="text-2xl">{link.emoji}</span>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</main>
