<script lang="ts">
	import { LETTER_VALUES } from '@tally/game';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	// swapping: taps pick tiles (by rack index) to swap instead of placing them.
	let {
		game,
		bagCount,
		swapping = false,
		selected = $bindable([])
	}: { game: Game; bagCount: number; swapping?: boolean; selected?: number[] } = $props();

	const tiles = $derived((swapping ? game.rack : game.rackLeft) ?? []);
	// Keep focus in the board's hidden field so the phone keyboard stays open.
	const keepFocus = (e: MouseEvent) => e.preventDefault();

	function tap(i: number, letter: string) {
		if (swapping) {
			selected = selected.includes(i) ? selected.filter((s) => s !== i) : [...selected, i];
		} else if (letter === '?') {
			game.toggleBlank();
		} else {
			game.placeLetter(letter);
		}
	}
</script>

<div class="flex flex-col gap-2 panel px-3 py-2.5">
	<div class="flex items-baseline justify-between text-sm">
		<span class="font-semibold">{swapping ? 'Pick tiles to swap' : 'Your tiles'}</span>
		<span class="opacity-60">{bagCount} in bag</span>
	</div>
	<div class="flex min-h-12 justify-center gap-1.5">
		{#each tiles as letter, i (i)}
			{@const picked = swapping && selected.includes(i)}
			<button
				type="button"
				onmousedown={keepFocus}
				onclick={() => tap(i, letter)}
				disabled={!swapping && !game.canPlay}
				aria-label={letter === '?' ? 'Blank tile' : letter}
				aria-pressed={swapping ? picked : letter === '?' && game.blankNext}
				class={[
					'relative flex h-12 w-11 items-center justify-center rounded-md text-2xl font-bold tile transition-transform disabled:opacity-60',
					picked && '-translate-y-2 ring-3 ring-amber-400',
					!swapping && letter === '?' && game.blankNext && 'ring-3 ring-amber-400'
				]}
			>
				{letter === '?' ? '' : letter}
				{#if letter !== '?'}
					<span class="absolute right-0.5 bottom-0 text-[10px] font-semibold"
						>{LETTER_VALUES[letter]}</span
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
				Tap a square on the board, then tap tiles or type
			{:else}
				Tap the same square again to switch across / down
			{/if}
		</p>
	{/if}
</div>
