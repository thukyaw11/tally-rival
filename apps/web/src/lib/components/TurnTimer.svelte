<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Timer from '@lucide/svelte/icons/timer';
	import type { Game } from '#lib/scrabble/game.svelte.ts';
	import { sound } from '#lib/sound.svelte.ts';

	// Only the clock and the time-up dialog; the scoreboard shows the time left.
	// Online: startedAt comes from the server, and only the player whose turn it is (canAct) gets the dialog.
	let {
		game,
		timeUp = $bindable(false),
		ontick,
		startedAt: serverStart = null,
		canAct = true,
		canSwap = true
	}: {
		game: Game;
		timeUp?: boolean;
		ontick?: (left: number) => void;
		startedAt?: number | null;
		canAct?: boolean;
		canSwap?: boolean;
	} = $props();

	let dialog: HTMLDialogElement;
	let localStart = $state(Date.now());
	const startedAt = $derived(serverStart ?? localStart);
	let now = $state(Date.now());

	const limit = $derived((game.turnMinutes ?? 0) * 60);
	const name = $derived(game.players[game.current]);

	const remaining = $derived(Math.max(0, limit - Math.floor((now - startedAt) / 1000)));

	$effect(() => {
		ontick?.(remaining);
	});

	// Tick through the last 10 seconds; skip the first run so a reload stays quiet.
	let lastSecond = -1;
	$effect(() => {
		const r = remaining;
		if (lastSecond !== -1 && r !== lastSecond && r >= 1 && r <= 10) sound.play('tick');
		lastSecond = r;
	});

	// Restart the clock on every new turn (play, pass, undo, edit).
	$effect(() => {
		void game.moves.length;
		void game.current;
		localStart = now = Date.now();
	});

	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (remaining === 0 && !timeUp && canAct) {
			timeUp = true;
			sound.play('buzzer');
			dialog.showModal();
		}
	});

	function finish(chosen: 'pass' | 'swap') {
		timeUp = false;
		dialog.close();
		game.pass(chosen);
	}
</script>

<dialog
	bind:this={dialog}
	oncancel={(e) => {
		e.preventDefault();
		finish('pass');
	}}
	class="m-auto w-[min(92vw,22rem)] panel p-0 backdrop:bg-night-950/70"
>
	<div class="flex flex-col gap-3 p-4">
		<p class="flex items-center gap-2 text-xl font-bold">
			<Timer size={22} class="text-rose-600" /> Time's up, {name}!
		</p>
		<div class="flex gap-2">
			<button
				type="button"
				class="btn-3d h-11 flex-1 btn-white"
				disabled={!canSwap}
				onclick={() => finish('swap')}><ArrowLeftRight size={16} /> Swap tiles</button
			>
			<!-- svelte-ignore a11y_autofocus -->
			<button
				type="button"
				autofocus
				class="btn-3d h-11 flex-1 btn-green"
				onclick={() => finish('pass')}><SkipForward size={16} /> Pass turn</button
			>
		</div>
	</div>
</dialog>
