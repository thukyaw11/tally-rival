<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Star from '@lucide/svelte/icons/star';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	// class: extra layout classes; on desktop the pages let the open list fill leftover height.
	let { game, class: className = '' }: { game: Game; class?: string } = $props();

	let open = $state(true);
</script>

<div class={['flex min-h-0 flex-col panel', open && className]}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		class="flex items-center gap-1.5 px-4 py-3 text-left text-lg font-semibold"
	>
		<ChevronDown size={18} class={['transition-transform', !open && '-rotate-90']} />
		Moves ({game.history.length})
	</button>
	{#if open && !game.remote}
		<div class="flex gap-2 px-4 pb-3">
			<button
				type="button"
				class="btn-3d h-9 px-3 text-sm btn-white"
				onclick={() => game.undo()}
				disabled={!game.moves.length && !game.ended}><Undo2 size={14} /> Undo</button
			>
			<button
				type="button"
				class="btn-3d h-9 px-3 text-sm btn-white"
				onclick={() => game.editLast()}
				disabled={!game.moves.length || game.ended || game.moves.at(-1)?.kind !== 'play'}
				><Pencil size={14} /> Edit last</button
			>
		</div>
	{/if}
	{#if open}
		<ol class="max-h-64 min-h-0 flex-1 overflow-y-auto px-4 pb-3 text-sm lg:max-h-none">
			{#each [...game.history].reverse() as h, i (i)}
				{@const unknown = game.unknownIn(h.score)}
				<li class="flex items-center justify-between gap-2 border-t border-cream-edge/60 py-1.5">
					<span class="w-5 shrink-0 opacity-50">{game.history.length - i}</span>
					<span
						class="h-2.5 w-2.5 shrink-0 rounded-full"
						style={`background: ${game.color(h.player).bg}`}
					></span>
					<span class="shrink-0 font-medium">{game.players[h.player]}</span>
					<span class="flex-1 truncate font-semibold tracking-wide">
						{#if h.score}
							{#each h.score.words as w, j (j)}
								{j ? ', ' : ''}<span class={[unknown.includes(w.text) && 'text-amber-600']}
									>{w.text}{#if unknown.includes(w.text)}<TriangleAlert
											size={12}
											class="ml-0.5 inline align-[-1px]"
										/>{/if}</span
								>
							{/each}
						{:else}
							<span class="font-normal opacity-50"
								>{h.kind === 'swap' ? 'swapped tiles' : 'passed'}</span
							>
						{/if}
						{#if h.score?.bingo}<Star size={12} class="inline align-[-1px] text-amber-500" />{/if}
					</span>
					<span class="font-bold tabular-nums">{h.score?.total ?? 0}</span>
				</li>
			{/each}
		</ol>
	{/if}
</div>
