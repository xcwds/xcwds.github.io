<script lang="ts" module>
	/** The zoom last used, for this visit to the app only: never saved. */
	let sessionZoom: number | undefined;
</script>

<script lang="ts">
	/**
	 * Magnifier (#216): the camera, zoomed, for menus, labels and medicine bottles. Freeze holds
	 * the current picture so you can lower the phone and pinch or drag around it; Light shows only
	 * where the camera has one. Uses `app.camera`, which turns off when the page is hidden; leaving
	 * the page turns it off too. Nothing is saved.
	 */
	import type { CameraState, Capabilities } from '@xcwds/plugin-camera/client';
	import { pinchZoom } from '@xcwds/plugin-camera/help';
	import { useApp } from '@xcwds/sveltekit';
	import { onMount } from 'svelte';
	import {
		FROZEN_ZOOM,
		VIEWS,
		clampPan,
		dragBy,
		type Pan,
		type ViewId
	} from '#lib/utils/magnifier.js';
	import { button, primary, toggle } from '../weightlifting/styles';

	const camera = useApp().camera;
	const uid = $props.id();

	/** Undefined until mounted, so the prerendered page matches the first render. */
	let status = $state<CameraState>();
	let error = $state('');
	let stream = $state.raw<MediaStream | null>(null);
	let caps = $state.raw<Capabilities>({ zoom: null, torch: false, torchOn: false });
	let video = $state<HTMLVideoElement>();
	let canvas = $state<HTMLCanvasElement>();
	let ready = $state(false);
	let view = $state<ViewId>('normal');
	let frozen = $state(false);
	let frozenZoom = $state(1);
	let pan = $state<Pan>({ x: 0, y: 0 });
	let width = $state(0);
	let height = $state(0);

	const live = $derived(status === 'live');
	const zoom = $derived(caps.zoom);
	/** Digital zoom scales the live picture; the camera's own zoom needs no scaling. */
	const liveScale = $derived(zoom?.kind === 'digital' ? zoom.value : 1);
	const filter = $derived(VIEWS.find((v) => v.id === view)!.filter);

	onMount(() => {
		if (!camera) return;
		let applied = false;
		const read = () => {
			status = camera.state;
			error = camera.error;
			stream = camera.stream;
			caps = camera.capabilities();
			// A frozen picture stays when the camera goes off (a locked screen, another app): it
			// needs no camera, and that's when it helps most.
			if (camera.state !== 'live') applied = false;
			else if (!applied && caps.zoom && sessionZoom !== undefined) {
				// Back to the zoom last used, each time the camera comes on.
				applied = true;
				void camera.setZoom(sessionZoom);
			}
		};
		read();
		const stop = camera.onChange(read);
		return () => {
			stop();
			camera.stop();
		};
	});

	$effect(() => {
		if (!video) return;
		video.srcObject = stream;
		ready = false;
		if (stream) void video.play().catch(() => {});
	});

	function setZoom(value: number) {
		sessionZoom = value;
		void camera?.setZoom(value);
	}

	/** Holds the current picture: drawn once onto a canvas, which nothing updates. */
	function freeze() {
		if (!video || !canvas || !ready || !video.videoWidth) return;
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')?.drawImage(video, 0, 0);
		frozenZoom = liveScale;
		pan = { x: 0, y: 0 };
		frozen = true;
	}

	function unfreeze() {
		frozen = false;
		if (video && stream) void video.play().catch(() => {});
	}

	function setFrozenZoom(value: number) {
		frozenZoom = Math.min(FROZEN_ZOOM.max, Math.max(FROZEN_ZOOM.min, value));
		pan = clampPan(pan, frozenZoom, width, height);
	}

	// Pinch zooms (live: the camera's zoom; frozen: the picture); one finger, or a mouse, drags a
	// frozen picture around.
	const pointers: Record<number, { x: number; y: number }> = {};
	const fingers = () => Object.keys(pointers).length;
	let pinch: { from: number; start: number } | null = null;
	const spread = () => {
		const [a, b] = Object.values(pointers);
		return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
	};
	const pinchable = () =>
		frozen ? { ...FROZEN_ZOOM, kind: 'digital' as const, value: frozenZoom } : zoom;

	function pointerDown(event: PointerEvent) {
		if (!frozen && (!live || event.pointerType !== 'touch')) return;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
		const z = pinchable();
		if (fingers() === 2 && z) pinch = { from: spread(), start: z.value };
	}

	function pointerMove(event: PointerEvent) {
		const last = pointers[event.pointerId];
		if (!last) return;
		const next = { x: event.clientX, y: event.clientY };
		pointers[event.pointerId] = next;
		const z = pinchable();
		if (pinch && z && fingers() === 2) {
			const value = pinchZoom(pinch.start, pinch.from, spread(), z);
			if (frozen) setFrozenZoom(value);
			else if (value !== z.value) setZoom(value);
		} else if (frozen && fingers() === 1) {
			pan = clampPan(
				dragBy(pan, next.x - last.x, next.y - last.y, frozenZoom),
				frozenZoom,
				width,
				height
			);
		}
	}

	function pointerUp(event: PointerEvent) {
		delete pointers[event.pointerId];
		if (fingers() < 2) pinch = null;
	}
