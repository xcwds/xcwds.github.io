<script lang="ts">
	/**
	 * Level and compass (#217): a bubble level (lying flat) or bar (standing on an edge) and a
	 * magnetic compass, from `deviceorientation` events alone: no location, no network. The
	 * calibration is this phone's (`app:level:calibration`, kept out of backups). The screen
	 * stays awake while the page is open.
	 */
	import { onMount } from 'svelte';
	import { persist } from '#lib/persist.svelte.js';
	import { entries } from '#lib/storage.js';
	import { toast } from '#lib/toast.svelte.js';
	import { keepAwake } from '#lib/utils/alarm.js';
	import {
		calibrate,
		compassPoint,
		headingOf,
		readLevel,
		smooth,
		smoothHeading,
		toScreen,
		upVector,
		type Calibration,
		type OrientationReading,
		type Vector
	} from '#lib/utils/level.js';
	import { button, card, primary, toggle } from '../weightlifting/styles';

	/** How long to wait for a first reading before saying there isn't one. */
	const WAIT_MS = 2000;
	/** Degrees of tilt that take the bubble to the edge of its circle, or the end of its tube. */
	const FULL_SCALE = 10;

	type Permission = () => Promise<'granted' | 'denied'>;

	let tab = $state<'level' | 'compass'>('level');
	/** Undefined until mounted, so the prerendered page matches the first render. */
	let sensor = $state<'waiting' | 'ask' | 'denied' | 'none' | 'on'>();
	let compass = $state<'waiting' | 'none' | 'on'>('waiting');
	let up = $state.raw<Vector>();
	let heading = $state<number>();
	let calibration = $state.raw<Calibration>();

	persist(
		entries.levelCalibration,
		() => calibration,
		(value) => (calibration = value),
		{ cleared: () => (calibration = undefined) }
	);

	const reading = $derived(up ? readLevel(up, calibration) : undefined);

	// One short buzz on becoming level, where the phone can.
	let wasLevel = false;
	$effect(() => {
		const level = reading?.level ?? false;
		if (level && !wasLevel) navigator.vibrate?.(30);
		wasLevel = level;
	});

	const screenAngle = () => screen.orientation?.angle ?? 0;

	function onOrientation(event: DeviceOrientationEvent) {
		if (event.beta === null || event.gamma === null) return;
		up = smooth(up, toScreen(upVector(event.beta, event.gamma), screenAngle()));
		sensor = 'on';
		onHeading(headingOf(event as OrientationReading, false, screenAngle()));
	}

	function onAbsolute(event: Event) {
		onHeading(headingOf(event as DeviceOrientationEvent, true, screenAngle()));
	}

	function onHeading(next: number | undefined) {
		if (next === undefined) return;
		heading = smoothHeading(heading, next);
		compass = 'on';
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	let listening = false;

	function listen() {
		if (listening) return;
		listening = true;
		sensor = 'waiting';
		window.addEventListener('deviceorientation', onOrientation);
		window.addEventListener('deviceorientationabsolute', onAbsolute);
		timer = setTimeout(() => {
			if (!up) sensor = 'none';
			if (heading === undefined) compass = 'none';
		}, WAIT_MS);
	}

	/** Safari on iOS asks first, and only from a tap. */
	async function start() {
		const ask = (DeviceOrientationEvent as unknown as { requestPermission?: Permission })
			.requestPermission;
		try {
			if ((await ask?.()) === 'denied') {
				sensor = 'denied';
				return;
			}
		} catch {
			sensor = 'denied';
			return;
		}
		listen();
	}

	onMount(() => {
		const awake = keepAwake(() => true);
		void awake.sync();
		if (typeof DeviceOrientationEvent === 'undefined') sensor = 'none';
		else if (
			typeof (DeviceOrientationEvent as unknown as { requestPermission?: Permission })
				.requestPermission === 'function'
		)
			sensor = 'ask';
		else listen();
		return () => {
			clearTimeout(timer);
			window.removeEventListener('deviceorientation', onOrientation);
			window.removeEventListener('deviceorientationabsolute', onAbsolute);
			awake.destroy();
		};
	});

	function setZero() {
		if (!up) return;
		calibration = calibrate(up, calibration);
		toast('This position now reads 0°.');
	}

	function reset() {
		calibration = undefined;
		toast('Calibration cleared.');
	}

	const clamp = (n: number) => Math.max(-1, Math.min(1, n / FULL_SCALE));
	/** The bubble's offset in its circle (flat), as a share of the radius. */
	const bubble = $derived.by(() => {
		if (reading?.mode !== 'flat') return { x: 0, y: 0 };
		const length = Math.hypot(reading.x, reading.y);
		const scale = length > FULL_SCALE ? FULL_SCALE / length : 1;
		return { x: (reading.x * scale) / FULL_SCALE, y: (reading.y * scale) / FULL_SCALE };
	});
</script>

<svelte:head>
	<title>Level and compass</title>
</svelte:head>

<main class="page-narrow flex flex-col gap-4 pt-2 pb-4 text-gray-800 sm:pb-8 dark:text-gray-200">
	<div class="grid grid-cols-2 gap-2" role="group" aria-label="Tool">
		<button
			type="button"
			class="{toggle(tab === 'level')} min-h-11"
			aria-pressed={tab === 'level'}
			onclick={() => (tab = 'level')}>Level</button
		>
		<button
			type="button"
			class="{toggle(tab === 'compass')} min-h-11"
			aria-pressed={tab === 'compass'}
			onclick={() => (tab = 'compass')}>Compass</button
		>
	</div>

	{#if sensor === 'ask'}
		<div class="{card} flex flex-col gap-3 text-center">
			<p>This browser asks before a page can use the phone's motion sensors.</p>
			<button type="button" class="{primary} min-h-11" onclick={start}>Start</button>
		</div>
	{:else if sensor === 'denied'}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">
			Motion sensors are blocked for this site. Allow “Motion & Orientation Access” in your
			browser's settings, then reload.
		</p>
	{:else if sensor === 'none'}
		<p class="{card} text-center" data-testid="no-sensors">
			Needs a phone or tablet: this device doesn't report its tilt.
		</p>
	{:else if tab === 'level'}
		<section class="flex flex-col items-center gap-4" aria-label="Level" data-testid="level">
			{#if reading?.mode === 'edge'}
				<div
					class="relative h-14 w-full max-w-sm rounded-full border-4 {reading.level
						? 'border-green-600 bg-green-100 dark:bg-green-950'
						: 'border-gray-400 bg-amber-50 dark:bg-gray-900'}"
					data-testid="level-tube"
				>
					<div
						class="absolute top-1/2 left-1/2 h-10 w-px -translate-y-1/2 bg-gray-500"
						aria-hidden="true"
					></div>
					<div
						class="absolute top-1/2 left-1/2 size-10 rounded-full bg-lime-400/80 shadow motion-safe:transition-transform motion-safe:duration-100"
						style:transform="translate(-50%, -50%) translateX({clamp(reading.angle) * 9}rem)"
						data-testid="bubble"
						aria-hidden="true"
					></div>
				</div>
			{:else}
				<div
					class="relative size-64 rounded-full border-4 {reading?.level
						? 'border-green-600 bg-green-100 dark:bg-green-950'
						: 'border-gray-400 bg-amber-50 dark:bg-gray-900'}"
					data-testid="level-circle"
				>
					<div
						class="absolute top-1/2 left-1/2 size-14 -translate-1/2 rounded-full border-2 border-gray-500"
						aria-hidden="true"
					></div>
					<div
						class="absolute top-1/2 left-1/2 size-12 rounded-full bg-lime-400/80 shadow motion-safe:transition-transform motion-safe:duration-100"
						style:transform="translate(-50%, -50%) translate({bubble.x * 6.5}rem, {-bubble.y *
							6.5}rem)"
						data-testid="bubble"
						aria-hidden="true"
					></div>
				</div>
			{/if}
			<p
				class="text-4xl font-semibold tabular-nums"
				data-testid="level-angle"
				data-level={reading?.level ?? false}
			>
				{#if !reading}
					…
				{:else if reading.level}
					Level
				{:else}
					{Math.abs(reading.angle).toFixed(1)}°
				{/if}
			</p>
			<!-- Announced only on becoming level or not: the angle changes with every reading. -->
			<p class="sr-only" aria-live="polite" data-testid="level-status">
				{reading ? (reading.level ? 'Level' : 'Not level') : ''}
			</p>
			<p class="text-center text-sm text-gray-600 dark:text-gray-400">
				{reading?.mode === 'edge'
					? 'Standing on an edge: the bubble moves to the higher end.'
					: 'Lying flat: the bubble floats to the higher side. Stand the phone on an edge for a straight level.'}
			</p>
			<div class="grid w-full grid-cols-2 gap-2">
				<button type="button" class="{button} min-h-11" disabled={!up} onclick={setZero}
					>Calibrate</button
				>
				<button type="button" class="{button} min-h-11" disabled={!calibration} onclick={reset}
					>Reset</button
				>
			</div>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Calibrate makes the way the phone is resting now read 0°, for a case that rocks. It's kept
				on this phone only.
			</p>
		</section>
	{:else}
		<section class="flex flex-col items-center gap-4" aria-label="Compass" data-testid="compass">
			{#if compass === 'none'}
				<p class="{card} text-center" data-testid="no-compass">
					A compass isn't available in this browser: it doesn't report which way is north.
				</p>
			{:else}
				<div
					class="relative size-64 rounded-full border-4 border-gray-400 bg-white/80 dark:bg-gray-900"
					aria-hidden="true"
				>
					<div
						class="absolute inset-0 motion-safe:transition-transform motion-safe:duration-100"
						style:transform="rotate({-(heading ?? 0)}deg)"
						data-testid="dial"
					>
						<span class="absolute top-2 left-1/2 -translate-x-1/2 font-bold text-red-600">N</span>
						<span class="absolute top-1/2 right-3 -translate-y-1/2 font-semibold">E</span>
						<span class="absolute bottom-2 left-1/2 -translate-x-1/2 font-semibold">S</span>
						<span class="absolute top-1/2 left-3 -translate-y-1/2 font-semibold">W</span>
					</div>
					<div class="absolute top-6 left-1/2 h-24 w-1 -translate-x-1/2 rounded bg-red-600"></div>
				</div>
				<p class="text-4xl font-semibold tabular-nums" data-testid="heading">
					{heading === undefined ? '…' : `${Math.round(heading) % 360}° ${compassPoint(heading)}`}
				</p>
			{/if}
			<p class="text-center text-sm text-gray-600 dark:text-gray-400">
				Magnetic north, which can be a few degrees from true north. Finding true north needs your
				location, which this tool never asks for. Keep away from magnets and metal.
			</p>
		</section>
	{/if}
</main>
