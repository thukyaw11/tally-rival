<script lang="ts">
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import { LETTER_VALUES } from '@tally/game';
	import type { TileDrag } from '#lib/online/drag.svelte.ts';
	import type { Game, RackTile } from '#lib/scrabble/game.svelte.ts';

	// swapping: taps pick tiles (by slot in game.arrangedRack) to swap instead of placing them.
	// drag: drag tiles onto the board or to another slot.
	let {
		game,
		bagCount,
		swapping = false,
		selected = $bindable([]),
		drag = null
	}: {
		game: Game;
		bagCount: number;
		swapping?: boolean;
		selected?: number[];
		drag?: TileDrag | null;
	} = $props();

	const tiles: RackTile[] = $derived(
		swapping ? game.arrangedRack.map((letter, slot) => ({ letter, slot })) : (game.rackLeft ?? [])
	);
	// Keep focus in the board's hidden field so the phone keyboard stays open.
	const keepFocus = (e: MouseEvent) => e.preventDefault();

	function tap(slot: number, letter: string) {
		if (swapping) {
			selected = selected.includes(slot) ? selected.filter((s) => s !== slot) : [...selected, slot];
		} else if (letter === '?') {
			game.toggleBlank();
		} else {
			game.placeLetter(letter);
		}
	}

	function pointerdown(e: PointerEvent, t: RackTile) {
		if (!swapping) drag?.start(e, t.letter, t.letter === '?', { slot: t.slot });
	}
</script>

<div class="flex flex-col gap-2 panel px-3 py-2.5" data-rack>
	<div class="flex items-center justify-between gap-2 text-sm">
		<span class="font-semibold">{swapping ? 'Pick tiles to swap' : 'Your tiles'}</span>
		<span class="flex items-center gap-2">
			<span class="opacity-60">{bagCount} in bag</span>
			{#if !swapping && game.arrangedRack.length > 1}
				<button
					type="button"
					onmousedown={keepFocus}
					onclick={() => game.shuffleRack()}
					class="flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-medium hover:bg-amber-100"
					aria-label="Shuffle rack"><Shuffle size={14} /> Shuffle</button
				>
			{/if}
		</span>
	</div>
	<div class="flex min-h-12 justify-center gap-1.5">
		{#each tiles as t (t.slot)}
			{@const picked = swapping && selected.includes(t.slot)}
			{@const lifted = drag?.isDragging({ slot: t.slot })}
			{@const target = drag?.drag && drag.over && 'slot' in drag.over && drag.over.slot === t.slot}
			<button
				type="button"
				data-rack-slot={t.slot}
				onmousedown={keepFocus}
				onpointerdown={(e) => pointerdown(e, t)}
				onclickcapture={(e) => drag?.consumeClick(e)}
				onclick={() => tap(t.slot, t.letter)}
				disabled={!swapping && !game.canPlay}
				aria-label={t.letter === '?' ? 'Blank tile' : t.letter}
				aria-pressed={swapping ? picked : t.letter === '?' && game.blankNext}
				class={[
					'relative flex h-12 w-11 items-center justify-center rounded-md text-2xl font-bold tile transition-transform disabled:opacity-60',
					!swapping && drag && 'touch-none',
					picked && '-translate-y-2 ring-3 ring-amber-400',
					!swapping && t.letter === '?' && game.blankNext && 'ring-3 ring-amber-400',
					lifted && 'opacity-30',
					target && !lifted && 'ring-3 ring-amber-400'
				]}
			>
				{t.letter === '?' ? '' : t.letter}
				{#if t.letter !== '?'}
					<span class="absolute right-0.5 bottom-0 text-[10px] font-semibold"
						>{LETTER_VALUES[t.letter]}</span
					>
				{/if}
			</button>
		{/each}
	</div>
	{#if !swapping && game.canPlay}
		<p class="text-center text-xs opacity-60">
			{#if game.blankNext}
				Blank: type or tap the letter it stands for
			{:else if !game.cursor}
				Drag tiles onto the board, or tap a square then tap tiles or type
			{:else}
				Tap the same square again to switch across / down
			{/if}
		</p>
	{/if}
</div>
