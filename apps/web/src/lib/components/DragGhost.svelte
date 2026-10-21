<script lang="ts">
	import { LETTER_VALUES } from '@tally/game';
	import type { TileDrag } from '#lib/online/drag.svelte.ts';

	// The tile that follows the finger while dragging.
	let { drag }: { drag: TileDrag } = $props();

	const d = $derived(drag.drag);
	const shown = $derived(d && (d.blank && 'slot' in d.from ? '' : d.letter));
</script>

{#if d}
	<div
		class="pointer-events-none fixed z-50 flex h-12 w-11 -translate-x-1/2 -translate-y-3/4 scale-110 items-center justify-center rounded-md text-2xl font-bold tile shadow-[0_10px_20px_rgb(0_0_0/0.45)]"
		style={`left: ${d.x}px; top: ${d.y}px`}
		aria-hidden="true"
	>
		<span class={d.blank ? 'opacity-40' : ''}>{shown}</span>
		{#if !d.blank}
			<span class="absolute right-0.5 bottom-0 text-[10px] font-semibold"
				>{LETTER_VALUES[d.letter]}</span
			>
		{/if}
	</div>
{/if}
