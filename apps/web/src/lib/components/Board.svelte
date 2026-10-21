<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Star from '@lucide/svelte/icons/star';
	import { LETTER_VALUES, PREMIUMS, SIZE, CENTER } from '@tally/game';
	import { untrack } from 'svelte';
	import type { TileDrag } from '#lib/online/drag.svelte.ts';
	import type { Game, LastPlay } from '#lib/scrabble/game.svelte.ts';

	// drag (online only): rack tiles drop onto squares, and draft tiles can be dragged.
	let { game, drag = null }: { game: Game; drag?: TileDrag | null } = $props();

	// Highlight a newly played word for 4 s; skip the first run so a page load doesn't flash old moves.
	const FLASH_MS = 4000;
	let flash = $state.raw<LastPlay | null>(null);
	let seenSeq: number | null = null;
	let started = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(timer));
	$effect(() => {
		const last = game.lastPlay;
		const seq = last?.seq ?? null;
		const isNew = started && seq !== null && (seenSeq === null || seq > seenSeq);
		started = true;
		seenSeq = seq;
		// Passes re-run this too; they must not cut the highlight short.
		untrack(() => {
			if (isNew) {
				clearTimeout(timer);
				flash = last;
				timer = setTimeout(() => (flash = null), FLASH_MS);
			} else if (flash && flash.seq !== seq) {
				// Undo or edit took the word back.
				clearTimeout(timer);
				flash = null;
			}
		});
	});
	const flashAt = (row: number, col: number) =>
		flash?.cells.findIndex((c) => c.row === row && c.col === col) ?? -1;
	const placedAt = (row: number, col: number) =>
		!!flash?.placed.some((t) => t.row === row && t.col === col);

	const premiumStyle = {
		TW: 'bg-[#e5484d] text-white',
		DW: 'bg-[#f6a5b7] text-rose-900',
		TL: 'bg-[#2f6fe4] text-white',
		DL: 'bg-[#9fd8f6] text-sky-900'
	};
	const cells = Array.from({ length: SIZE * SIZE }, (_, i) => ({
		row: Math.floor(i / SIZE),
		col: i % SIZE
	}));

	// Hidden field that brings up the device's own keyboard. It always holds one
	// filler char, so a shorter value means backspace and extra chars are typed letters.
	const FILL = '.';
	let input: HTMLInputElement;

	function tap(row: number, col: number) {
		const same = game.cursor?.row === row && game.cursor?.col === col;
		// Re-tapping the cursor square only reopens the keyboard if it was closed.
		if (!same || document.activeElement === input) game.tapCell(row, col);
		input.focus({ preventScroll: true });
	}

	function oninput() {
		const value = input.value;
		if (value.length < FILL.length) game.backspace();
		for (const ch of value.slice(FILL.length)) {
			if (/[a-z]/i.test(ch)) game.placeLetter(ch);
			else if (ch === ' ') game.toggleDirection();
			else if (ch === '?' || ch === '*') game.toggleBlank();
		}
		input.value = FILL;
		input.setSelectionRange(FILL.length, FILL.length);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') game.clearDraft();
	}

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		game.submit();
	}

	// Close the keyboard once the word is submitted or cleared.
	$effect(() => {
		if (!game.cursor && document.activeElement === input) input.blur();
	});
</script>

<form {onsubmit} class="relative">
	<input
		bind:this={input}
		{oninput}
		{onkeydown}
		value={FILL}
		aria-label="Type letters"
		autocomplete="off"
		autocapitalize="characters"
		spellcheck="false"
		enterkeyhint="done"
		class="pointer-events-none absolute top-0 left-0 h-px w-px opacity-0"
		style="font-size: 16px"
	/>
</form>

<!-- Wooden frame around the felt board. -->
<div
	class="rounded-2xl bg-linear-to-br from-[#c48544] via-[#9a5f2a] to-[#6b3f17] p-[2.2%] shadow-[0_6px_0_#4a2a0e,0_16px_32px_rgb(0_0_0/0.5),inset_0_2px_0_rgb(255_255_255/0.25)]"
>
	<div
		class="@container grid aspect-square w-full grid-cols-15 grid-rows-15 gap-[0.35%] rounded-lg bg-felt-dark p-[0.35%] select-none"
		role="grid"
		aria-label="Scrabble board"
	>
		{#each cells as { row, col } (`${row}-${col}`)}
			{@const placed = game.board[row][col]}
			{@const draft = game.draftAt(row, col)}
			{@const tile = placed ?? draft}
			{@const premium = PREMIUMS[row][col]}
			{@const isCursor = game.cursor?.row === row && game.cursor?.col === col}
			{@const lit = placed ? flashAt(row, col) : -1}
			<button
				type="button"
				data-cell
				data-row={row}
				data-col={col}
				onmousedown={(e) => e.preventDefault()}
				onpointerdown={(e) => draft && drag?.start(e, draft.letter, draft.blank, { row, col })}
				onclickcapture={(e) => drag?.consumeClick(e)}
				onclick={() => tap(row, col)}
				aria-label={`Row ${row + 1} column ${col + 1}${tile ? ` ${tile.letter}` : ''}`}
				class={[
					'relative flex items-center justify-center rounded-[3px] leading-none font-bold',
					tile
						? ['tile', draft && 'z-10 -translate-y-px ring-2 ring-yellow-300']
						: premium
							? [premiumStyle[premium], 'shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]']
							: 'bg-felt shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)]',
					lit >= 0 && (placedAt(row, col) ? 'last-word-new' : 'last-word'),
					draft && drag && 'touch-none',
					drag?.isDragging({ row, col }) && 'opacity-30',
					drag?.isOver(row, col) && !placed && 'z-20 outline-3 outline-amber-400',
					isCursor && 'z-20 outline-3 outline-yellow-300'
				]}
				style={`font-size: 4cqw${flash && lit >= 0 ? `; --glow: ${game.color(flash.player).bg}` : ''}`}
			>
				{#if tile}
					<span class={tile.blank ? 'opacity-40' : ''}>{tile.letter}</span>
					{#if !tile.blank}
						<span class="absolute right-[6%] bottom-[6%]" style="font-size: 1.6cqw"
							>{LETTER_VALUES[tile.letter]}</span
						>
					{/if}
				{:else if row === CENTER && col === CENTER}
					<Star class="fill-current" style="width: 3.6cqw; height: 3.6cqw" />
				{:else if premium}
					<span style="font-size: 1.9cqw">{premium}</span>
				{/if}
				{#if flash && lit === flash.cells.length - 1}
					<span
						class="pointer-events-none absolute -top-[45%] -right-[45%] z-30 last-score rounded-full px-[0.6cqw] leading-tight font-bold whitespace-nowrap text-white shadow"
						style={`font-size: 3cqw; background: ${game.color(flash.player).bg}`}
						aria-hidden="true">+{flash.total}</span
					>
				{/if}
				{#if isCursor && !tile}
					{@const Arrow = game.direction === 'across' ? ArrowRight : ArrowDown}
					<span
						class="absolute inset-0 flex items-center justify-center rounded-[3px] bg-yellow-300/85 text-yellow-950"
					>
						<Arrow strokeWidth={3} style="width: 4cqw; height: 4cqw" />
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
