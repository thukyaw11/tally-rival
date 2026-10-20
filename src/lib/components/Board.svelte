<script lang="ts">
	import { LETTER_VALUES, PREMIUMS, SIZE, CENTER } from '#lib/scrabble/constants.ts';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();

	const premiumStyle = {
		TW: 'bg-red-500 text-white',
		DW: 'bg-rose-200 text-rose-900',
		TL: 'bg-blue-600 text-white',
		DL: 'bg-sky-200 text-sky-900'
	};
	const cells = Array.from({ length: SIZE * SIZE }, (_, i) => ({
		row: Math.floor(i / SIZE),
		col: i % SIZE
	}));
</script>

<div
	class="@container grid aspect-square w-full grid-cols-15 grid-rows-15 gap-px rounded-md bg-emerald-900 p-px select-none"
	role="grid"
	aria-label="Scrabble board"
>
	{#each cells as { row, col } (`${row}-${col}`)}
		{@const placed = game.board[row][col]}
		{@const draft = game.draftAt(row, col)}
		{@const tile = placed ?? draft}
		{@const premium = PREMIUMS[row][col]}
		{@const isCursor = game.cursor?.row === row && game.cursor?.col === col}
		<button
			type="button"
			onclick={() => game.tapCell(row, col)}
			aria-label={`Row ${row + 1} column ${col + 1}${tile ? ` ${tile.letter}` : ''}`}
			class={[
				'relative flex items-center justify-center overflow-hidden rounded-[2px] leading-none font-bold',
				tile
					? draft
						? 'bg-amber-300 text-stone-900 ring-2 ring-emerald-500 ring-inset'
						: 'bg-amber-100 text-stone-900'
					: premium
						? premiumStyle[premium]
						: 'bg-emerald-700/90',
				isCursor && 'z-10 outline-3 outline-sky-400'
			]}
			style="font-size: 4cqw"
		>
			{#if tile}
				<span class={tile.blank ? 'text-stone-400' : ''}>{tile.letter}</span>
				{#if !tile.blank}
					<span class="absolute right-[6%] bottom-[6%]" style="font-size: 1.6cqw"
						>{LETTER_VALUES[tile.letter]}</span
					>
				{/if}
			{:else if row === CENTER && col === CENTER}
				<span style="font-size: 4cqw">★</span>
			{:else if premium}
				<span style="font-size: 1.9cqw">{premium}</span>
			{/if}
			{#if isCursor && !tile}
				<span class="absolute text-sky-300" style="font-size: 3.5cqw"
					>{game.direction === 'across' ? '→' : '↓'}</span
				>
			{/if}
		</button>
	{/each}
</div>
