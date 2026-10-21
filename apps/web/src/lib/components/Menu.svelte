<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import Flag from '@lucide/svelte/icons/flag';
	import House from '@lucide/svelte/icons/house';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	// Online: onswap opens the tile picker, and there is no End game / New game (the server ends it).
	let {
		game,
		onendgame,
		onswap,
		canSwap = true
	}: { game: Game; onendgame?: () => void; onswap?: () => void; canSwap?: boolean } = $props();

	let open = $state(false);

	function run(action: () => void) {
		open = false;
		action();
	}

	function newGame() {
		if (confirm('Start a new game? The current game will be deleted.')) game.newGame();
	}

	const item =
		'flex w-full items-center gap-3 px-4 py-3 text-left font-medium hover:bg-amber-100 disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-label="Menu"
		aria-expanded={open}
		class="btn-3d h-10 w-10"><EllipsisVertical size={20} /></button
	>
	{#if open}
		<!-- Full-screen layer so a tap outside closes the menu. -->
		<button
			type="button"
			class="fixed inset-0 z-30 cursor-default"
			aria-label="Close menu"
			onclick={() => (open = false)}
		></button>
		<div class="absolute top-full right-0 z-40 mt-3 w-52 overflow-hidden panel py-1" role="menu">
			<button
				type="button"
				role="menuitem"
				class={item}
				disabled={game.ended || !game.canPlay}
				onclick={() => run(() => game.pass('pass'))}><SkipForward size={16} /> Pass turn</button
			>
			<button
				type="button"
				role="menuitem"
				class={item}
				disabled={game.ended || !game.canPlay || !canSwap}
				onclick={() => run(onswap ?? (() => game.pass('swap')))}
				><ArrowLeftRight size={16} /> Swap tiles</button
			>
			<hr class="my-1 border-cream-edge" />
			{#if onendgame}
				<button
					type="button"
					role="menuitem"
					class={item}
					disabled={game.ended}
					onclick={() => run(onendgame)}><Flag size={16} /> End game</button
				>
				<button
					type="button"
					role="menuitem"
					class={[item, 'text-rose-600']}
					onclick={() => run(newGame)}><RotateCcw size={16} /> New game</button
				>
			{/if}
			<button
				type="button"
				role="menuitem"
				class={item}
				onclick={() => run(() => goto(resolve('/')))}><House size={16} /> Home</button
			>
		</div>
	{/if}
</div>
