<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Eraser from '@lucide/svelte/icons/eraser';
	import SquareDashed from '@lucide/svelte/icons/square-dashed';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();

	const btn = 'btn-3d h-11 flex-1 text-sm';
	// Keep focus in the hidden field so the phone keyboard stays open.
	const keepFocus = (e: MouseEvent) => e.preventDefault();
</script>

<div class="flex gap-2">
	<button type="button" class={btn} onmousedown={keepFocus} onclick={() => game.toggleDirection()}
		>{#if game.direction === 'across'}<ArrowRight size={16} /> Across{:else}<ArrowDown size={16} /> Down{/if}</button
	>
	<button
		type="button"
		class={[btn, game.blankNext && 'btn-amber']}
		onmousedown={keepFocus}
		onclick={() => game.toggleBlank()}
		aria-pressed={game.blankNext}
		title="Next letter is a blank (or type ?)"><SquareDashed size={16} /> Blank</button
	>
	<button
		type="button"
		class={btn}
		onmousedown={keepFocus}
		onclick={() => game.clearDraft()}
		disabled={!game.draft.length}><Eraser size={16} /> Clear</button
	>
	<button
		type="button"
		class={[btn, 'btn-green']}
		onclick={() => game.submit()}
		disabled={!game.draftScore}><Check size={16} /> Submit</button
	>
</div>