</script>

<svelte:head>
	<title>Magnifier</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-4 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<div
		class="relative aspect-[3/4] max-h-[65svh] w-full overflow-hidden rounded-xl bg-black select-none"
		data-testid="magnifier"
		data-state={status}
		data-frozen={frozen}
		bind:clientWidth={width}
		bind:clientHeight={height}
		style:touch-action={live || frozen ? 'none' : undefined}
		onpointerdown={pointerDown}
		onpointermove={pointerMove}
		onpointerup={pointerUp}
		onpointercancel={pointerUp}
		role="presentation"
	>
		<video
			bind:this={video}
			class="absolute inset-0 h-full w-full origin-center object-cover"
			class:invisible={!live || frozen}
			style:transform="scale({liveScale})"
			style:filter
			playsinline
			muted
			autoplay
			onloadeddata={() => (ready = true)}
			aria-label="Magnified picture"
		></video>
		<canvas
			bind:this={canvas}
			class="absolute inset-0 h-full w-full origin-center object-cover"
			class:invisible={!frozen}
			style:transform="scale({frozenZoom}) translate({pan.x}px, {pan.y}px)"
			style:filter
			aria-label="Frozen picture"
			data-testid="frozen"
		></canvas>
		{#if !live && !frozen}
			<div class="absolute inset-0 flex items-center justify-center p-4 text-center text-white">
				{#if status === 'asking'}
					<p>Waiting for permission to use the camera…</p>
				{:else if camera}
					<button
						type="button"
						class="min-h-12 rounded-xl bg-white px-5 text-lg font-medium text-black hover:not-disabled:bg-gray-200 active:bg-gray-200"
						disabled={status === undefined}
						onclick={() => camera.start()}>Turn on camera</button
					>
				{:else}
					<p>This browser can't use the camera.</p>
				{/if}
			</div>
		{/if}
	</div>

	<p class="text-sm text-red-700 dark:text-red-400" aria-live="polite">
		{status === 'denied' || status === 'unavailable' || status === 'error' ? error : ''}
	</p>

	{#if live || frozen}
		<div class="grid grid-cols-2 gap-3">
			{#if frozen}
				<button
					type="button"
					class="{primary} min-h-12 text-lg {live ? '' : 'col-span-2'}"
					onclick={unfreeze}>Unfreeze</button
				>
			{:else}
				<button type="button" class="{primary} min-h-12 text-lg" disabled={!ready} onclick={freeze}
					>Freeze</button
				>
			{/if}
			{#if live}
				<button type="button" class="{button} min-h-12 text-lg" onclick={() => camera?.stop()}
					>Turn off</button
				>
			{/if}
			{#if caps.torch}
				<button
					type="button"
					class="{toggle(caps.torchOn)} col-span-2 min-h-12 text-lg"
					aria-pressed={caps.torchOn}
					onclick={() => camera?.setTorch(!caps.torchOn)}>Light</button
				>
			{/if}
		</div>

		{#if frozen}
			<div class="flex flex-col gap-1">
				<label for="{uid}-zoom" class="font-medium"
					>Zoom <span class="tabular-nums">{frozenZoom.toFixed(1)}×</span></label
				>
				<input
					id="{uid}-zoom"
					aria-describedby="{uid}-hint"
					type="range"
					class="min-h-11 w-full"
					min={FROZEN_ZOOM.min}
					max={FROZEN_ZOOM.max}
					step={FROZEN_ZOOM.step}
					value={frozenZoom}
					oninput={(e) => setFrozenZoom(Number(e.currentTarget.value))}
				/>
				<p id="{uid}-hint" class="text-sm text-gray-600 dark:text-gray-400">
					Pinch or use the slider to zoom, and drag to move around.
				</p>
			</div>
		{:else if zoom}
			<div class="flex flex-col gap-1">
				<label for="{uid}-zoom" class="font-medium"
					>{zoom.kind === 'digital' ? 'Digital zoom' : 'Zoom'}
					<span class="tabular-nums">{zoom.value.toFixed(1)}×</span></label
				>
				<input
					id="{uid}-zoom"
					aria-describedby={zoom.kind === 'digital' ? `${uid}-hint` : undefined}
					type="range"
					class="min-h-11 w-full"
					min={zoom.min}
					max={zoom.max}
					step={zoom.step}
					value={zoom.value}
					oninput={(e) => setZoom(Number(e.currentTarget.value))}
				/>
				{#if zoom.kind === 'digital'}
					<p id="{uid}-hint" class="text-sm text-gray-600 dark:text-gray-400">
						This camera can't zoom itself, so this enlarges the picture; it adds no detail.
					</p>
				{/if}
			</div>
		{/if}

		<div role="group" aria-label="View" class="grid grid-cols-3 gap-2">
			{#each VIEWS as v (v.id)}
				<button
					type="button"
					class="{toggle(view === v.id)} min-h-11"
					aria-pressed={view === v.id}
					onclick={() => (view = v.id)}>{v.label}</button
				>
			{/each}
		</div>
	{/if}

	<p class="text-sm text-gray-600 dark:text-gray-400">
		The camera is on only while this page is open and showing. Nothing is saved or sent anywhere.
	</p>
</main>
